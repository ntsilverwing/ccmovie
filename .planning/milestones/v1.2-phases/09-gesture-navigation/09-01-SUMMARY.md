---
phase: 09-gesture-navigation
plan: 01
subsystem: playback
tags: [gesture-navigation, touch-events, cue-jumping, throttling, tdd, vitest, i18n]

# Dependency graph
requires:
  - phase: 07-engine-foundation
    provides: PlaybackEngine.seek(targetMs)、usePlaybackEngine.seek（engine+session 原子更新）、seekSession、offset-inclusive 时间空间
  - phase: 08-timeline-progress-bar
    provides: Timeline 双路径 seek（previewSeek 与 seek 分离）与暗场 UI 基线
provides:
  - src/playback/cueNavigation.ts 纯函数模块：detectGesture（40px 短阈值、垂直优先判决 D-02/D-03）、isGestureThrottled（300ms 节流 D-04）、findCueNavigationTarget（逐句时序跳转 D-05~D-08/D-11）、hasSeenGestureGuide/markGestureGuideSeen（首次引导防御性持久化 D-15）
  - test/unit/cueNavigation.test.ts：Wave 0 测试文件，20 个测试用例全绿
  - src/i18n/translations.ts：新增 4 组中英文手势引导对称键（gestureGuideTitle, gestureGuideSwipeUp, gestureGuideSwipeDown, gestureGuideDismiss，D-13）
affects: [09-02 (useGestureNavigation Hook 与 GestureGuide 组件消费纯函数模块与翻译键)]

# Tech tracking
tech-stack:
  added: [] # 零新依赖（严格遵守 Web 原生与 React 18 约束）
  patterns: [严格垂直优先判决（absDeltaY >= 40 && absDeltaY > absDeltaX）、300ms 滑动限速防抖、逐句时序跳转（包含片头/片尾/两句之间空档与首尾停留）、防御性 localStorage 隔离]

key-files:
  created:
    - src/playback/cueNavigation.ts
    - test/unit/cueNavigation.test.ts
  modified:
    - src/i18n/translations.ts

key-decisions:
  - "手势向量判定采用严格垂直优先（absDeltaY >= 40 && absDeltaY > absDeltaX），任何水平或对角平局均视为 null，杜绝影院盲操斜向误触"
  - "逐句定位覆盖空档与边界停留（D-06/D-07）：首句前下滑返回 null、尾句后上滑返回 null（不循环）；空档中上滑跳下一句开头、下滑跳上一句开头"
  - "重叠字幕遵循原 SRT 数组次序跳转（D-08），与 Phase 7 D-06 保持严格一致"
  - "首次引导持久化采用防御性 try/catch 隔离 localStorage，无痕模式或存储受限时自动降级至内存标记，保证应用零崩溃"

requirements-completed: [UI-04, UI-05]

coverage:
  - id: D1
    description: "手势判据纯函数：40px 阈值、严格垂直优先、非有限坐标过滤（UI-04, D-02, D-03）"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "test/unit/cueNavigation.test.ts#detectGesture"
        status: pass
  - id: D2
    description: "手势限速纯函数：300ms 连续触发抑制（UI-04, D-04）"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "test/unit/cueNavigation.test.ts#isGestureThrottled"
        status: pass
  - id: D3
    description: "逐句字幕跳转算法：正常时段、空档跳最近句、重叠字幕原序、首尾边界停留（UI-04, D-05, D-06, D-07, D-08, D-11）"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "test/unit/cueNavigation.test.ts#findCueNavigationTarget"
        status: pass
  - id: D4
    description: "手势引导标记安全持久化与异常防御（UI-05, D-15）"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "test/unit/cueNavigation.test.ts#GestureGuide storage helpers"
        status: pass
  - id: D5
    description: "手势引导 4 组中英文案对称键定义（UI-05, D-13）"
    requirement: UI-05
    verification:
      - kind: build
        ref: "src/i18n/translations.ts"
        status: pass
---

# Plan 09-01 Summary: Cue Navigation Pure Functions & TDD

以 TDD 模式交付了 Phase 9 的核心算法纯函数模块 `src/playback/cueNavigation.ts`、单元测试套件 `test/unit/cueNavigation.test.ts` 以及 `src/i18n/translations.ts` 中的双语键。

## What Was Built

1. **手势识别与限速纯函数 (`src/playback/cueNavigation.ts`)**:
   - `detectGesture(startX, startY, endX, endY, threshold = 40)`: 严格垂直优先判决（$|\Delta y| \ge 40$ 且 $|\Delta y| > |\Delta x|$），非数坐标自动过滤；
   - `isGestureThrottled(now, lastTriggeredAt, throttleMs = 300)`: 300ms 内抑制重复触发；
2. **逐句跳转目标计算算法 (`findCueNavigationTarget`)**:
   - 处于 active cue 时：上滑取下一句 start，下滑取上一句 start；
   - 处于空档时：上滑取后继 cue start，下滑取前驱 cue start；
   - 首尾边界停留（D-06）：第一句前下滑返回 null，最后一句后上滑返回 null（不循环）；
   - 重叠字幕按原始 SRT 数组下标顺次跳转（D-08）；
3. **首次引导存储安全防御 (`hasSeenGestureGuide` / `markGestureGuideSeen`)**:
   - 读写 `cinemasyncsubs-gesture-guide-seen`，封装 try/catch 隔离 `SecurityError` 并支持内存状态降级；
4. **双语翻译键 (`src/i18n/translations.ts`)**:
   - 新增 `gestureGuideTitle`, `gestureGuideSwipeUp`, `gestureGuideSwipeDown`, `gestureGuideDismiss`（en / zh 对称）。

## Verification

- `npx vitest run test/unit/cueNavigation.test.ts`: 20 个测试全部通过。
- `npm test`: 全量 10 个测试文件 168 个测试用例全绿通过。
- `npx tsc --noEmit`: TypeScript 编译检查 0 错误。
