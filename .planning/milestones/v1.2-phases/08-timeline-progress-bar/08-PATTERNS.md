# Phase 8: Timeline & Progress Bar - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/Timeline.tsx` (new) | component | event-driven (受控 slider + wall-clock ticker) | `src/components/SessionBanner.tsx`（时间刷新）+ `src/components/PlaybackControls.tsx`（range 输入） | exact |
| `src/playback/timelineDensity.ts` (new) | utility（纯函数模块） | transform | `src/playback/session.ts` | exact |
| `src/hooks/usePlaybackEngine.ts` (modify: `previewSeek`) | hook | event-driven | 自身 `seek()` L236-239（对称镜像） | exact |
| `src/components/PlaybackControls.tsx` (modify: Timeline 集成) | component | event-driven | 自身 playing/paused 分支 L57-115 | exact |
| `src/App.tsx` (modify: props 透传) | integration | request-response | 自身 L52（hook 解构）+ L372-389（props 链） | exact |
| `src/index.css` (modify: Timeline 样式) | config/style | — | 自身（暗场色板 L5-14、`.font-size-slider` L275-278、landscape 媒体查询 L445-459） | exact |
| `src/i18n/translations.ts` (modify: `timelineLabel`) | config/i18n | — | 自身（en/zh 对称块） | exact |
| `test/unit/timelineDensity.test.ts` (new) | test | batch | `test/unit/session.test.ts` | exact |

> **路径消歧：** orchestrator 提示稿写 `src/utils/timelineDensity.ts`，但 RESEARCH.md §Recommended Project Structure 指定 `src/playback/timelineDensity.ts`。代码库惯例明确支持后者：播放域纯函数（session.ts、PlaybackEngine.ts、playbackHistory.ts）全部在 `src/playback/`，`src/utils/` 只有 errors.ts 一个与播放无关的模块。**采用 `src/playback/timelineDensity.ts`。**

---

## Pattern Assignments

### `src/playback/timelineDensity.ts` (utility, transform) — TDD 先行（tdd_mode: true）

**Analog:** `src/playback/session.ts`（整个文件是本阶段的模板：纯函数、显式注入时钟/参数、JSDoc 挂决策编号、全量防御性边界）

**模块头 JSDoc 模式**（session.ts L1-20）：
```typescript
/**
 * Wall-clock playback session model (Phase 5, PLAY-08).
 *
 * Dual-source clock rule (design basis: ...):
 * ...
 * This module itself reads NO clock. Every wall-clock value enters via an
 * explicit `now` parameter, keeping the math deterministic under test...
 */
```
> 模仿要点：模块头说明**所属 Phase 与决策编号**（Phase 8, D-07/D-08/D-09）、**不变的规则**（半开区间 `[start, end)`、cue 依解析器保序 07-D-06）、**纯度声明**（reads no clock / never throws）。

**纯函数 + 边界防御模式**（session.ts L146-155 `isValidSession`、L167-173 `formatElapsedHMS`）：
```typescript
export function isValidSession(raw: unknown): raw is PlaybackSession {
  if (raw === null || typeof raw !== 'object') return false
  ...
}
```
```typescript
export function formatElapsedHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  ...
}
```
> 模仿要点：每个入口先做退化输入短路（`totalDurationMs <= 0 || cues.length === 0 || bucketCount <= 0` → `[]`），`clampToDuration` 拒绝非有限值（`Number.isFinite`），负值钳 0 —— 与 RESEARCH.md Pattern 4 / clampToDuration 示例直接对应。

**RESEARCH.md 已给出完整实现骨架**（08-RESEARCH.md Pattern 4 L259-281 + clampToDuration L415-421）——这两个函数照研究稿实现，命名与签名以 RESEARCH 为准：`computeCueDensityBuckets(cues, totalDurationMs, bucketCount): DensityBucket[]`、`clampToDuration(targetMs, totalDurationMs): number`。

**导入模式**（session.ts 风格 — 类型与实现分离导入）：
```typescript
import type { Cue } from '../types/subtitle'
```

---

### `test/unit/timelineDensity.test.ts` (test, batch)

**Analog:** `test/unit/session.test.ts`

**文件头注入常量模式**（session.test.ts L1-21）：
```typescript
import { describe, it, expect } from 'vitest'
import {
  createSession,
  ...
} from '../../src/playback/session'
import type { PlaybackSession } from '../../src/playback/session'

// Wall-clock anchor for every fixture — small integer, injected explicitly.
// Never Date.now(), never fake timers: the module under test reads no clock.
const T = 1_000_000

const BASE = { subtitleId: 'sub-42', fileName: 'movie.srt', offsetMs: 0 }
```
> 模仿要点：
> - 从 `../../src/playback/timelineDensity` 导入被测函数（相对路径两级向上）
> - 顶部定义**命名 fixture 常量**（如 `const CUES = [...]`），禁止 `Date.now()` / fake timers
> - `describe` 按被测函数分组，`it` 描述行为契约而非实现（"anchors started at the injected now" 风格）
> - 边界用例模式参考 session.test.ts L48-57（负值、极端值返回有限数）与 L74-79（不变量断言）

**必须覆盖的用例**（RESEARCH.md Test Map L524 + Pitfall 7）：空文件/空 cues/`bucketCount<=0` 短路返回 `[]`、单 cue、cue 恰跨桶界（end 恰在桶界不溢入下一桶）、空桶 tier 0、三档相对分级（max 归一）、重叠 cue 按原序各自计入、`clampToDuration` 的 NaN/Infinity/负值/越界/`totalDurationMs<=0` 全分支。

---

### `src/components/Timeline.tsx` (component, event-driven)

**Analog A（时间显示与 ticker）:** `src/components/SessionBanner.tsx` — RESEARCH.md L400-411 直接标注 "UI-01 直接套用"

**Ticker 模式**（SessionBanner.tsx L30-41 全文）：
```tsx
export function SessionBanner({ session, status, onResume, onDismiss }: SessionBannerProps) {
  const [now, setNow] = useState(Date.now())
  const { t } = useLanguage()

  useEffect(() => {
    if (status !== 'playing') return                    // 仅播放态刷新
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  if (session === null || status === 'idle') return null

  const time = formatElapsedHMS(sessionElapsedMs(session, now))
```
> Timeline 套用此模式，两处差异：刷新间隔用 250ms（RESEARCH Open Question 1 建议）；Timeline 不 return null（禁用态渲染 disabled slider），但 `totalMs <= 0` 时必须渲染禁用控件（Pitfall 6 除零）。

**导入模式**（SessionBanner.tsx L1-5）：
```tsx
import { useState, useEffect } from 'react'
import type { PlaybackSession } from '../playback/session'
import { sessionElapsedMs, formatElapsedHMS } from '../playback/session'
import type { PlaybackStatus } from '../hooks/usePlaybackEngine'
import { useLanguage } from '../i18n/LanguageContext'
```
> Timeline 追加 `import { computeCueDensityBuckets, clampToDuration } from '../playback/timelineDensity'` 与 `import type { Cue } from '../types/subtitle'`。

**Analog B（受控 range 与 a11y 属性）:** `src/components/PlaybackControls.tsx` L77-89 — 代码库唯一 range 先例

```tsx
<input
  type="range"
  min="36"
  max="72"
  value={fontSize}
  onChange={(e) => onFontSizeChange(Number(e.target.value))}
  className="font-size-slider"
  aria-label={t('fontSizeLabel')}
  aria-valuetext={`${fontSize} pixels`}
/>
```
> Timeline 的 range 在此基础上扩展：`step="any"`（禁用一切吸附，Pitfall 3）、`onKeyDown` 自定义 ±5000ms（D-12）、`onPointerDown/onPointerUp` 预览/提交分派（D-01/D-02）、`aria-valuetext={\`${formatElapsedHMS(displayValue)} / ${formatElapsedHMS(totalMs)}\`}`（D-13，与 SessionBanner 的 `t('sessionElapsed', { time })` 同款时间格式）。**不要**用 `accent-color` 快捷样式（font-size-slider 用它是因为无叠加层；Timeline 需要密度层 → 必须走 `appearance: none` + 伪元素，RESEARCH State of the Art L459 明示）。

**组件壳保持薄**（RESEARCH Validation L515 硬约束）：所有可测逻辑（分桶、钳制、键盘步进量计算）已在 `timelineDensity.ts` 纯函数中；组件内只留状态机（`isDragging`/`dragValue` 分流，RESEARCH Pattern 2 L202-224 全文）与渲染。**不要**引入 jsdom/@testing-library。

**Props 接口**（RESEARCH.md L439-446 已锁定，照抄）：
```tsx
interface TimelineProps {
  session: PlaybackSession | null
  status: PlaybackStatus
  cues: Cue[]
  totalDurationMs: number
  onSeek: (targetMs: number) => void
  onPreviewSeek: (targetMs: number) => void
}
```
密度数据在组件内 `useMemo(() => computeCueDensityBuckets(cues, totalDurationMs, BUCKET_COUNT), [cues, totalDurationMs])`。

---

### `src/hooks/usePlaybackEngine.ts` (modify — 新增 `previewSeek`)

**Analog:** 自身 `seek()` L232-239 — previewSeek 是它的 engine-only 镜像

**既有 seek 模式**（L232-239）：
```typescript
/**
 * Seek to an offset-INCLUSIVE target position (Phase 7, ENG-01, ENG-02).
 * Updates engine state (immediate visual cue change if paused) and updates session.
 */
const seek = useCallback((targetMs: number) => {
  engineRef.current?.seek(targetMs)
  setSession((prev) => (prev ? seekSession(prev, targetMs, Date.now()) : prev))
}, [])
```

**新增 previewSeek**（RESEARCH.md Pattern 1 L179-185 已锁定，照抄）：
```typescript
const previewSeek = useCallback((targetMs: number) => {
  // 仅引擎：立即更新字幕画面。刻意不调用 setSession ——
  // persist effect 由 session 对象身份变化驱动（L164-181 注释），
  // 不触碰 session 即零 IndexedDB 写入（D-01, 07-D-09）。
  engineRef.current?.seek(targetMs)
}, [])
```
> 关键既有约束（改此文件必读）：
> - **`useCallback([])` 纪律**：hook 内所有动作回调依赖数组为空，新鲜值经 `xxxRef` 读取（L131-140 模式）。previewSeek 无需读任何 prop，`[]` 即可。
> - **persist effect 不可触碰**（L164-181）：任何新增 `setSession` 调用点都会触发一次 IndexedDB 写入。previewSeek 的正确性完全由"不调 setSession"保证。
> - **返回对象追加字段**（L280）：`return { state, play, pause, stop, seek, previewSeek, session, resyncToSession, restoreSession }`，并同步更新返回类型注解（L114-123）与 hook 头 JSDoc L108。
> - **Pitfall 2 边界**（PlaybackEngine.ts L184-191 已验证）：播放态预览目标 ≥ 末 cue end 会触发引擎 `stop()` + `onEnded()` → session 清空 → Timeline 卸载。**预览路径必须钳制到 `Math.min(target, totalDurationMs - 1)`**（此钳制属于 Timeline 组件的调用侧，或统一收进 `clampToDuration` 的预览变体——planner 二选一，但提交路径**不得**钳，07-D-03 语义保留）。

---

### `src/components/PlaybackControls.tsx` (modify — Timeline 集成)

**Analog:** 自身 playing/paused 分支 L57-115 与 props 接口 L4-21

**props 接口扩展模式**（L4-21 — 每个回调都是 `onXxx: (x: T) => void`，无默认值，onBack 用 `?` 可选）：
```typescript
interface PlaybackControlsProps {
  status: PlaybackStatus
  onPlay: () => void
  ...
  onBack?: () => void
}
```
> 新增（RESEARCH L434-436）：`session: PlaybackSession | null`、`cues: Cue[]`、`totalDurationMs: number`、`onSeek: (targetMs: number) => void`、`onPreviewSeek: (targetMs: number) => void`。

**渲染位置**（L57-59 — playing/paused 分支开头）：
```tsx
{(status === 'playing' || status === 'paused') && (
  <>
    {/* Timeline 在此渲染，作为分支第一个元素 */}
    <button className="control-button" onClick={() => onOffsetChange(offsetMs - 500)}>
```
> RESEARCH L449 已验证：App 中 PlaybackControls 有两个挂载点（playback 视图 L494 + ready 视图 idle 态 L493）；Timeline 只在 playing/paused 分支渲染，ready 视图实例永远 idle → 不受影响。`totalDurationMs <= 0` 时 Timeline 自身渲染禁用态，PlaybackControls 无需额外分支。

---

### `src/App.tsx` (modify — props 透传)

**Analog:** 自身 L52-56（hook 解构）+ L372-389（playback 视图 props 传递）

**hook 解构点**（L52-56 — 当前未解构 `seek`，需补 `seek, previewSeek`）：
```tsx
const { state: playbackState, play, pause, stop, session, resyncToSession, restoreSession } = usePlaybackEngine(
  subtitle?.cues ?? [],
  settings.offsetMs,
  activeIdentity
)
```
> 改为：`const { state: playbackState, play, pause, stop, seek, previewSeek, session, resyncToSession, restoreSession } = usePlaybackEngine(...)`。

**playback 视图 props 链**（L372-389 — 现有透传风格：内联箭头包装）：
```tsx
<PlaybackControls
  status={playbackState.status}
  onPlay={handlePlay}
  ...
  onFontSizeChange={(size) => updateSettings({ fontSize: size })}
  ...
/>
```
> 新增透传（注意 `subtitle?.metadata.totalDurationMs ?? 0` 的空安全，与 L53 `subtitle?.cues ?? []` 同款）：
> ```tsx
> session={session}
> cues={subtitle?.cues ?? []}
> totalDurationMs={subtitle?.metadata.totalDurationMs ?? 0}
> onSeek={seek}
> onPreviewSeek={previewSeek}
> ```
> **只在 playback 视图挂载点（L372-389）加这 5 个 props**；ready 视图挂载点（L494-510）不加（其 Timeline 永不渲染，props 缺省即可——planner 可决定是否让两个挂载点 props 对称，但 RESEARCH 验证了 ready 实例不受影响）。

---

### `src/index.css` (modify — Timeline 样式)

**Analog:** 自身暗场色板与既有惯例

**必须复用的色板**（L5-14 + L245-258）：
```css
:root {
  /* Cinema display tokens — OLED-optimized */
  --subtitle-bg: #000000;
  --subtitle-color: #e0e0e0;
}
```
> `#e0e0e0`（已播放段白色，D-05）与 `#222/#333/#444/#555`（未播放段/密度标记暗灰系）——RESEARCH.md Pattern 5 的完整 CSS（L288-321）已按此色板写好，直接采用。禁止引入任何新彩色（D-05：不做成高亮彩色主视觉）。

**触控目标惯例**（L244-247 `.control-button`）：
```css
/* Control buttons — large touch targets for dark theater use */
.control-button {
  min-width: 64px;
  min-height: 44px;
```
> Timeline 触控区扩大模式（D-11）：padding 扩大命中区 + 负 margin 抵消避免布局位移（RESEARCH Pattern 5 L299-302）。

**landscape 媒体查询**（L445-459 — 新增 Timeline 样式必须同步出 landscape 变体）：
```css
/* Landscape compaction — shorter controls for narrow landscape viewports */
@media (orientation: landscape) and (max-height: 500px) {
  .playback-controls { bottom: 12px; gap: 6px; }
  ...
}
```

**层级与 z-index 惯例**（L509-515 注释 — z-index 阶梯有明确记录）：
```css
/* Session toast — ... z-index 300 slots between
   .back-button/.language-toggle (200) and .rotate-overlay (9999) */
```
> Timeline 密度层用层叠顺序 markers(z:0) < played-fill(track 背景) < input 拖拽层（RESEARCH Anti-Patterns 第 5 条），无需新 z-index 数值（全部在 `.playback-controls` z-index:100 内部）。

---

### `src/i18n/translations.ts` (modify — `timelineLabel`)

**Analog:** 自身 en/zh 对称块结构

**新增模式**（en 块 L49-55 之后、zh 块 L102-108 之后对称插入，RESEARCH L423-431 已锁定键名与文案）：
```typescript
// en 块，Section 注释对齐既有风格:
// Timeline.tsx
timelineLabel: 'Playback progress',
// zh 块:
// Timeline.tsx
timelineLabel: '播放进度',
```
> - en 与 zh 块键序完全对称（既有惯例：每个键在两块中同一位置）
> - 用法：`aria-label={t('timelineLabel')}` + `aria-valuetext={\`${formatElapsedHMS(displayValue)} / ${formatElapsedHMS(totalMs)}\`}` → 读屏播报 "播放进度, 1:12 / 2:05"（D-13 示例精确匹配）
> - 若实现需要更多键（如禁用态提示），沿用 `{param}` 插值模板模式（L53 `sessionElapsed: '{time} elapsed'` 先例），en/zh 同步添加

---

## Shared Patterns

### 双时钟规则（最高优先级，改动即违反）
**Source:** `src/playback/session.ts` L1-20 模块头 + L84-90 `sessionElapsedMs`
**Apply to:** Timeline.tsx（位置显示）、usePlaybackEngine.ts（previewSeek 注释）
```typescript
// UI 显示只读 session wall-clock；engine 的 performance.now() 仅属于引擎。
// 混用会在 offset 变化/暂停恢复时漂移。
export function sessionElapsedMs(session: PlaybackSession, now: number): number {
  const base =
    session.pausedElapsedMs !== null
      ? session.pausedElapsedMs
      : now - session.startedAt
  return base + session.offsetMs
}
```

### 持久化触发规则
**Source:** `src/hooks/usePlaybackEngine.ts` L164-181（persist effect + 注释）
**Apply to:** usePlaybackEngine.ts（previewSeek 不调 setSession）、Timeline.tsx（只经 `onSeek` 间接触发持久化，绝不直接调 `saveSession`）
```typescript
// Persist-on-change (Phase 6, FILE-03 #1/#4): every setSession site
// allocates a fresh object or null, so identity change === semantic
// transition (create/pause/resume/offset/stop). Engine position ticks
// never touch the session object → zero write amplification...
useEffect(() => {
  if (session !== null) {
    hasPersistedRef.current = true
    void saveSession(session)
  } else if (hasPersistedRef.current) {
    ...
  }
}, [session])
```

### offset-inclusive 时间空间与钳制
**Source:** `src/playback/session.ts` L102-119 `seekSession` JSDoc + `src/playback/PlaybackEngine.ts` L137-153 `seek`
**Apply to:** timelineDensity.ts（clampToDuration）、Timeline.tsx（所有 seek 目标）、usePlaybackEngine.ts（previewSeek JSDoc）
```typescript
// session.ts L102-104:
// Re-anchor session for seek in offset-inclusive position space (Phase 7, ENG-02).
// targetMs: offset-inclusive target position (same space as sessionElapsedMs).
```
> 所有定位入口统一钳制 `[0, totalDurationMs]`（07-D-02）；**唯一例外**：预览路径钳到 `totalDurationMs - 1`（Pitfall 2，提交路径不钳）。

### i18n 用法
**Source:** `src/components/SessionBanner.tsx` L31, L48, L55 + `src/i18n/translations.ts` L112-121
**Apply to:** Timeline.tsx（aria-label）、translations.ts（en/zh 对称键）
```tsx
const { t } = useLanguage()
...
aria-label={t('resumePlayingAria', { fileName: session.fileName })}
```

### 暗场低亮度视觉
**Source:** `src/index.css` L5-14（色板 token）、L600-617（`.playback-back` 低视觉权重先例：`color: #888; opacity: 0.55`，`:active` 才提亮）
**Apply to:** index.css（Timeline 轨道/密度/手柄全部样式）
> 静止态低亮度、交互态（hover/active/focus-visible）提亮——与 D-06 手柄显隐、`.playback-back` 的 opacity 模式同构。

### useCallback([]) + live-ref 纪律
**Source:** `src/hooks/usePlaybackEngine.ts` L131-140, L203-239
**Apply to:** usePlaybackEngine.ts（previewSeek 签名风格）
```typescript
const seek = useCallback((targetMs: number) => { ... }, [])
```

### 纯函数可测性（tdd_mode 硬约束）
**Source:** `src/playback/session.ts` L15（"All functions are pure and total (never throw)"）+ `test/unit/session.test.ts` L16-18（"Never Date.now(), never fake timers"）
**Apply to:** timelineDensity.ts + timelineDensity.test.ts 全部逻辑先行、组件壳保持薄

---

## No Analog Found

无 — 全部 8 个文件在代码库中都有 exact 级 analog（本项目 Phase 2-7 已建立完整的 controller-less 模式：组件 + 纯函数模块 + hook，无路由/中间件/ORM 层）。

唯一注意事项：**无任何既有 slider 叠加视觉层的先例**（`.font-size-slider` 是 accent-color 简单着色）——Timeline 的伪元素 + CSS 自定义属性 + 密度层写法在代码库中首次出现，直接采用 RESEARCH.md Pattern 5 的完整 CSS（多源一致的标准技法，L288-321），真机验收兜底。

## Metadata

**Analog search scope:** `src/`（components/hooks/playback/types/i18n/utils）、`test/unit/`、根配置
**Files scanned:** 11（App.tsx、PlaybackControls.tsx、SessionBanner.tsx、usePlaybackEngine.ts、session.ts、PlaybackEngine.ts、subtitle.ts、translations.ts、index.css、session.test.ts、目录清单）
**Pattern extraction date:** 2026-09-01
