# Phase 10: Control Layering & Settings Drawer — Research

## Context & Architecture

### Phase Goal
播放控制区功能分层，低频操作收纳进底部设置抽屉（Bottom Sheet Drawer），主控制栏保持简洁，满足影院暗场低亮度环境下的操作礼仪。

### Requirements & Traceability
- **UI-06**: 播放控制区分层 — 主控制栏（Timeline + 播放/暂停 + 设置按钮），设置面板收纳低频操作
- **UI-07**: 设置面板（Drawer）— 收纳字幕偏移（-0.5s/+0.5s/Reset）、字体大小、暗场模式、高对比度、全屏切换（依 D-04/05/06 裁剪）
- **UI-08**: 控制栏自动隐藏 — 无操作 3 秒后自动隐藏，点击屏幕唤出
- **D-01 ~ D-11 (10-CONTEXT.md)**: 核心设计决策（包括剔除高对比度、字号 A-/A+ 离散按钮、返回/常亮上移 Top Bar、抽屉展开暂停 3 秒倒计时等）
- **Folded TODO**: `playback-toolbar-layout.md`（按钮触控区域 ≥48x48px，低亮度配色）

## Technical Findings

1. **Top Bar (`.playback-top-bar`)**:
   - `onBack` (‹ 返回) 和 `wake-lock-indicator` (屏幕常亮) 从原底部 `PlaybackControls` 抽离，移至屏幕顶部独立渲染。
   - 与底部控制栏使用相同的 `controlsVisible` 状态控制显示/隐藏。
   - 布局：固定在顶部，左右两端对齐，大触控尺寸。

2. **Main Controls Row (`.playback-controls`)**:
   - 保留 Timeline 进度条（上层全宽）。
   - 主控制行精简为：播放/暂停按钮（或 Start）+ 设置按钮（⚙️ / 设置）。
   - 设置按钮点击切换 `isSettingsOpen` 抽屉展开状态。

3. **Settings Drawer (`.settings-drawer` / Bottom Sheet)**:
   - 底部滑出浮层，纯黑或极暗磨砂半透明背景（`rgba(10, 10, 10, 0.95)`），无多余光源。
   - 包含分区：
     - 字幕时间偏移：`−0.5s`、当前偏移显示（如 `+0.5s` / `0.0s`）、`+0.5s`
     - 字号调节：`[ A- ]` 与 `[ A+ ]` 离散点击按钮（步长 4px，范围 36~72px），弃用滑动条
     - 全屏切换：`[ 全屏 / 退出全屏 ]`
     - 停止播放：`[ 停止 ]`
     - 全局重置：`[ 全局重置 ]`（一键恢复偏移量至 0，字号恢复至默认 48px）
     - 关闭抽屉：`[ 关闭 ]` 或 点击背景遮罩关闭
   - 彻底剔除“高对比度 (High Contrast)”按钮（避免影院刺眼发光）。
   - 默认全局使用极暗模式，不在抽屉中提供多余的主题切换开关。
   - 抽屉内所有操作触发 `updateSettings`，实时生效并持久化至 `localStorage`。

4. **Auto-hide & Tap Feedback (`App.tsx`)**:
   - 当 `isSettingsOpen` 为 true 时，暂停 3 秒自动隐藏倒计时，避免操作抽屉时界面消失。
   - 控制栏处于隐藏状态时，点击屏幕任意位置仅唤出 UI（`controlsVisible = true`），不触发播放/暂停。
   - 上下滑动手势（字幕导航）触发时，临时展示控制栏或进度条反馈。

5. **Touch & Accessibility Standards**:
   - 遵循 `≥48x48px` 最小触控区域。
   - 按钮深灰色调、低饱和度、防误触。
