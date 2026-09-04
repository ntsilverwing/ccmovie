# Phase 9: Gesture Navigation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

为播放页提供暗场盲操手势导航：全屏字幕区响应上下滑动，逐句跳转字幕并同步内部时钟与进度状态；首次进入时提供一次性、可关闭且不再打扰的手势引导。仅实现手势导航与引导，不涉及 Timeline 已完成的拖拽定位与控制区分层。

</domain>

<decisions>
## Implementation Decisions

### 手势触发与防误触
- **D-01:** 手势生效区域为全屏字幕区（除 Timeline/控制区外的中央黑屏区域），最适合影院盲操，无需瞄准。
- **D-02:** 有效滑动阈值采用短阈值 40px，轻划即可触发，配合方向锁定降低误触。
- **D-03:** 冲突分流采用垂直优先：垂直位移大于水平位移时判定为手势并阻止后续点击；水平或小幅位移交由 Timeline/控制区处理。
- **D-04:** 连续滑动限速为 300ms 节流，一次滑动后 300ms 内忽略重复触发，兼顾防抖与快速逐句浏览。

### 逐句跳转语义
- **D-05:** 映射为上滑=下一句、下滑=上一句，符合“上推前进、下拉回退”的直觉。
- **D-06:** 边界行为为停留：已到第一句前或最后一句后保持当前字幕或黑屏，不循环。
- **D-07:** 空档中的跳转按时间最近句处理：上滑跳到空档后下一句的开头，下滑跳到空档前上一句的开头，空档本身保持黑屏不吸附。
- **D-08:** 重叠字幕按原 SRT 数组顺序跳转，不按结束时间重排，与 Phase 7 D-06 保持一致。

### 与播放状态联动
- **D-09:** 跳转后保持原播放状态：播放中继续播放，暂停中保持暂停并立即显示目标句或空白。
- **D-10:** 跳转立即同步 Timeline 进度与 wall-clock 会话，并触发一次 Session 持久化，刷新后续播落在新手势位置。
- **D-11:** 目标时间点为目标 cue 的 start，完整呈现该句。
- **D-12:** 切换无动画直接切除，暗场中避免额外亮度与延迟。

### 首次引导与可发现性
- **D-13:** 引导样式为居中半透明遮罩，低亮度居中图文，暗场可见但不刺眼。
- **D-14:** 出现与消失时机为首次进入播放页 1 秒后出现，点击任意处或 3 秒后轻点手势自动消失。
- **D-15:** 关闭后仅一次不再出现，使用 localStorage 标记已看过。
- **D-16:** 不提供“再次查看”入口，保持极简；手势可通过自然尝试发现。

### the agent's Discretion
- 手势防误触的垂直/水平判定比例、回弹或轻微振动反馈等细节由实现者根据真机手感决定，但必须保持 40px 阈值与 300ms 节流的约束。
- 引导遮罩的具体文案、图标与 CSS 细节由实现者决定，但必须保持一次性、1 秒延迟出现、可任意点击关闭且不再打扰的约束。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与阶段目标
- `.planning/ROADMAP.md` §Phase 9 — 手势导航目标、依赖 Phase 7 与三条成功标准。
- `.planning/REQUIREMENTS.md` §Gesture Navigation — UI-04、UI-05 锁定需求。
- `.planning/PROJECT.md` §Current Milestone 与 §Constraints — 暗场 PWA 与手动同步约束。

### 已有时间与手势相关决策
- `.planning/phases/07-engine-foundation/07-CONTEXT.md` — offset-inclusive 时间空间、空档/重叠/边界语义与 Session 同步规则。
- `.planning/phases/08-timeline-progress-bar/08-CONTEXT.md` — Timeline 的 preview/commit 双路径与暗场低干扰视觉约束，手势层需与其共存。

### 现有代码集成点
- `src/hooks/usePlaybackEngine.ts` — `seek(targetMs)` / `previewSeek` 与 Session 持久化入口，手势跳转应复用。
- `src/components/PlaybackControls.tsx` 与 `src/components/Timeline.tsx` — 底部控制区与 Timeline 已占用的交互区域，手势层需与其分流。
- `src/App.tsx` — 播放视图的容器与状态分发，手势层与引导遮罩的挂载点。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePlaybackEngine.seek` 已支持播放中/暂停中精确定位并同步 Session，可直接作为手势跳转的提交路径。
- `PlaybackEngine.findActiveCue` 与空档黑屏逻辑已处理重叠与空档，手势只需计算目标 cue 的 start 并调用 seek。
- `Timeline` 的全屏字幕区布局已明确，可在其上叠加透明手势层而不遮挡字幕文本。

### Established Patterns
- 位置计算统一使用 offset-inclusive 空间，Session 持久化由语义变化触发，不逐帧写入。
- 暗场 UI 保持低亮度、无动画直接切换，避免额外光污染。
- 一次性引导使用 localStorage 标记已看过，与 ResumeCard 等类似持久化模式一致。

### Integration Points
- 手势层挂载于播放页中央字幕区容器，垂直位移优先判定为手势，水平或小幅位移透传给 Timeline/控制区。
- 跳转目标为目标 cue 的 start，通过 `seek(targetMs)` 更新引擎、Session、Timeline 进度，并触发一次持久化。
- 引导遮罩首次进入播放页 1 秒后挂载，点击任意处或手势触发后卸载，并写入 localStorage 标记。

</code>

<specifics>
## Specific Ideas

- 影院暗场中用户无法精确瞄准控件，手势必须是全屏盲操、短距离、低阈值。
- 手势的价值是快速校正“错过一句”而非连续浏览，因此 300ms 节流与边界停留比循环更符合连续观看预期。

</specifics>

<deferred>
## Deferred Ideas

- 左右滑动或其他手势扩展 — 属于未来手势能力，未纳入 Phase 9。
- 控制区分层与自动隐藏的进一步优化 — 属于 Phase 10。

### Reviewed Todos (not folded)
- `playback-toolbar-layout.md` — 已确认属于 Phase 10 的 Control Layering & Settings Drawer，不并入 Phase 9。

</deferred>

---

*Phase: 9-Gesture Navigation*
*Context gathered: 2026-09-02*
