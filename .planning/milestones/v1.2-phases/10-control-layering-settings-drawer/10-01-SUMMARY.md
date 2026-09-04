---
phase: 10-control-layering-settings-drawer
plan: 01
subsystem: playback-ui
tags: [control-layering, settings-drawer, bottom-sheet, top-bar, touch-targets, cinema-etiquette, vitest]

# Dependency graph
requires:
  - phase: 08-timeline-progress-bar
    provides: Timeline component and seek interface
  - phase: 09-gesture-navigation
    provides: Gesture navigation and de-clutter interactions
provides:
  - src/components/PlaybackTopBar.tsx: Top Bar displaying Back and Wake Lock indicator at screen top (D-08)
  - src/components/PlaybackControls.tsx: Layered controls (main row + Bottom Sheet settings drawer) (UI-06, UI-07, D-01)
  - src/App.tsx: Top Bar integration, auto-hide pausing while drawer open (D-03), swipe timeline visual feedback (D-11), global reset (D-09)
  - src/index.css: Bottom sheet animations, frosted dark background, >=48px touch targets
  - test/unit/controlLayering.test.ts: Unit tests for i18n keys, discrete font clamping, and global reset
affects: [milestone v1.2 completion and audit]

# Tech tracking
tech-stack:
  added: [] # 零新依赖
  patterns: [Bottom Sheet Drawer, Top Bar separation, 3s auto-hide pause guard, discrete font step clamping, global reset]

key-files:
  created:
    - src/components/PlaybackTopBar.tsx
    - test/unit/controlLayering.test.ts
  modified:
    - src/components/PlaybackControls.tsx
    - src/App.tsx
    - src/i18n/translations.ts
    - src/index.css

key-decisions:
  - "D-01: 设置面板采用底部滑出 (Bottom Sheet) 抽屉形态，搭配深色半透明背景 (rgba(12, 12, 12, 0.96))"
  - "D-02: 隐藏状态下点击屏幕仅唤出控制栏 (UI)，不触发播放/暂停"
  - "D-03: 底部设置面板展开时，暂停 3 秒无操作自动隐藏倒计时，用户关闭后恢复"
  - "D-04: 彻底剔除高对比度 (High Contrast) 选项，避免影院暗场漏光"
  - "D-05: 默认极暗模式，不提供多余暗场开关"
  - "D-06: 字号调节改用 [ A- ] 与 [ A+ ] 离散按钮（步长 4px，范围 36~72px），弃用滑块"
  - "D-07: 设置实时生效并写入 localStorage"
  - "D-08: 返回按钮与屏幕常亮指示器移至屏幕顶部独立 Top Bar"
  - "D-09: 全局重置一键恢复偏移量 (0) 与字号 (48px) 至默认值"
  - "D-10: 上下滑动手势仅用于切换字幕，不得唤出设置抽屉"
  - "D-11: 滑动手势跳转时临时浮现控制栏与 Timeline 进度条作为视觉反馈"
  - "Folded TODO (playback-toolbar-layout.md): 所有触控目标统一满足 >= 48x48px 影院无障碍约束"

requirements-completed: [UI-06, UI-07, UI-08]

coverage:
  - id: D1
    description: "播放控制区分层：主栏仅 Timeline + 播放/暂停 + 设置按钮（UI-06）"
    requirement: UI-06
    verification:
      - kind: build
        ref: "src/components/PlaybackControls.tsx"
        status: pass
  - id: D2
    description: "设置面板 Drawer：收纳时间偏移、离散字号、全屏、停止、全局重置（UI-07, D-01, D-04, D-06, D-09）"
    requirement: UI-07
    verification:
      - kind: unit
        ref: "test/unit/controlLayering.test.ts"
        status: pass
  - id: D3
    description: "控制栏自动隐藏与唤醒：3 秒隐藏、点击唤醒、抽屉展开暂停倒计时（UI-08, D-02, D-03）"
    requirement: UI-08
    verification:
      - kind: build
        ref: "src/App.tsx"
        status: pass
  - id: D4
    description: "非控制按钮上移 Top Bar：返回与屏幕常亮指示器（D-08）"
    requirement: UI-06
    verification:
      - kind: build
        ref: "src/components/PlaybackTopBar.tsx"
        status: pass
---

# Plan 10-01 Summary: Control Layering & Settings Drawer

完成了播放控制区分层与设置面板收纳重构，严格落实 Phase 10 讨论确立的 D-01 至 D-11 决策。

## What Was Built

1. **独立的顶部状态栏 (`src/components/PlaybackTopBar.tsx`)**:
   - 将「‹ 返回」按钮与「屏幕常亮」指示器从原底部控制栏抽离，移至屏幕顶部；
   - 与底部控制栏统一根据 `controlsVisible` 进行同步显隐与 3 秒自动隐藏。

2. **主控制栏极简重构 (`src/components/PlaybackControls.tsx`)**:
   - 第一行保留全宽 `Timeline` 进度条；
   - 第二行主控制行仅保留「播放/暂停」大按钮与「⚙️ 设置」抽屉切换按钮；
   - 彻底移除高对比度切换按钮（D-04）与字号滑动条（D-06）。

3. **底部滑出设置抽屉 (`.settings-drawer` / Bottom Sheet)**:
   - 点击「设置」按钮平滑滑出，带纯黑半透明背景遮罩（D-01）；
   - 字幕时间偏移：`−0.5s`、`+0.5s` 及实时数值显示；
   - 字号微调：`[ A- ]` 与 `[ A+ ]` 离散点击按钮，步长 4px，限制在 36px~72px（D-06）；
   - 功能按钮：`全屏/退出全屏`、`停止`；
   - 全局重置：`全局重置` 按钮一键恢复时间偏移至 0 并重置字号为 48px（D-09）；
   - 提供右上角关闭按钮及点击背景遮罩关闭。

4. **交互联动与防误触细节 (`src/App.tsx`)**:
   - **自动隐藏暂停**：当设置面板展开时，暂停 3 秒无操作自动隐藏倒计时；用户主动关闭面板后恢复计时（D-03）；
   - **点击唤醒防误触**：控制栏隐藏时，点击屏幕仅唤醒 UI，不误触暂停（D-02）；
   - **手势反馈**：上下滑动手势仅用于字幕定位不触发抽屉（D-10），触发跳转时临时唤起 controls/timeline 2 秒展示视觉进度（D-11）。

5. **触控与样式标准 (`src/index.css`)**:
   - 所有按钮均满足 `min-height: 48px; min-width: 48px;` 触控标准（折叠 `playback-toolbar-layout.md`）；
   - 低亮度暗场配色，避免影院环境大面积发光。

## Verification

- `npm test`: 11 个测试文件、172 个单元测试全部通过。
- `npm run build`: TypeScript 编译与 Vite 生产打包通过，PWA Service Worker 构建正常。
