---
phase: 09-gesture-navigation
plan: 02
subsystem: ui
tags: [gesture-navigation, touch-events, pointer-events, overlay-guide, theater-dark-mode, a11y, pwa]

# Dependency graph
requires:
  - phase: 09-gesture-navigation (Plan 09-01)
    provides: cueNavigation 纯函数（detectGesture/isGestureThrottled/findCueNavigationTarget/hasSeenGestureGuide/markGestureGuideSeen）与手势引导双语翻译键
  - phase: 07-engine-foundation
    provides: usePlaybackEngine.seek（engine+session 原子更新）、seekSession、offset-inclusive 时间空间、会话持久化
provides:
  - src/hooks/useGestureNavigation.ts：基于 Pointer Events 的手势监听 Hook，实现指针捕获、40px 阈值、垂直优先判据与 300ms 节流防抖（D-01~D-04）
  - src/components/GestureGuide.tsx：暗场半透明手势引导浮层组件，1 秒延迟浮现、3 秒自动关闭或轻触任意处即灭、localStorage 一次性持久化（D-13~D-16）
  - src/components/SubtitleDisplay.tsx：扩展 SubtitleDisplayProps 支持 containerProps 透传绑定至 .subtitle-container（D-01）
  - src/index.css：.gesture-guide-* 暗场低亮度样式族及 .subtitle-container 的 touch-action: none 声明（D-01）
  - src/App.tsx：播放视图挂载 useGestureNavigation 与 GestureGuide，上滑/下滑触发 seek(targetMs) 原子同步时钟与会话持久化（D-09/D-10）
affects: [phase-10 控制区分层与设置面板收纳]

# Tech tracking
tech-stack:
  added: [] # 零新依赖（严格遵循 Web 原生与 React 18 约束）
  patterns: [Pointer Events + 指针捕获（setPointerCapture / releasePointerCapture）, touch-action: none 隔离移动端下拉刷新, 居中暗场半透明浮层 + localStorage 一次性持久化, seek(targetMs) 原子同步 Engine 与 Session 并触发持久化]

key-files:
  created:
    - src/hooks/useGestureNavigation.ts
    - src/components/GestureGuide.tsx
  modified:
    - src/components/SubtitleDisplay.tsx
    - src/index.css
    - src/App.tsx

key-decisions:
  - "手势监听 Hook 仅挂载在 .subtitle-container，与 Timeline 及底部控制栏完全隔离，互不干扰（D-01）"
  - "在 .subtitle-container 声明 touch-action: none，彻底杜绝移动端 Safari/Chrome 在快速划动时的橡皮筋滚动与下拉刷新干扰（D-01）"
  - "SubtitleDisplay 保持纯展示设计，通过可选的 containerProps 接收 pointer 事件属性，不侵入字幕业务逻辑"
  - "GestureGuide 浮层在 1 秒延迟后以 0.2s 平滑淡入，3 秒后自动淡出并写入 localStorage，轻触任意处立即关闭且不再打扰（D-14/D-15/D-16）"
  - "逐句跳转通过既有 seek(targetMs) 更新，播放中无缝继续播放，暂停中即时刷新画面并触发会话持久化（D-09/D-10/D-12）"

requirements-completed: [UI-04, UI-05]

coverage:
  - id: D1
    description: "手势监听 Hook：基于 Pointer Events 的 40px 阈值与垂直优先判决、300ms 节流防抖与指针捕获（UI-04, D-01~D-04）"
    requirement: UI-04
    verification:
      - kind: build
        ref: "src/hooks/useGestureNavigation.ts"
        status: pass
  - id: D2
    description: "首次进入手势引导浮层：1s 延时出现、3s 自动关闭/轻触即灭、暗场低亮度与 localStorage 标记（UI-05, D-13~D-16）"
    requirement: UI-05
    verification:
      - kind: build
        ref: "src/components/GestureGuide.tsx"
        status: pass
  - id: D3
    description: "字幕组件手势绑定与 touch-action: none 移动端防刷隔离（UI-04, D-01）"
    requirement: UI-04
    verification:
      - kind: build
        ref: "src/components/SubtitleDisplay.tsx, src/index.css"
        status: pass
  - id: D4
    description: "App 播放链路集成：seek(targetMs) 逐句跳转、时钟同步与 Session 持久化联动（UI-04, D-09, D-10, D-12）"
    requirement: UI-04
    verification:
      - kind: build
        ref: "src/App.tsx"
        status: pass
---

# Plan 09-02 Summary: Gesture Hook, Guide Component & App Integration

交付了 Phase 9 的交互 Hook `useGestureNavigation.ts`、引导组件 `GestureGuide.tsx`、`SubtitleDisplay.tsx` 容器绑定、`index.css` 暗场样式与 `App.tsx` 播放链路完整集成。

## What Was Built

1. **手势导航 Hook (`src/hooks/useGestureNavigation.ts`)**:
   - 监听 `pointerdown`, `pointermove`, `pointerup`, `pointercancel`；
   - 在 `pointerdown` 时调用 `setPointerCapture` 锁定指针，确保在移动端滑动抬手过程中的连续追踪；
   - 在 `pointerup` 时调用 Plan 09-01 的 `detectGesture` 评估 40px 短阈值与严格垂直判定，并经由 `isGestureThrottled` 节流过滤后触发 `onSwipeUp` / `onSwipeDown`。
2. **手势引导浮层 (`src/components/GestureGuide.tsx`)**:
   - 1000ms 挂载延迟，平滑淡入半透明遮罩（`rgba(0, 0, 0, 0.75)`）；
   - 3000ms 自动关闭或点击/触碰任意处立即关闭；
   - 关闭后调用 `markGestureGuideSeen()` 写入 localStorage，永不再现。
3. **字幕容器扩展与样式 (`src/components/SubtitleDisplay.tsx`, `src/index.css`)**:
   - `SubtitleDisplay` 支持 `containerProps` 透传绑定；
   - `.subtitle-container` 声明 `touch-action: none` 禁用下拉刷新；
   - `.gesture-guide-*` 暗场低亮度卡片样式，无刺眼光污染。
4. **App 播放视图集成 (`src/App.tsx`)**:
   - 导入 `sessionElapsedMs`，以 `subtitle.cues` 与当前播放进度计算上滑/下滑跳转目标并调用 `seek(targetMs)`；
   - 播放中无缝继续播放，暂停中立即刷新字幕，并触发 Session 持久化到 IndexedDB。

## Verification

- `npm test`: 10 个测试文件 168 个测试用例全部通过。
- `npx tsc --noEmit`: 编译检查 0 错误。
- `npm run build`: 生产环境打包构建 963ms 完成，PWA Service Worker 构建正常。
- 人工验证清单项覆盖：暗场手势盲操、垂直优先防误触、空档与首尾停留、1s/3s 引导遮罩与 localStorage 持久化。
