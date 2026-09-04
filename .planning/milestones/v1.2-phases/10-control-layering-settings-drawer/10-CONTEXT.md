# Phase 10: Control Layering & Settings Drawer - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

播放控制区功能分层，低频操作收纳进设置面板，主控制栏保持简洁。支持极暗场环境下的交互优化，包含 3 秒无操作自动隐藏、屏幕点击唤出控制栏、滑动反馈等行为。

</domain>

<decisions>
## Implementation Decisions

### 设置面板 (Drawer) 形态
- **D-01:** 设置面板采用从底部滑出 (Bottom Sheet) 的形态，并且背景必须是纯黑色或极暗的磨砂半透明材质，避免大面积发光。

### 自动隐藏与唤出逻辑
- **D-02:** 隐藏状态下，点击屏幕中心仅用于唤出控制栏（UI），不触发播放/暂停。
- **D-03:** 当底部设置面板展开时，暂停“3秒无操作自动隐藏”的倒计时；用户主动关闭面板后恢复计时。

### 暗场环境功能精简
- **D-04:** 从设置面板中彻底剔除“高对比度 (High Contrast)”功能，避免在极暗的影院环境下漏光刺眼。
- **D-05:** 默认全局采用极限暗场主题（深灰字+纯黑底），不再作为设置面板里的“切换模式”提供。
- **D-06:** 字体大小调节弃用滑块 (Slider)，改为 `[ A- ]` 和 `[ A+ ]` 离散点击按钮。不提供“标准”恢复按钮，其重置逻辑合并入全局重置。
- **D-07:** 设置状态调节（如字号、时间偏移）必须实时生效并即刻写入 `localStorage`。

### 非控制类按钮布局
- **D-08:** 将「返回」和「常亮指示」上移至独立的屏幕顶部（Top Bar），与底部控制栏同步显示/隐藏。
- **D-09:** 原有的“重置 (Reset)”按钮升级为“全局重置”，一次性恢复偏移量(0)和字体大小等所有设置至默认值。

### 交互手势边界
- **D-10:** 全局的上下滑动屏幕手势仅用于切换字幕，不得意外滑出底部设置面板。面板仅能通过点击“设置”按钮唤出。
- **D-11:** 触发上下滑动手势（切换字幕）时，需临时浮现 Timeline/进度条作为视觉反馈。

### Folded Todos
- **播放工具条整体布局优化 (playback-toolbar-layout.md):** 
  原问题为“工具条经历两次位置微调属于打补丁，需要一次通盘设计（按钮分组、顺序、视觉层级）并符合影院低亮度/≥48px触控约束”。这完全契合当前阶段的分层重构目标，已折叠并入上述设计决策中。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and requirements
- `.planning/ROADMAP.md` §Phase 10 — Phase goal, dependency boundary, and observable success criteria.
- `.planning/REQUIREMENTS.md` §UI-06, UI-07, UI-08 — Phase 10 explicit UI requirements.
- `.planning/todos/playback-toolbar-layout.md` — The original constraints for toolbar layout (merged).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/PlaybackControls.tsx`: 现有的控制按钮全部位于此，需要拆分为主控条和 Drawer 面板，同时将返回和指示器提至 Top Bar。
- `src/hooks/usePersistedSettings.ts`: 提供同步存取设置的状态支持，当前实时写入的设计正好满足“变更实时生效并立即保存”的需求。
- `src/hooks/useGestureNavigation.ts`: 管理手势交互。需要确保它在滑动时能派发状态（或通过 `App.tsx` 暴露）以显示临时的 Timeline。

### Established Patterns
- **暗场礼仪 (Cinema Etiquette)**：所有新出现的 UI 层（如 Top Bar, Drawer）必须严格遵守低亮度、高对比（非白光）的要求，不能干扰环境。
- **状态同步保存**：`usePersistedSettings` 提供了 `updateSettings` 接口，可以被各种独立的 UI 层（如 Drawer 里的按钮）调用。

### Integration Points
- `src/App.tsx`: 需要在此管理 `Top Bar` 和 `Drawer` 的组合布局；此外需在容器级补充全屏点击唤出（且不触发播放暂停）的捕获层，配合已有的 `isSessionExpired` 及 3秒倒计时器。

</code_context>

<specifics>
## Specific Ideas

- 影院极暗环境是这个项目的核心边界。所有的设计和功能取舍（剔除高对比度、使用点击按钮代替滑块、深色背景）均出于“不要照亮用户的脸或打扰周围人”的克制原则。
- “字号的恢复可以放在‘重置’按钮中一并处理，即重置时间轴以及字体大小等所有设置，恢复成默认。”

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Control Layering & Settings Drawer*
*Context gathered: 2026-09-02*
