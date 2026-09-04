---
status: issues-found
phase: 07-engine-foundation
date: 2026-09-04
---

## Findings

### Warning

#### WR-01: `usePlaybackEngine.seek` 在 session 为 null 时只更新 engine 不更新 session，后续 play() 造成引擎/会话位置分叉

**File:** `src/hooks/usePlaybackEngine.ts:237-240`

```ts
const seek = useCallback((targetMs: number) => {
  engineRef.current?.seek(targetMs)                                     // 无条件执行
  setSession((prev) => (prev ? seekSession(prev, targetMs, Date.now()) : prev))  // prev 为 null 时 no-op
}, [])
```

**Issue:** idle/ready 态（`session === null`，例如字幕已加载但尚未 play）下调用 `seek(60000)`：
引擎侧 `pausedElapsed` 被改为 `60000 - offset` 并同步触发 `onCueChange`（暂停分支
`src/playback/PlaybackEngine.ts:146-152`），而会话侧保持 `null`。
随后调用 `play()` 时两条路径按各自状态推进，必然分叉——
引擎 `startTime = now - pausedElapsed` 从 60s 处续播（`PlaybackEngine.play():96`），
会话却走 `createSession({ now: Date.now() })` 从 0 处新建（`usePlaybackEngine.ts:207-218`）。
结果 banner/显示位置 (~0) 与实际字幕位置 (60s) 不一致，且 `TICK` 已在 idle 态改写了
`currentIndex`（idle 态意外出现 active cue）。

可达性：`App.tsx:573-591` 在 idle ready 视图同样把 `onSeek={seek}` 传给
`PlaybackControls`，空会话下 seek 调用不受 hook 层任何守卫拦截。

**Fix:** 二选一（推荐前者，保持"引擎与会话原子更新"的 D-09 语义）：

```ts
const seek = useCallback((targetMs: number) => {
  // 无会话时不允许单方面推进引擎：要么同时建会话，要么直接 no-op
  let hasSession = false
  setSession((prev) => {
    hasSession = prev !== null
    return prev ? seekSession(prev, targetMs, Date.now()) : prev
  })
  if (hasSession) engineRef.current?.seek(targetMs)
}, [])
```

或在 `seek` 无会话时按 `play()` 的 identity 逻辑先 `createSession` 再 seek。
注意 `setState` updater 内读值需经 ref/局部变量中转，上例用 updater 副作用判断仅为示意，
更干净的做法是读 `sessionRef.current`（本文件已有该模式，L135/L140）。

---

#### WR-02: `seek` / `seekSession` 对 `targetMs` 无任何有限性校验，NaN 可毒化引擎计时并污染显示

**File:** `src/playback/PlaybackEngine.ts:142-153`, `src/playback/session.ts:108-119`,
`src/hooks/usePlaybackEngine.ts:237-240`

**Issue:** 三层 seek 均假设 `targetMs` 有限，未做 `Number.isFinite` 守卫：

1. `PlaybackEngine.seek(NaN)`：`pausedElapsed = NaN`（暂停态）或 `startTime = NaN`
   （播放态），此后所有 `tick` 的 `elapsed` 恒为 NaN。更糟的是
   `findActiveCue(cues, NaN, …)` 的二分分支中 `NaN < start` 与 `NaN >= end`
   均为 false，必然落入 `else return mid`（`PlaybackEngine.ts:35-41`），返回一个
   **错误的中间 cue 索引**而非 -1；且自停条件 `elapsed >= last.end` 恒 false，
   rAF 空转永不收敛。
2. `seekSession(session, NaN, now)` 同样产出 `startedAt: NaN` /
   `pausedElapsedMs: NaN` 的会话，违背本模块文档 "All functions are pure and
   total … Always a finite number"（`session.ts:12-15, 82`）的承诺；
   `sessionElapsedMs` 返回 NaN 并经已有 persist effect 写入 IndexedDB。
   （万幸 `isValidSession` 用 `Number.isFinite` 校验，下次启动会拒收自愈，
   但当次会话的 banner 经 `formatElapsedHMS(NaN)` 会渲染异常——`Math.max(0, NaN)`
   得 NaN，最终显示非 `"0:00:00"` 而是 NaN 拼接串。）
3. 负数 `targetMs` 同理无夹紧：`pausedElapsed` 可为负（虽有"显示层夹紧"的既有约定，
   但 seek 是新暴露的公开入口，不应把不变量维护完全推给调用方；Phase 08 Timeline
   负责上界夹紧，下界应在引擎/会话层兜底）。

**Fix:**

```ts
// PlaybackEngine.seek 入口
seek(targetMs: number): void {
  if (!Number.isFinite(targetMs)) return
  targetMs = Math.max(0, targetMs)
  ...
}

// session.seekSession 入口（保持纯函数不抛异常：非法输入返回原对象拷贝）
export function seekSession(session: PlaybackSession, targetMs: number, now: number): PlaybackSession {
  if (!Number.isFinite(targetMs) || !Number.isFinite(now)) return { ...session }
  ...
}
```

上界 `[0, totalDurationMs]` 夹紧继续由调用方（Phase 08 Timeline）负责，
`seekSession` 纯函数语义下只做有限性守卫即可。

---

### Info

#### IN-01: `App.tsx` 两处 `StoredSubtitle → ParsedSubtitle` 重建逻辑逐行重复，新增字段需改两处

**File:** `src/App.tsx:183-198` vs `src/App.tsx:253-264`

**Issue:** `handleSelectSaved` 与 `handleResumeFromSession` 各自内联同一段重建代码
（`lastCue` 取尾 + `metadata` 组装 + `totalDurationMs: lastCue ? lastCue.end : 0`）。
本 Phase 恰好证明了风险：加一个 `totalDurationMs` 字段就必须同步改两处；
下次再加字段（如 Phase 08 需要的时长派生量）极易漏改一处造成持久化/导入路径不一致。
行为当前正确，仅是可维护性问题。

**Fix:** 抽取纯 helper（放 `src/imports/` 或 `src/db/` 旁均可）：

```ts
function storedToParsed(stored: StoredSubtitle): ParsedSubtitle {
  const lastCue = stored.cues[stored.cues.length - 1]
  return {
    cues: stored.cues,
    metadata: {
      fileName: stored.fileName,
      encoding: stored.encoding,
      cueCount: stored.cueCount,
      parsedAt: stored.importedAt,
      totalDurationMs: lastCue ? lastCue.end : 0,
    },
    errors: [],
  }
}
```

两处调用点收敛到该函数。

---

#### IN-02: `totalDurationMs` 取"文件顺序最后一条"而非全量最大值，乱序 SRT 会低估 Timeline 右端

**File:** `src/imports/srtParser.ts:124`

```ts
const totalDurationMs = cues.length > 0 ? cues[cues.length - 1].end : 0
```

**Issue:** 若 SRT 文件时间乱序（parser 仅对 overlap 告警但仍按文件顺序 push，
` srtParser.ts:92-99`），`cues[last].end` 可能小于真实最大 `end`，
Timeline 右端与拖拽上界被低估，尾部字幕不可达。当前与引擎自停条件
（`PlaybackEngine.ts:187` 同样用 `cues[cues.length-1].end`）保持一致，
且标准 SRT 文件有序，所以行为符合 D-01 决策，仅建议显式固化"输入有序"假设
或改用 `Math.max(...cues.map(c => c.end))`（两者需同步改）。

**Fix:** 二选一：(a) 在 `parseSRT` 返回前断言/注释有序假设；(b) 两处同步改为 max。
因涉及引擎自停语义联动，改动需配套回归 `playbackEngine.test.ts` 的耗尽用例。

---

#### IN-03: 暂停分支 `lastIndex` 被连续赋值两次，首 Ub 赋值无效

**File:** `src/playback/PlaybackEngine.ts:147-150`

```ts
this.pausedElapsed = targetMs - this.offsetMs
this.lastIndex = -1                                    // 立即被下两行覆盖，无意义
const activeIndex = findActiveCue(this.cues, targetMs, -1)
this.lastIndex = activeIndex
```

**Issue:** 纯冗余（播放分支的 `lastIndex = -1` 是有效复位，暂停分支的则不是）。
无行为影响，删除该行即可。另 `srtParser.ts:71-80` 的 `parseInt(x)` 未传 radix
（现代引擎默认十进制无实害），建议补 `, 10` 以合 lint 规范。

---

### 安全扫描（本轮无发现）

- 9 个文件 grep：无 `eval` / `innerHTML` / `dangerouslySetInnerHTML` /
  `exec(` / 硬编码密钥 / `console.log` 调试残留（仅 `App.tsx` 三处 catch 中的
  `console.warn`，属正常错误上报）。
- `isValidSession` 对 IndexedDB 不可信记录逐字段 `Number.isFinite` 校验、
  拒绝-不-夹紧策略正确；NaN 会话可自愈（见 WR-02）。
- 字幕文本经 React 渲染（未在评审范围内发现 `dangerouslySetInnerHTML`），
  XSS 面无新增风险。
- `parseSRT` 对畸形块只记 `errors` 不抛异常，无 ReDoS 风险模式
  （时间码正则线性、无嵌套量词）。

---

## Summary

Phase 07 的 seek 双路径与 `totalDurationMs` 派生整体正确（offset-inclusive 空间、
播放重锚定/暂停即时 cue 数学均与 tick 公式自洽，76 项单测全绿），但 hook 层
`seek` 在空会话下会造成引擎/会话位置分叉（WR-01），且三层 seek 入口缺有限性
校验、NaN 可毒化计时循环（WR-02）；另有 3 项 Info（重建逻辑重复、尾 cue 假设、
冗余赋值）。无 Critical/安全漏洞。
