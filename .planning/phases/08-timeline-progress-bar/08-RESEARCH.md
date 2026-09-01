# Phase 8: Timeline & Progress Bar - Research

**Researched:** 2026-09-01
**Domain:** React 18 播放页 Timeline 组件 — 原生 `<input type="range">` 交互、offset-inclusive 时间显示、Cue 密度分桶可视化
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**拖拽反馈与持久化**
- **D-01:** Timeline 采用实时预览。拖动过程中立即更新当前时间、PlaybackEngine 位置和字幕画面；拖动过程中不逐帧持久化 Session。
- **D-02:** 拖拽结束时提交最终位置并触发一次 Session 持久化；沿用 Phase 7 的 `usePlaybackEngine.seek(targetMs)` 与 offset-inclusive 时间空间。
- **D-03:** 播放中拖拽后保持连续播放，暂停中拖拽后保持暂停，并立即显示目标 Cue 或空白。

**Timeline 视觉层级**
- **D-04:** 使用细线轨道和高亮已播放段，优先适配影院暗场和低干扰场景。
- **D-05:** 已播放段使用现有高对比度白色，未播放段使用暗灰色；不把 Timeline 设计成高亮彩色主视觉。
- **D-06:** 静止状态隐藏独立拖拽手柄；触摸、拖动或鼠标悬停时显示位置手柄。

**Cue 密度标记**
- **D-07:** Cue 标记按固定时间桶聚合，避免长字幕文件在窄 Timeline 上产生过多标记。
- **D-08:** 时间桶密度使用低、中、高三档亮度表达；密度标记作为轨道底层，已播放段和当前进度优先显示。
- **D-09:** 没有 Cue 的时间桶不绘制标记，保留字幕空档的清晰可见性；低密度桶也按实际密度分级，不提升为最高亮度。

**移动端与可访问性**
- **D-10:** 以原生 `<input type="range">` 作为交互与可访问性基础；Cue 标记和轨道视觉层可独立绘制，但不接管 range 的语义和输入。
- **D-11:** 保持细线视觉，同时提供更大的透明触控区域；触摸或键盘聚焦时显示位置手柄，不因触控区域扩大而改变页面布局。
- **D-12:** 键盘左右方向键每次移动 5 秒，目标仍夹紧在 `[0, totalDurationMs]`。
- **D-13:** 屏幕阅读器暴露"当前时间 / 总时长"的可访问名称或值，例如"播放进度，1:12 / 2:05"；拖动时不播报当前字幕正文。

**the agent's Discretion**
- 固定时间桶的具体数量或时间跨度由实现者根据 `totalDurationMs`、Timeline 宽度和可读性确定，但必须保持标记数量稳定并使用 D-07 至 D-09 的聚合与层级规则。
- 轨道、手柄和密度标记的具体 CSS 实现由实现者决定，但必须保留原生 range 的键盘/读屏语义和暗场低亮度表现。

### Deferred Ideas (OUT OF SCOPE)
- `playback-toolbar-layout.md` — 已确认属于 Phase 10 的 Control Layering & Settings Drawer，不并入 Phase 8。
- 手势导航属于 Phase 9（UI-04/UI-05）；控制区收纳、自动隐藏改进属于 Phase 10（UI-06/UI-07/UI-08）。
- 缩略图、Tooltip、视频预览在 REQUIREMENTS.md 中明确列为 Out of Scope。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Timeline 进度条组件 — 拖拽定位，左侧当前时间、右侧总时长（复用 `formatElapsedHMS()`） | 位置显示沿用 SessionBanner 的 `sessionElapsedMs(session, now)` + 定时刷新模式；时间格式直接复用 `formatElapsedHMS()`（负值自动钳到 0:00:00）[VERIFIED: src/playback/session.ts] |
| UI-02 | Timeline 拖拽 Seek — 播放中无缝继续、暂停中实时更新字幕、松手持久化 Session | 双路径 seek：新增 hook 级 `previewSeek`（仅 engine，无 setSession）用于拖拽预览 + 现有 `seek`（engine+session，触发既有 persist effect）用于提交 [VERIFIED: src/hooks/usePlaybackEngine.ts] |
| UI-03 | Timeline 上显示 Cue 标记点 — 字幕密度指示器 | 纯函数 `computeCueDensityBuckets(cues, totalDurationMs, bucketCount)` 按 D-07~D-09 聚合，可在 node 环境 Vitest 下完整单测 |
</phase_requirements>

## Summary

Phase 8 的全部引擎与数据基础设施已由 Phase 7 交付并验证（117 tests green, `tsc --noEmit` clean）：`usePlaybackEngine.seek(targetMs)` 原子更新 engine 与 session，`seekSession()` 保证 `sessionElapsedMs` 立即等于目标值，`ParsedSubtitle.metadata.totalDurationMs` 已贯通导入与重建路径。本阶段的真正工作是 **UI 层**：一个基于原生 `<input type="range">` 的 Timeline 组件、一个纯函数密度分桶模块、以及 `usePlaybackEngine` 上一个新增的 **engine-only 预览 seek 入口**。

研究发现了两个必须在计划中显式处理的架构问题。**第一，现有 `seek()` 不能直接用于拖拽预览**：它每次调用都会 `setSession` 生成新 session 对象，触发既有 persist effect 写 IndexedDB——逐帧调用违反 D-01/07-D-09（拖拽中间帧不写 IndexedDB）。必须新增 `previewSeek(targetMs)`（只调 `engineRef.current?.seek()`，不触碰 session），拖拽提交时才走现有 `seek()` 完成一次持久化。**第二，播放态拖拽到末尾会中途触发引擎自动停止**：`PlaybackEngine.tick()` 在 `elapsed >= lastCue.end` 且无活动 cue 时调用 `stop()` + `onEnded()`，hook 的 onEnded 闭包会清空 session 并把状态收敛为 idle——Timeline 在拖拽中途卸载、播放中断。预览路径必须把目标钳制在 `totalDurationMs - 1`（或末 cue end 之前），只有提交路径允许命中精确末端（保持 07-D-03 语义）。

其余部分是成熟的 Web 标准实践：WebKit/Firefox 双伪元素轨道填充（CSS 自定义属性 + linear-gradient）、`step="any"` 避免拖拽吸附、`onKeyDown` 自定义 5 秒步进（`step=5000` 会让拖拽也吸附，不可用，MDN 已确认 step 作用于所有用户交互）、`aria-valuetext` 承载 "1:12 / 2:05" 可读值、`touch-action: none` 防触摸滚动干扰。零新依赖约束完全可行——本阶段不需要安装任何包。

**Primary recommendation:** 新建 `Timeline.tsx` 组件 + `src/playback/` 纯函数模块（密度分桶 + 钳制），hook 新增 `previewSeek`，拖拽 = preview + pointerup 提交，键盘 = 直接提交；所有视觉层叠加在原生 range 之下，不接管其语义。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 当前位置显示与刷新 | Frontend（组件内 interval/rAF 读 session） | — | 双时钟规则：UI 显示读 wall-clock session（`sessionElapsedMs`），绝不读 engine 内部时钟 [VERIFIED: src/playback/session.ts 头注释] |
| Seek 执行（引擎+会话原子更新） | API/Hook（`usePlaybackEngine.seek`） | PlaybackEngine | Phase 7 已交付的唯一入口；Timeline 不得分别操作 engine 与 session [VERIFIED: 07-01-SUMMARY.md] |
| 拖拽预览（不持久化） | API/Hook（新增 `previewSeek`） | PlaybackEngine | D-01 要求引擎位置与字幕画面实时更新但不逐帧持久化；engine-only 路径绕开 persist effect |
| Session 持久化 | Hook 既有 persist effect | IndexedDB | 语义变化驱动；Phase 8 **不得**新增任何 `saveSession` 调用点 [VERIFIED: src/hooks/usePlaybackEngine.ts L173-181] |
| Cue 密度分桶 | 纯函数模块（`src/playback/`） | — | 输入输出均为纯数据，node 环境 Vitest 可完整验证，符合项目既有测试模式 |
| 总时长与钳制边界 | 数据层（`ParsedSubtitle.metadata.totalDurationMs`） | 组件钳制逻辑 | ENG-03 已交付；所有 seek 目标钳到 `[0, totalDurationMs]`（07-D-02） |
| 视觉层（轨道/密度/手柄） | CSS（`src/index.css` 扩展） | 组件结构 | 视觉层叠在原生 range 之下，不接管语义（D-10） |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | ^18.3.1 | 组件与受控 input | 已安装；受控 range 的 onChange 等价浏览器 input 事件，拖拽中连续触发 [VERIFIED: Context7 /reactjs/react.dev] |
| 原生 `<input type="range">` | Web 平台 | 交互与 a11y 基础 | D-10 锁定；ARIA slider 指南明确"优先原生控件" [CITED: reactspectrum useSlider / equalweb ARIA pattern] |
| Vitest | ^4.1.10 | 纯函数单测 | 已安装；node 环境，117 tests 609ms [VERIFIED: npm test 本机运行] |
| TypeScript | ^5.6.3 | 类型检查 | 已安装；`tsc --noEmit` clean [VERIFIED: 本机运行] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| （无新增） | — | 零新依赖约束 | v1.2 research 锁定：extend existing patterns。CSS 伪元素 + 自定义属性覆盖全部视觉需求 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 原生 range + CSS 伪元素 | `<canvas>` 绘制轨道与标记 | canvas 需要手动重绘/DPR 处理/无障碍重建，与 D-10 冲突；放弃 |
| 自定义 `role="slider"` div | 原生 input | 需手工复刻完整键盘/读屏契约，D-10 明确禁止接管语义；放弃 |
| 自建 Pointer Events 拖拽 | 原生 range 拖拽 | 原生 range 自带指针捕获与边界钳制；自建徒增 iOS Safari 兼容风险 |
| hook 透传 engine 引用 | hook 新增 `previewSeek` 方法 | 透传 engine 破坏 hook 封装（engineRef 私有）；方法入口与既有 `seek` 对称 |

**Installation:**
```bash
# 无需安装 — 零新依赖
```

## Package Legitimacy Audit

> 本阶段 **不安装任何外部包**（v1.2 research 锁定的零新依赖约束；D-01~D-13 全部决策均可由现有依赖 + Web 平台能力满足）。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （无新增包） | — | — | — | — | — | N/A |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                     ┌────────────────────────────────────────────────────┐
                     │                    App.tsx                         │
                     │  subtitle.metadata.totalDurationMs  cues  settings │
                     └───────┬───────────────────────────────┬────────────┘
                             │ props                          │ (无 seek 解构, 需补)
                             ▼                                ▼
              ┌──────────────────────────┐      ┌──────────────────────────┐
              │   PlaybackControls.tsx   │      │  usePlaybackEngine.ts    │
              │  (playing/paused 分支)    │─────▶│  seek()  [Phase 7 已有]  │──▶ engine.seek + setSession
              │        + Timeline.tsx    │      │  previewSeek() [Phase 8  │    └─▶ persist effect
              └───────┬──────────────────┘      │   新增: 仅 engine.seek,  │         → IndexedDB (仅语义变化)
                      │                          │   不 setSession)         │
                      ▼                          └──────────────────────────┘
   ┌─────────────────────────────────────────┐
   │             Timeline.tsx                │
   │                                         │
   │  [当前时间]  ┌────────────────┐  [总时长] │
   │  h:mm:ss     │  视觉层叠结构    │  h:mm:ss │
   │              │  ┌───────────┐  │          │
   │              │  │ 密度标记层 │  │◀── 纯函数 │
   │              │  ├───────────┤  │  computeCueDensityBuckets()
   │              │  │ 已播放填充 │  │          │
   │              │  ├───────────┤  │          │
   │              │  │ input[type │  │          │
   │              │  │  =range]   │  │◀── 唯一交互源 (D-10)
   │              │  └───────────┘  │          │
   │              └────────────────┘          │
   └─────────────────────────────────────────┘

   数据流:
   ① 播放中显示: interval/rAF → sessionElapsedMs(session, Date.now()) → value prop
   ② 拖拽预览:   onChange(pointerdown 期间) → previewSeek(clamp(v)) → engine 更新
                 → 引擎 tick/onCueChange → 字幕画面实时刷新 (session 不变, 不写库)
   ③ 松手提交:   onPointerUp → seek(final) → engine + setSession → persist 一次
   ④ 键盘步进:   onKeyDown(←/→, preventDefault) → seek(clamp(v ± 5000)) → 直接提交
```

### Recommended Project Structure
```
src/
├── components/
│   ├── Timeline.tsx          # 新增: Timeline 组件（时间标签 + 轨道 + 密度层 + range 输入）
│   └── PlaybackControls.tsx  # 修改: playing/paused 分支内渲染 <Timeline/>，透传新 props
├── playback/
│   └── timelineDensity.ts    # 新增: computeCueDensityBuckets() 纯函数 + 钳制助手
├── hooks/
│   └── usePlaybackEngine.ts  # 修改: 新增 previewSeek(targetMs)（engine-only，无 setSession）
├── i18n/
│   └── translations.ts       # 修改: 新增 timeline 相关键（en + zh）
src/index.css                 # 修改: Timeline 轨道/手柄/密度层样式（暗场低亮度）
test/unit/
└── timelineDensity.test.ts   # 新增: 密度分桶 + 钳制单测
```

### Pattern 1: 双路径 Seek（预览 + 提交）
**What:** 拖拽期间走 engine-only 预览，松手走完整 seek（engine + session + 持久化）。
**When to use:** 所有满足"实时预览但不逐帧持久化"的连续输入场景（D-01/D-02、07-D-09）。
**Example:**
```typescript
// src/hooks/usePlaybackEngine.ts — 新增（与既有 seek 完全对称）
const previewSeek = useCallback((targetMs: number) => {
  // 仅引擎：立即更新字幕画面（playing: 下一帧 tick 捕获新 cue；
  // paused: seek 内部立即 findActiveCue + onCueChange）。
  // 刻意不调用 setSession —— persist effect 由 session 对象身份变化驱动，
  // 不触碰 session 即零 IndexedDB 写入（D-01, 07-D-09）。
  engineRef.current?.seek(targetMs)
}, [])

// 提交路径复用 Phase 7 已有 seek（engine + session 原子更新 → 既有 persist effect 落库一次）
const seek = useCallback((targetMs: number) => {
  engineRef.current?.seek(targetMs)
  setSession((prev) => (prev ? seekSession(prev, targetMs, Date.now()) : prev))
}, [])

return { state, play, pause, stop, seek, previewSeek, session, resyncToSession, restoreSession }
```

### Pattern 2: 拖拽期间显示值与拖拽值隔离（防止 thumb 回跳）
**What:** 受控 range 在拖拽期间 value 必须来自拖拽状态，否则位置 ticker 的重渲染会把 thumb 拉回时钟位置。
**When to use:** 任何"受控 slider + 独立位置刷新源"组合。
**Example:**
```tsx
// src/components/Timeline.tsx — 核心状态机
const [isDragging, setIsDragging] = useState(false)
const [dragValue, setDragValue] = useState(0)

// 非拖拽: 位置来自 session wall-clock（SessionBanner 既有模式, 1s interval）
// 拖拽中: value = dragValue（用户手势主权）
const displayValue = isDragging ? dragValue : clampToDuration(sessionElapsedMs(session, Date.now()), totalMs)

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = clampToDuration(Number(e.target.value), totalMs)
  if (isDragging) {
    setDragValue(v)
    onPreviewSeek(v)                       // 预览: engine-only
  } else {
    onSeek(v)                              // 键盘 PageUp/Home/End 等: 离散提交
  }
}

const handlePointerDown = () => { setIsDragging(true); setDragValue(displayValue) }
const handlePointerUp = () => {
  if (!isDragging) return
  setIsDragging(false)
  onSeek(dragValue)                        // D-02: 提交一次, 触发一次持久化
}
```

### Pattern 3: 键盘 5 秒步进（D-12）— 不能用 `step=5000`
**What:** MDN 确认 range 的 step 吸附作用于**所有**用户输入（含指针拖拽）："the user agent may round off the value to the nearest valid value"。`step=5000` 会把拖拽也吸附成 5 秒台阶。必须 `step="any"`（禁用一切吸附）+ `onKeyDown` 自定义方向键步进。
**When to use:** 键盘步进量 ≠ 拖拽精度的任何 slider。
**Example:**
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()                     // 拦截原生步进（step=any 下量值不可控）
    const delta = e.key === 'ArrowLeft' ? -KEYBOARD_STEP_MS : KEYBOARD_STEP_MS // 5000
    const next = clampToDuration(currentValue + delta, totalMs)   // D-12 钳制
    onSeek(next)                           // 离散动作直接提交 + 持久化（语义变化）
  }
  // Home/End 交给原生行为（到 min/max），其触发的 onChange 走"无 pointerdown → 提交"分支
}

<input
  type="range" min={0} max={totalMs} step="any"
  value={displayValue}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  onPointerDown={handlePointerDown}
  onPointerUp={handlePointerUp}
  aria-label={t('timelineLabel')}                          // "播放进度" / "Playback progress"
  aria-valuetext={`${formatElapsedHMS(displayValue)} / ${formatElapsedHMS(totalMs)}`}
  style={{ '--pos-percent': `${(displayValue / totalMs) * 100}%` } as React.CSSProperties}
/>
```

### Pattern 4: 密度分桶纯函数（D-07/D-08/D-09）
**What:** 固定桶数把 `[0, totalDurationMs]` 均分，每个桶统计重叠 cue 数并映射三档亮度；空桶不产生标记。
**When to use:** 任意长字幕文件在固定宽度轨道上的稳定密度可视化。
**Example:**
```typescript
// src/playback/timelineDensity.ts — 纯函数, node 环境可完整单测
export interface DensityBucket { startMs: number; endMs: number; tier: 0 | 1 | 2 } // tier 0 = 空

/** cues 依解析器保证有序; bucketCount 固定（如 100）→ 标记数量稳定（D-07/D-08） */
export function computeCueDensityBuckets(cues: Cue[], totalDurationMs: number, bucketCount: number): DensityBucket[] {
  if (totalDurationMs <= 0 || cues.length === 0 || bucketCount <= 0) return []
  const bucketMs = totalDurationMs / bucketCount
  const counts = new Array<number>(bucketCount).fill(0)
  for (const cue of cues) {
    const first = Math.max(0, Math.floor(cue.start / bucketMs))
    const last = Math.min(bucketCount - 1, Math.floor((cue.end - 1) / bucketMs))
    for (let i = first; i <= last; i++) counts[i]++
  }
  const max = Math.max(...counts)
  return counts.map((count, i) => ({
    startMs: i * bucketMs,
    endMs: (i + 1) * bucketMs,
    // D-09: 空桶 tier 0（不渲染）; 非空按相对密度三档分级, 低密度不提升为最高亮度
    tier: (count === 0 ? 0 : Math.ceil((count / max) * 2)) as 0 | 1 | 2,
  }))
}
```

### Pattern 5: 轨道填充的跨浏览器 CSS（已播放段白色 / 未播放暗灰, D-04/D-05）
**What:** Firefox 有原生 `::-moz-range-progress`；WebKit 系用 CSS 自定义属性 + linear-gradient 在 track 上画已播放段。密度标记层绝对定位在透明 track 的 range 之下（D-08 层级）。
**Example:**
```css
/* src/index.css 追加 — 复用现有色板: #e0e0e0(白) / #222 #333 #444(暗灰) */
.timeline { flex-basis: 100%; display: flex; align-items: center; gap: 8px; }
.timeline-track-wrap { position: relative; flex: 1; }   /* 不改变页面布局的层叠容器 */

.timeline-markers { position: absolute; inset: auto 0 50% 0; height: 6px;
  transform: translateY(50%); display: flex; pointer-events: none; }
.timeline-marker { flex: 1; background: #555; }          /* 轨道底层 */
.timeline-marker.tier-1 { opacity: 0.35; }               /* 低密度（暗场低亮度） */
.timeline-marker.tier-2 { opacity: 0.65; }
.timeline-marker.tier-3 { opacity: 1; }
/* tier-0 空桶不渲染 DOM（D-09: 空档清晰可见） */

.timeline-slider { -webkit-appearance: none; appearance: none; width: 100%;
  background: transparent; touch-action: none;           /* 防触摸滚动干扰拖拽 */
  /* 透明触控区: padding 扩大命中区, 负 margin 抵消避免布局位移 (D-11) */
  padding: 12px 0; margin: -12px 0; }

.timeline-slider::-webkit-slider-runnable-track { height: 3px; border-radius: 2px;
  background: linear-gradient(to right, #e0e0e0 0%, #e0e0e0 var(--pos-percent, 0%),
                                       #333 var(--pos-percent, 0%), #333 100%); }
.timeline-slider::-moz-range-track { height: 3px; background: #333; }
.timeline-slider::-moz-range-progress { height: 3px; background: #e0e0e0; }

.timeline-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: #e0e0e0; margin-top: -5.5px;
  opacity: 0; transition: opacity 0.15s ease; }          /* D-06: 静止隐藏手柄 */
.timeline-slider::-moz-range-thumb { width: 14px; height: 14px; border: none;
  border-radius: 50%; background: #e0e0e0; opacity: 0; transition: opacity 0.15s ease; }
.timeline-slider:hover::-webkit-slider-thumb,
.timeline-slider:active::-webkit-slider-thumb,
.timeline-slider:focus-visible::-webkit-slider-thumb { opacity: 1; }   /* D-06/D-11 */
.timeline-slider:hover::-moz-range-thumb,
.timeline-slider:active::-moz-range-thumb,
.timeline-slider:focus-visible::-moz-range-thumb { opacity: 1; }
.timeline-slider:focus-visible { outline: 1px solid #666; outline-offset: 4px; }
```

### Anti-Patterns to Avoid
- **用现有 `seek()` 做拖拽预览：** 每帧 `setSession` → persist effect 每帧写 IndexedDB，违反 D-01/07-D-09，且有电池/配额放大风险（hook 注释明示 "zero write amplification" 设计意图）。必须走 engine-only `previewSeek`。
- **用 `step=5000` 实现键盘 5 秒步进：** step 吸附作用于所有输入（MDN [VERIFIED]），拖拽会被吸附成 5 秒台阶，破坏精确定位。用 `step="any"` + `onKeyDown`。
- **拖拽期间把位置 ticker 的值灌进受控 value：** thumb 与用户手势搏斗（回跳）。`isDragging ? dragValue : clockValue`。
- **在 Timeline 组件内直接调 `saveSession`：** 持久化只属于 hook 的语义变化 effect；Timeline 只经 `seek()` 间接触发。新增持久化调用点会破坏 "Session 持久化由语义状态变化触发" 的既有模式。
- **密度标记覆盖已播放段之上：** D-08 明确标记是轨道底层；已播放段（白色填充）与当前进度优先显示。层叠顺序：markers(z:0) < played-fill(track 背景) < input 拖拽层。
- **读 engine 内部时钟（`performance.now()`）做显示：** 双时钟规则 — UI 显示只读 session wall-clock（`sessionElapsedMs`）；engine 时钟仅属于引擎。混用会在 offset 变化/暂停恢复时漂移。
- **totalDurationMs=0 时仍渲染可交互 range：** 07-02 明确 "无有效字幕时 Timeline 应禁用拖拽"；max=0 的 range 还会造成除零（`--pos-percent` 计算）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 时间格式化 | 自写 mm:ss 拼接 | `formatElapsedHMS()`（已存在，负值钳 0:00:00） | UI-01 锁定复用；边界行为已被 session.test.ts 覆盖 [VERIFIED: src/playback/session.ts L167-172] |
| Seek 目标钳制 | 各处散落 Math.min/max | 单一 `clampToDuration()` 纯函数（放 timelineDensity.ts） | 07-D-02 锁定 `[0, totalDurationMs]` 全入口统一钳制；单点可测 |
| 位置读取 | 从 engine 读 `performance.now()` 或自算 elapsed | `sessionElapsedMs(session, Date.now())` | offset-inclusive 空间（D-11）；与 SessionBanner/ResumeCard 一致 [VERIFIED: src/playback/session.ts L84-90] |
| slider 键盘/读屏语义 | 自建 role="slider" + 全套键盘表 | 原生 `<input type="range">`（D-10 锁定） | 原生控件自带完整契约；ARIA 指南"优先原生" [CITED: equalweb ARIA slider pattern] |
| 持久化路径 | Timeline 内调 saveSession | 既有 hook persist effect（经 `seek()` 间接触发） | Phase 6 建立的语义变化驱动写入 + hasPersistedRef 守卫，不可旁路 [VERIFIED: src/hooks/usePlaybackEngine.ts L161-181] |
| 拖拽指针跟踪 | 自建 pointermove 换算 | 原生 range 拖拽（自带捕获与边界） | 浏览器已处理指针捕获/越界/触摸；自建徒增 iOS 兼容面 |

**Key insight:** Phase 7 已把全部困难部分（seek 双路径、会话重锚定、持久化时机、总时长派生）做成了经过测试的纯接口。Phase 8 的增值全在 UI 层与两个小纯函数；任何"重新实现引擎侧逻辑"的冲动都是错误的分层。

## Common Pitfalls

### Pitfall 1: 拖拽预览逐帧写 IndexedDB（违反 D-01）
**What goes wrong:** 直接在 onChange 里调现有 `seek()` → 每帧 `setSession` 新对象 → persist effect 每帧 `saveSession()`。
**Why it happens:** hook 的 seek 是"engine+session 原子更新"设计，为离散定位而非连续输入而生。
**How to avoid:** hook 新增 `previewSeek`（engine-only）；onChange 拖拽分支只调 previewSeek；pointerup 才调 seek。
**Warning signs:** 执行中 IndexedDB 写入频率 = 拖拽帧率；D-01 人工验证不通过。

### Pitfall 2: 播放态拖拽越过末尾导致播放中断、Timeline 卸载
**What goes wrong:** 预览目标 ≥ 末 cue end 时，引擎下一帧 tick 命中自动停止分支（`elapsed >= cues[last].end && activeIndex === -1` → `stop()` + `onEnded()`）→ session 清空 → 状态 idle → Timeline 中途卸载，拖拽手势丢失。[VERIFIED: src/playback/PlaybackEngine.ts L184-191 + src/hooks/usePlaybackEngine.ts L192-195]
**Why it happens:** 07-D-03 的"定位到总时长立即结束"语义在引擎 tick 内实现，预览路径复用同一 seek 就会触发。
**How to avoid:** 预览目标钳制到 `Math.min(target, totalDurationMs - 1)`（或末 cue end - 1）；提交路径不钳（命中精确末端 = 合法的"立即结束"，保持 07-D-03）。
**Warning signs:** 播放中拖到进度条右端附近时画面突然回选择页。

### Pitfall 3: `step=5000` 同时吸附拖拽
**What goes wrong:** 键盘 5 秒步进用 step 属性实现 → 拖拽值被吸附到 5 秒网格，无法精确定位。
**Why it happens:** 误以为 step 只影响键盘。MDN 明示 UA 会对任何不合规的用户输入值取整到最近合法值。[CITED: MDN `<input type="range">` step — "the user agent may round off the value to the nearest valid value"]
**How to avoid:** `step="any"` + `onKeyDown` 自定义 ±5000ms（Pattern 3）。
**Warning signs:** 拖拽时 thumb 跳格。

### Pitfall 4: 受控 value 与位置 ticker 冲突（thumb 回跳）
**What goes wrong:** 拖拽中 interval/rAF 刷新位置 state 重渲染组件，受控 value 回到时钟位置，thumb 往回跳。
**Why it happens:** 拖拽值与显示值共用一个来源。
**How to avoid:** `isDragging` 分流（Pattern 2）；拖拽中 value=dragValue。
**Warning signs:** 拖拽时 thumb 抖动/回弹。

### Pitfall 5: 键盘 PageUp/Home/End 触发 onChange 却永不提交
**What goes wrong:** 所有 onChange 都按"预览"处理，但这些键没有 pointerup → 值只预览不持久化。
**Why it happens:** 拖拽提交模型（pointerup）未覆盖键盘路径。
**How to avoid:** 规则化分派：`isDragging(pointerdown 活跃)` → preview；否则 → 直接 commit（Pattern 2 的 handleChange）。←/→ 被 preventDefault 拦截后走 onKeyDown 自身提交，不产生 onChange。
**Warning signs:** 键盘 seek 后刷新，位置回到旧值。

### Pitfall 6: `--pos-percent` 除零
**What goes wrong:** `totalMs=0`（无有效 cue）时 `(displayValue / totalMs) * 100` 产生 NaN/Infinity。
**Why it happens:** 未守卫空字幕文件边界（07-D-07 场景）。
**How to avoid:** `totalMs <= 0` 时渲染禁用的 Timeline（或隐藏 range 交互）；分母守卫 `totalMs > 0 ? ... : 0`。
**Warning signs:** 控制台 NaN 警告、轨道样式失效。

### Pitfall 7: 密度桶边界遗漏（cue 恰好跨桶界 / end 恰在桶界）
**What goes wrong:** 用 `floor(cue.end / bucketMs)` 把 end 恰在桶界的 cue 算进下一桶，或重叠 cue（解析器保留原序，07-D-06）导致桶计数语义混乱。
**Why it happens:** 半开区间处理不严谨。
**How to avoid:** 统一半开区间 `[start, end)`：桶索引 `floor(start/bucketMs)` 到 `floor((end-1)/bucketMs)`（end-1 保证 end 恰在界上不溢出）；重叠 cue 按数组顺序各自计入（不重排，遵循 07-D-06）。
**Warning signs:** 单测中边界 cue 的桶归属与预期差一桶。

### Pitfall 8: iOS Safari 原生 range 拖拽的偶发松手
**What goes wrong:** 社区报告 iOS Safari 在 range 拖拽中偶发自发中断 drag（拖到一半值锁定）。[ASSUMED — 论坛级证据，需真机验证]
**Why it happens:** 移动 Safari 的触摸手势仲裁历史问题。
**How to avoid:** `touch-action: none` 于输入元素；真机手动验证列入 Phase 验证清单（已在多份社区资料中作为标准防御）。
**Warning signs:** 真机拖拽中 `onPointerUp` 提前触发。

## Code Examples

Verified patterns from official sources & codebase:

### 位置显示（SessionBanner 既有模式 — UI-01 直接套用）
```tsx
// Source: src/components/SessionBanner.tsx L30-41 (VERIFIED: codebase)
const [now, setNow] = useState(Date.now())
useEffect(() => {
  if (status !== 'playing') return                    // 仅播放态刷新
  const interval = setInterval(() => setNow(Date.now()), 1000)
  return () => clearInterval(interval)
}, [status])

const time = formatElapsedHMS(sessionElapsedMs(session, now))
```
> Timeline 可用更快的刷新（250ms）+ CSS `transition` 平滑填充条；实现者裁量。paused 态无 interval 时，`sessionElapsedMs` 在提交 seek 后的重渲染中立即给出新值（seekSession 保证 `sessionElapsedMs === targetMs`）[VERIFIED: 07-01-SUMMARY.md]。

### offset-inclusive 空间中的钳制助手
```typescript
// 07-D-02: 所有定位入口统一钳制 [0, totalDurationMs]
export function clampToDuration(targetMs: number, totalDurationMs: number): number {
  if (!Number.isFinite(targetMs)) return 0
  return Math.min(Math.max(targetMs, 0), Math.max(0, totalDurationMs))
}
```

### i18n 键新增（en + zh 对称）
```typescript
// src/i18n/translations.ts — en 块
timelineLabel: 'Playback progress',
// zh 块
timelineLabel: '播放进度',
// 用法: aria-label={t('timelineLabel')} + aria-valuetext="1:12 / 2:05"
// 读屏播报: "播放进度, 1:12 / 2:05"（D-13 示例精确匹配）
```

### Props 透传链（App → PlaybackControls → Timeline）
```tsx
// App.tsx: 解构需补 seek/previewSeek（当前未解构, L52）
const { state: playbackState, play, pause, stop, seek, previewSeek, session, ... } = usePlaybackEngine(...)

// PlaybackControls 新 props:
interface TimelineProps {
  session: PlaybackSession | null
  status: PlaybackStatus
  cues: Cue[]
  totalDurationMs: number
  onSeek: (targetMs: number) => void
  onPreviewSeek: (targetMs: number) => void
}
// 密度数据在 Timeline 内 useMemo(computeCueDensityBuckets, [cues, totalDurationMs])
// 注: App 中 PlaybackControls 有两个挂载点（playback 视图 + ready 视图 idle 态）；
// Timeline 只放进 playing/paused 分支，ready 视图实例永远 idle → 不受影响 [VERIFIED: src/App.tsx L493]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `::-ms-fill-lower`（IE/EdgeHTML） | 已废弃，无需 -ms 前缀 | Edge Chromium 化（~2020） | CSS 只需 webkit + moz 两组伪元素 [CITED: css-tricks.com] |
| range `step` 固定网格 | `step="any"` + 自定义键盘步进 | 长期标准 | 键盘/拖拽精度解耦的正确姿势 [CITED: MDN] |
| 自建 slider div + ARIA 全套 | 原生 input 优先 | WAI-ARIA 指南一贯立场 | D-10 与业界共识一致 [CITED: equalweb ARIA patterns] |
| CSS `accent-color` 快速着色 | 完整伪元素定制（需要分层视觉时） | accent-color ~2021 | 字体滑杆用 accent-color 即可；Timeline 需要叠加密度层 → 必须走伪元素 + 透明轨道 [VERIFIED: src/index.css L275-278] |

**Deprecated/outdated:**
- `-ms-track` / `-ms-fill-lower`：不再需要（本项目目标为现代移动 PWA）。
- `input[type=range]` 上默认外观：任何自定义 thumb/track都必须先 `appearance: none`（webkit 需 `-webkit-appearance: none`，含 thumb）。

## Runtime State Inventory

> 不适用 — 本阶段为纯 UI 新增（greenfield 组件），无 rename/refactor/migration。无存储数据、无活服务配置、无 OS 注册态、无密钥变更、无构建产物影响。明确声明：**五个类别均为"无"**（Phase 7 的 IndexedDB session/subtitle 记录结构不变，Phase 8 只读不写新字段）。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Safari 原生 range 拖拽存在偶发自发中断（`touch-action: none` 可缓解） | Pitfall 8 / Environment | 低 — 若真机无此问题则防御性 CSS 无害；若存在且未缓解，拖拽体验降级但不丢数据 |
| A2 | `onPointerUp` 在原生 range 触摸拖拽中可靠地派发到 input 元素（浏览器内部指针捕获） | Pattern 2 | 中 — 若个别浏览器不派发，拖拽结束不提交；缓解：`onBlur`/`onPointerLeave` 兜底提交未提交的 dragValue（建议计划中直接内置兜底） |
| A3 | 100 桶默认值在常见手机宽度（~320-400px track）下密度标记可读 | Pattern 4 | 低 — 实现者裁量项（CONTEXT 已授权）；真机检查即可调整 |
| A4 | 提交 seek 命中精确 totalDurationMs 时播放态立即结束为期望行为（07-D-03 锁定语义，本阶段不改变） | Pitfall 2 | 低 — 已由 Phase 7 决策锁定；仅预览路径钳制规避 |

**A1/A2 均为真机验证项**：建议计划中把"真机（或 DevTools 触摸模拟）拖拽验证"列为 phase 收尾的人工验证任务。

## Open Questions

1. **位置刷新频率与平滑策略（interval vs rAF）**
   - What we know: SessionBanner 用 1s interval（既有先例）；填充条 1s 跳变肉眼可见。
   - What's unclear: 250ms interval + CSS transition 是否足够顺滑，还是需要 rAF。
   - Recommendation: 先按 250ms interval + `transition: width 0.25s linear` 实现（实现者裁量范围内）；真机验收不达标再升级 rAF。**不要**为此引入任何新依赖。

2. **密度分桶的档位阈值（相对 vs 固定）**
   - What we know: D-09 要求低密度不提升为最高亮度；三档边界未锁定。
   - What's unclear: `ceil(count/max*2)` 相对分级在极端分布（单桶独高）下的观感。
   - Recommendation: 用相对分级起步（对文件规模鲁棒），单测固定边界行为；观感属实现者裁量。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest/tsc 运行 | ✓ | v22.23.2 | — |
| npm | 脚本执行 | ✓ | 10.9.8 | — |
| Vitest | 纯函数单测 | ✓ | ^4.1.10（node env） | — |
| TypeScript | `tsc --noEmit` 检查 | ✓ | ^5.6.3（当前 clean） | — |
| 浏览器 DevTools 触摸模拟 | 拖拽/键盘人工验证 | ✓（开发机） | — | 真机验证（推荐，A1/A2） |

**Missing dependencies with no fallback:** 无。
**Missing dependencies with fallback:** 无。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10（node 环境，无 jsdom / 无 @testing-library） |
| Config file | vitest.config.ts（`include: ['test/**/*.test.ts']`, `environment: 'node'`） |
| Quick run command | `npx vitest run test/unit/timelineDensity.test.ts` |
| Full suite command | `npm test`（117 tests，609ms） |

> **关键约束**：测试环境为 node —— 组件渲染行为（thumb 显隐、层叠、真机拖拽）**无法**自动测试。遵循项目既有模式：把全部可测逻辑抽成纯函数（密度分桶、钳制、键盘步进计算），组件壳保持薄。**不要**为组件测试引入 jsdom/@testing-library —— 与零新依赖约束冲突。

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | 时间显示复用 `formatElapsedHMS`（负值钳 0:00:00） | unit（既有） | `npx vitest run test/unit/session.test.ts` | ✅ |
| UI-01 | 位置钳制 `clampToDuration` | unit | `npx vitest run test/unit/timelineDensity.test.ts -t clamp` | ❌ Wave 0 |
| UI-02 | seek 目标钳制 + 预览/提交分离（engine-only preview 不产生 session 对象） | unit + 人工 | `npx vitest run test/unit/playbackEngine.test.ts`（engine 路径既有覆盖）+ 真机拖拽验证（human_judgment） | 部分（preview 分离为人工项） |
| UI-02 | 播放态提交末端 → 立即结束清会话（07-D-03 不回退） | unit（既有） | `npx vitest run test/unit/playbackEngine.test.ts -t seek` | ✅ |
| UI-03 | 密度分桶：空文件/单 cue/跨桶 cue/空桶无标记/三档分级/重叠 cue 原序计入 | unit | `npx vitest run test/unit/timelineDensity.test.ts` | ❌ Wave 0 |
| UI-01/02/03 | 组件集成（thumb 显隐、aria-valuetext、层叠、真机触摸/键盘） | manual-only | 真机或 DevTools 触摸模拟； justification: node 测试环境无法渲染组件，jsdom 引入违反零依赖约束 | — |

### Sampling Rate
- **Per task commit:** `npx vitest run test/unit/timelineDensity.test.ts`（< 5s）
- **Per wave merge:** `npm test`（全套 117+ tests）
- **Phase gate:** 全套 green + `tsc --noEmit` clean + 真机拖拽人工验证清单通过后 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/unit/timelineDensity.test.ts` — 密度分桶 + clampToDuration 全部边界用例（UI-03 核心、UI-01 钳制）
- [ ] （无框架安装需求 — Vitest 已就绪）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本地 PWA，无账户体系 |
| V3 Session Management | no | "Session" 为播放会话（IndexedDB），非登录会话 |
| V4 Access Control | no | 单用户本地应用 |
| V5 Input Validation | yes | seek 目标钳制 `[0, totalDurationMs]`（单一 `clampToDuration`）；range 原生 min/max 双保险；IndexedDB 不可信数据已由 `isValidSession` 逐字段校验（既有）[VERIFIED: src/playback/session.ts L146-155] |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for 本项目 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意/畸形 SRT 产生极端数值（NaN/Infinity/越界）传入密度计算与 range | Tampering | 密度函数对 `totalDurationMs <= 0` 短路返回 `[]`；钳制函数拒绝非有限值；cue 时间已被解析器验证（start<end） |
| 密度标记 DOM 节点数随 cue 数爆炸（DoS 自伤） | DoS | **固定桶数**（D-07）→ DOM 节点数恒定 ≤ bucketCount，与文件大小解耦（5MB 导入上限已有） |
| IndexedDB 记录注入越界 pausedElapsedMs 导致 Timeline value 越界 | Tampering | 显示侧统一钳制（Pattern 2 的 `clampToDuration` 包裹 `sessionElapsedMs` 输出） |

> 无新增网络面、无新用户输入通道（slider 数值经原生控件 + 钳制）、无持久化格式变更。安全负担极小。

## Project Constraints (from AGENTS.md)

> 不存在 `./AGENTS.md`、`./CLAUDE.md`、`.claude/CLAUDE.md` 及 `.claude/skills/`、`.agents/skills/` 目录（已验证）。无额外项目级指令。生效约束来自 `.planning/config.json`：`tdd_mode: true`（纯函数先行测试）、`ui_phase/ui_review: true`（Phase 收尾含 UI 审查）、`commit_docs: true`。

## Sources

### Primary (HIGH confidence)
- 代码库直读（本 session 全文验证）：`src/playback/PlaybackEngine.ts`、`src/playback/session.ts`、`src/hooks/usePlaybackEngine.ts`、`src/components/PlaybackControls.tsx`、`src/components/SessionBanner.tsx`、`src/App.tsx`、`src/types/subtitle.ts`、`src/index.css`、`src/i18n/translations.ts`、`vitest.config.ts`
- MDN Web Docs — `<input type="range">`（step 吸附语义、`step="any"`）: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range
- `.planning/phases/07-engine-foundation/07-01-SUMMARY.md`、`07-02-SUMMARY.md`（Phase 7 交付契约）
- 本机实测：`npm test` 117 passed / 609ms；`tsc --noEmit` clean

### Secondary (MEDIUM confidence)
- Context7 `/reactjs/react.dev` — 受控 input onChange = input 事件语义
- CSS-Tricks "Styling Cross-Browser Compatible Range Inputs" + LogRocket + dev.to（webkit/moz 伪元素 + linear-gradient 填充惯例，三源一致）
- ARIA slider pattern（equalweb academy / React Spectrum useSlider）— 原生优先、aria-valuetext、自定义键增量
- use-gesture docs / interact.js #595 — `touch-action: none` 防拖拽滚动干扰

### Tertiary (LOW confidence)
- ObservableHQ 论坛 — iOS Safari range 拖拽偶发中断（社区轶事级，列入真机验证项 A1）

## Metadata

**Confidence breakdown:**
- 标准栈（零新依赖 + Web 平台）: HIGH — 全部为已安装依赖或平台能力，本机验证
- 代码契约（seek/持久化/时间空间）: HIGH — Phase 7 交付物全文直读
- 架构模式（预览/提交分离、双路径）: HIGH — 由 D-01/D-02 与代码事实共同推演，实现路径唯一
- CSS/A11y 技法: MEDIUM — 多源一致的社区标准，无官方 spec 级文档；真机验收兜底
- Pitfalls: HIGH — Pitfall 1/2/4/5/6/7 均由代码直读推出（非猜测）

**Research date:** 2026-09-01
**Valid until:** 2026-10-01（稳定：代码契约锁定，Web 平台技法变化慢）
