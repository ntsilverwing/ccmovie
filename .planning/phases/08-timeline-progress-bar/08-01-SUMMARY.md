---
phase: 08-timeline-progress-bar
plan: 01
subsystem: playback
tags: [timeline, density-buckets, clamping, preview-seek, tdd, vitest, i18n]

# Dependency graph
requires:
  - phase: 07-engine-foundation
    provides: PlaybackEngine.seek(targetMs)、usePlaybackEngine.seek（engine+session 原子更新）、seekSession、offset-inclusive 时间空间、totalDurationMs 贯通
provides:
  - src/playback/timelineDensity.ts 纯函数模块：computeCueDensityBuckets（密度分桶 D-07/D-08/D-09）、clampToDuration（提交钳制 07-D-02）、clampPreviewTarget（预览钳制 Pitfall 2）、computeKeyboardStepTarget + KEYBOARD_STEP_MS（键盘步进 D-12）
  - usePlaybackEngine.previewSeek(targetMs)：engine-only 拖拽预览入口，零 IndexedDB 写入（D-01/07-D-09）
  - translations.ts timelineLabel 键（en 'Playback progress' / zh '播放进度'，D-13）
  - test/unit/timelineDensity.test.ts：Wave 0 测试文件，31 个边界用例全绿
affects: [08-02 (Timeline.tsx 组件消费全部纯函数与 previewSeek), phase-9 手势导航]

# Tech tracking
tech-stack:
  added: [] # 零新依赖（v1.2 约束保持）
  patterns: [双路径 seek（previewSeek 预览 / seek 提交）, UI-SPEC 确定性三档阈值映射（ratio<=1/3→1, <=2/3→2, else 3）, 半开区间 [start, end) 分桶 + end-1 边界守卫, useCallback([]) + engineRef 纪律的 hook 动作回调]

key-files:
  created:
    - src/playback/timelineDensity.ts
    - test/unit/timelineDensity.test.ts
  modified:
    - src/hooks/usePlaybackEngine.ts
    - src/i18n/translations.ts

key-decisions:
  - "三档 tier 映射采用 UI-SPEC 锁定的确定性阈值（ratio<=1/3→tier 1、<=2/3→tier 2、否则 tier 3），替换 RESEARCH Pattern 4 草案的 ceil(count/max*2) 公式——草案只有两个非空档位，违反 D-08 三档要求"
  - "RED 阶段先建桩模块（退化返回值 + _ 前缀参数满足 noUnusedLocals），使 TDD 失败原因为断言失败而非导入失败（TDD gate 正确性）"
  - "previewSeek 依赖数组 [] 并刻意只含一条 engineRef 调用——不触碰 session 即零 IndexedDB 写入（D-01/07-D-09），persist effect 不可触碰"

patterns-established:
  - "双路径 seek 模式：拖拽预览走 previewSeek（engine-only），提交/键盘走既有 seek（engine+session 原子更新 + 一次持久化）"
  - "预览钳制与提交钳制分离：clampPreviewTarget 钳到 [0, total-1]（Pitfall 2 防引擎自动停止中途卸载 Timeline），clampToDuration 钳到 [0, total]（07-D-03 精确末端合法）"
  - "密度分桶半开区间合同：桶索引 floor(start/bucketMs) 至 floor((end-1)/bucketMs)，cue end 恰在桶界不溢入下一桶"

requirements-completed: [UI-01, UI-02, UI-03]

coverage:
  - id: D1
    description: "Timeline 密度分桶纯函数：固定桶数聚合 cue、半开区间边界、空桶 tier 0、三档确定性阈值分级、重叠 cue 按原序各自计入（UI-03, D-07/D-08/D-09）"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "test/unit/timelineDensity.test.ts#computeCueDensityBuckets"
        status: pass
    human_judgment: false
  - id: D2
    description: "提交钳制 clampToDuration：区间 [0, total]，非有限值（NaN/±Infinity）拒绝为 0，total<=0 恒 0（UI-01, 07-D-02, T-08-01）"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "test/unit/timelineDensity.test.ts#clampToDuration"
        status: pass
    human_judgment: false
  - id: D3
    description: "预览钳制 clampPreviewTarget：[0, total-1]，target===total → total-1（预览永不命中精确末端，Pitfall 2）"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "test/unit/timelineDensity.test.ts#clampPreviewTarget"
        status: pass
    human_judgment: false
  - id: D4
    description: "键盘步进 computeKeyboardStepTarget：±5000ms 夹紧 [0, total]，KEYBOARD_STEP_MS=5000（D-12）"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "test/unit/timelineDensity.test.ts#computeKeyboardStepTarget"
        status: pass
    human_judgment: false
  - id: D5
    description: "usePlaybackEngine.previewSeek：engine-only 预览入口，函数体零 session 状态写入 → 拖拽预览零 IndexedDB 写入（UI-02, D-01）"
    requirement: UI-02
    verification:
      - kind: other
        ref: "region check: sed previewSeek block | grep setSession === 0"
        status: pass
    human_judgment: true
    rationale: "静态 region 检查证明无 setSession 调用点，但拖拽预览不逐帧写库的端到端行为需真机/DevTools 验证（node 测试环境无法渲染组件，08-VALIDATION.md Manual-Only 清单）"
  - id: D6
    description: "timelineLabel i18n 键 en/zh 对称存在，供 Timeline aria-label 使用（UI-01, D-13）"
    requirement: UI-01
    verification:
      - kind: other
        ref: "rg -c timelineLabel src/i18n/translations.ts === 2"
        status: pass
    human_judgment: false
  - id: D7
    description: "全套无回归：148 tests 全绿 + tsc --noEmit clean（117 既有 + 31 新增）"
    verification:
      - kind: unit
        ref: "npm test — 148 passed"
        status: pass
    human_judgment: false

# Metrics
duration: 9 min
completed: 2026-09-02
status: complete
---

# Phase 8 Plan 01: Timeline 非视觉基础（纯函数 + previewSeek + i18n）Summary

**`timelineDensity.ts` 纯函数模块（密度分桶 + 三档钳制 + 键盘步进，31 用例 TDD 全绿）、`previewSeek` engine-only 预览入口（零 IndexedDB 写入）、`timelineLabel` en/zh i18n 键**

## Performance

- **Duration:** 9 min（21:15–21:24 本地时间；含上下文加载与全部验证）
- **Started:** 2026-09-01T15:35:13Z
- **Completed:** 2026-09-02T03:24:07Z（本地 2026-09-01 21:24）
- **Tasks:** 3
- **Files modified:** 4（2 新建 + 2 修改）

## Accomplishments

- `src/playback/timelineDensity.ts`：五个导出（`computeCueDensityBuckets`、`clampToDuration`、`clampPreviewTarget`、`computeKeyboardStepTarget`、`KEYBOARD_STEP_MS=5000`）+ `DensityBucket` 接口，全部纯函数、退化输入短路、非有限值拒绝（T-08-01）
- `test/unit/timelineDensity.test.ts`：Wave 0 测试文件补齐 — 31 个边界用例（空输入、桶边界、半开区间、三档阈值、重叠 cue、NaN/Infinity、预览末端钳制、键盘步进）
- `usePlaybackEngine.previewSeek(targetMs)`：与既有 `seek` 对称的 engine-only 入口，函数体区域 `setSession` 计数 = 0（D-01 自动化 region 检查通过）
- `translations.ts`：`timelineLabel` 键 en（'Playback progress'）/ zh（'播放进度'）对称插入（`rg -c` === 2，D-13）
- TDD 门完整：RED（`test(08-01)` 17 断言失败）→ GREEN（`feat(08-01)` 31/31 全绿）→ 全套 148 tests 无回归、`tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — 编写 timelineDensity 失败测试（Wave 0）** - `3cd1555` (test)
2. **Task 2: GREEN — 实现 timelineDensity 纯函数模块** - `eb55fd9` (feat)
3. **Task 3: previewSeek hook 入口 + timelineLabel i18n 键** - `e780dde` (feat)

_Note: TDD 任务 1/2 为 test → feat 双提交；无 REFACTOR 需求（GREEN 实现已含模块头 JSDoc 与决策编号，无需二次清理提交）_

## Files Created/Modified

- `src/playback/timelineDensity.ts` (new) — Timeline 全部可测逻辑：密度分桶（D-07/D-08/D-09）、提交/预览钳制（07-D-02 / Pitfall 2）、键盘步进（D-12）；模块头 JSDoc 声明不变规则与纯度
- `test/unit/timelineDensity.test.ts` (new) — 31 个边界单测，具名 fixture 常量、零时钟读取，对齐 session.test.ts 模式
- `src/hooks/usePlaybackEngine.ts` (modified) — 新增 `previewSeek`（函数体单语句 `engineRef.current?.seek(targetMs)`，依赖数组 `[]`）；同步返回类型注解、头 JSDoc Returns 行、返回对象三处
- `src/i18n/translations.ts` (modified) — en/zh 块对称新增 `timelineLabel` 键与 `// Timeline.tsx` 区段注释

## Decisions Made

- **三档 tier 映射按 UI-SPEC 裁定替换 RESEARCH 草案**：`ratio <= 1/3 → tier 1`、`ratio <= 2/3 → tier 2`、否则 `tier 3`（count === 0 → tier 0）。RESEARCH Pattern 4 草案 `ceil(count/max*2)` 只产生两个非空档位，违反 D-08「低、中、高三档」要求 — Plan 已锁定此修正，测试按 UI-SPEC 阈值断言。
- **RED 桩模块用 `_` 前缀参数**：tsconfig `noUnusedParameters` 下桩函数签名参数以 `_` 前缀满足类型检查，保证 RED 提交本身 tsc clean 且失败原因为断言失败（TDD gate 正确性），GREEN 阶段恢复具名参数。
- **previewSeek JSDoc 记录完整语义链**：playing 态下一帧 tick 捕获新 cue、paused 态引擎 seek 内部立即 findActiveCue + onCueChange、调用侧需以 clampPreviewTarget 钳制目标（Pitfall 2）——为 Plan 08-02 组件消费提供合同。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED 桩模块未命名参数触发 tsc 报错**
- **Found during:** Task 1（桩模块创建后 LSP/tsc 诊断）
- **Issue:** 项目 tsconfig 启用 `noUnusedParameters: strict`，Plan 规定的桩函数（具名参数 + 退化返回值）会产生 9 个 TS6133 错误，RED 提交将带入 tsc 破损状态
- **Fix:** 桩模块参数改用 `_` 前缀（`_cues`、`_targetMs` 等）——签名与导出契约完全不变，仅抑制 unused 警告；GREEN 阶段恢复具名参数
- **Files modified:** src/playback/timelineDensity.ts
- **Verification:** 桩阶段 `npx tsc --noEmit` clean；RED 运行结果为断言失败（17 failed）而非类型/导入错误；GREEN 后全绿
- **Committed in:** 3cd1555（Task 1 提交内）

---

**Total deviations:** 1 auto-fixed（1 bug）
**Impact on plan:** 桩参数命名调整不影响任何导出签名或测试行为；无范围蔓延。

## Issues Encountered

None — 三个任务全部按 Plan 顺序顺利完成，全部验证一次通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-02（Timeline.tsx 组件 + PlaybackControls/App 集成）的全部依赖已就绪：`computeCueDensityBuckets`/`clampToDuration`/`clampPreviewTarget`/`computeKeyboardStepTarget` 可直接导入，`previewSeek` 已在 hook 返回对象中（props 透传链源头），`timelineLabel` i18n 键可供 `t()` 使用
- 拖拽预览/提交双路径行为、thumb 显隐、aria-valuetext、真机触摸/键盘验证为 Manual-Only 项（08-VALIDATION.md），在 Plan 08-02 组件交付后于 phase 收尾人工验证
- 全套 148 tests 全绿、`tsc --noEmit` clean，无阻塞项

---
*Phase: 08-timeline-progress-bar*
*Completed: 2026-09-02*

## Self-Check: PASSED

- 文件存在性：src/playback/timelineDensity.ts、test/unit/timelineDensity.test.ts、src/hooks/usePlaybackEngine.ts、src/i18n/translations.ts 全部 FOUND
- 提交存在性：3cd1555（test RED）、eb55fd9（feat GREEN）、e780dde（feat hook+i18n）、6df0dc0（docs SUMMARY）全部在 git log 中
- 验证重跑：timelineDensity.test.ts 31/31 pass；npm test 148/148 pass；tsc --noEmit clean；timelineLabel 计数 = 2；previewSeek region setSession 计数 = 0
- TDD 门：RED 提交（3cd1555）先于 GREEN 提交（eb55fd9），RED 失败原因为断言失败（17 failed AssertionError）
- 工作树干净，无意外文件删除（diff-filter=D 计数 = 0）

