# Phase 8: Timeline & Progress Bar - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

为播放页增加可视化 Timeline：显示 offset-inclusive 的当前播放时间与字幕总时长，支持播放中和暂停中的拖拽定位，并通过时间桶密度标记帮助用户识别字幕分布。只实现 Timeline 与进度导航，不加入手势导航或设置面板分层。

</domain>

<decisions>
## Implementation Decisions

### 拖拽反馈与持久化
- **D-01:** Timeline 采用实时预览。拖动过程中立即更新当前时间、PlaybackEngine 位置和字幕画面；拖动过程中不逐帧持久化 Session。
- **D-02:** 拖拽结束时提交最终位置并触发一次 Session 持久化；沿用 Phase 7 的 `usePlaybackEngine.seek(targetMs)` 与 offset-inclusive 时间空间。
- **D-03:** 播放中拖拽后保持连续播放，暂停中拖拽后保持暂停，并立即显示目标 Cue 或空白。

### Timeline 视觉层级
- **D-04:** 使用细线轨道和高亮已播放段，优先适配影院暗场和低干扰场景。
- **D-05:** 已播放段使用现有高对比度白色，未播放段使用暗灰色；不把 Timeline 设计成高亮彩色主视觉。
- **D-06:** 静止状态隐藏独立拖拽手柄；触摸、拖动或鼠标悬停时显示位置手柄。

### Cue 密度标记
- **D-07:** Cue 标记按固定时间桶聚合，避免长字幕文件在窄 Timeline 上产生过多标记。
- **D-08:** 时间桶密度使用低、中、高三档亮度表达；密度标记作为轨道底层，已播放段和当前进度优先显示。
- **D-09:** 没有 Cue 的时间桶不绘制标记，保留字幕空档的清晰可见性；低密度桶也按实际密度分级，不提升为最高亮度。

### 移动端与可访问性
- **D-10:** 以原生 `<input type="range">` 作为交互与可访问性基础；Cue 标记和轨道视觉层可独立绘制，但不接管 range 的语义和输入。
- **D-11:** 保持细线视觉，同时提供更大的透明触控区域；触摸或键盘聚焦时显示位置手柄，不因触控区域扩大而改变页面布局。
- **D-12:** 键盘左右方向键每次移动 5 秒，目标仍夹紧在 `[0, totalDurationMs]`。
- **D-13:** 屏幕阅读器暴露“当前时间 / 总时长”的可访问名称或值，例如“播放进度，1:12 / 2:05”；拖动时不播报当前字幕正文。

### the agent's Discretion
- 固定时间桶的具体数量或时间跨度由实现者根据 `totalDurationMs`、Timeline 宽度和可读性确定，但必须保持标记数量稳定并使用 D-07 至 D-09 的聚合与层级规则。
- 轨道、手柄和密度标记的具体 CSS 实现由实现者决定，但必须保留原生 range 的键盘/读屏语义和暗场低亮度表现。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and requirements
- `.planning/ROADMAP.md` §Phase 8 — Timeline 目标、依赖关系和成功标准。
- `.planning/REQUIREMENTS.md` §Timeline & Progress — UI-01、UI-02、UI-03 的锁定要求。
- `.planning/PROJECT.md` §Current Milestone、§Key context、§Constraints — 产品场景、影院暗场和 PWA 约束。

### Prior timing and persistence decisions
- `.planning/phases/07-engine-foundation/07-CONTEXT.md` — offset-inclusive 时间空间、Seek 边界、空档/末尾行为和 Session 持久化规则。
- `.planning/phases/07-engine-foundation/07-01-SUMMARY.md` — `PlaybackEngine.seek()`、`seekSession()` 和 hook-level seek 的已交付接口。
- `.planning/phases/07-engine-foundation/07-02-SUMMARY.md` — `ParsedSubtitle.metadata.totalDurationMs` 及 StoredSubtitle 重建路径。

### Existing timing and UI code
- `src/playback/session.ts` — `sessionElapsedMs()` 和 `formatElapsedHMS()` 的时间显示契约。
- `src/playback/PlaybackEngine.ts` — Seek、Cue 查找和播放状态行为。
- `src/hooks/usePlaybackEngine.ts` — engine/session 协调、seek 入口和持久化 effect。
- `src/components/PlaybackControls.tsx` — 当前播放控件承载点，Phase 8 Timeline 应接入此播放页控件边界。
- `src/App.tsx` — 播放视图向 PlaybackControls 传递状态与回调的集成入口。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/playback/session.ts`: `formatElapsedHMS()` 已定义 `h:mm:ss` 格式，Timeline 左右时间显示应复用它。
- `src/hooks/usePlaybackEngine.ts`: 已暴露 `seek(targetMs)`，同时更新引擎与 Session；Timeline 不应分别操作两个状态源。
- `src/types/subtitle.ts`: `ParsedSubtitle.metadata.totalDurationMs` 已可作为 Timeline 总时长。
- `src/components/PlaybackControls.tsx`: 当前播放页控制条组件，适合作为 Timeline 的集成位置，但 Phase 10 才负责完整控制区分层。

### Established Patterns
- 播放位置使用 offset-inclusive 校正后空间；`pausedElapsedMs` 仅在 Session/Engine 内部以 offset-exclusive 形式存储。
- Session 持久化由语义状态变化触发，不由 rAF 或连续播放 tick 触发；拖拽预览必须避免每帧写 IndexedDB。
- 播放页使用大触控目标、黑屏背景和高对比度文字；Timeline 的视觉细线不能牺牲可触控性。
- 字幕 Cue 在空档返回 `-1` 并显示空白；Timeline 标记不能把空档渲染成有字幕区域。

### Integration Points
- `App.tsx` 需要把当前 subtitle cues、`totalDurationMs`、当前播放位置和 `seek` 回调传入 Timeline/PlaybackControls。
- 当前播放位置应从已有引擎状态或 Session 时钟获得，并在播放态持续刷新，在暂停态 Seek 后立即刷新。
- Timeline 提交 Seek 后必须保持现有 play/pause 状态，并复用 hook 的 Session 同步与持久化路径。

</code_context>

<specifics>
## Specific Ideas

- 这是影院暗场工具：Timeline 应是低亮度的工作控件，不应成为明亮的装饰性进度条。
- 用户需要通过密度标记快速判断字幕集中段与空档，但不需要缩略图、Tooltip 或视频预览；这些已在 REQUIREMENTS.md 中列为范围外。
- 当前任务只聚焦 Timeline；控制区整体收纳和自动隐藏属于 Phase 10，手势导航属于 Phase 9。

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `playback-toolbar-layout.md` — 已确认属于 Phase 10 的 Control Layering & Settings Drawer，不并入 Phase 8。

</deferred>

---

*Phase: 8-Timeline & Progress Bar*
*Context gathered: 2026-08-31*
