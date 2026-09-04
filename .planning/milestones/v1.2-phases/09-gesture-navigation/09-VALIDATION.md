---
phase: 9
slug: gesture-navigation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10（node 环境，无 jsdom / 无 @testing-library） |
| **Config file** | `vitest.config.ts`（`include: ['test/**/*.test.ts']`, `environment: 'node'`） |
| **Quick run command** | `npx vitest run test/unit/cueNavigation.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 seconds |

> **关键约束**：测试环境为 node —— 组件渲染行为（Pointer 事件流、真机滑动手感、全屏半透明引导层）无法在 node 环境做完整真机交互测试。全部核心可测逻辑（滑动向量数学判据、300ms 节流判定、空档/重叠/边界字幕导航算法、localStorage 安全读写）全部抽成纯函数，在 Node 运行时进行 100% 单元测试覆盖。不引入 jsdom 或 @testing-library（遵循零新外部依赖约束）。

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run test/unit/cueNavigation.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + `tsc --noEmit` clean
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | UI-04 | T-09-Math | 滑动向量与节流纯函数：40px 阈值、严格垂直优先、300ms 节流防抖 | unit | `npx vitest run test/unit/cueNavigation.test.ts -t "gesture"` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 0 | UI-04 | T-09-Boundary | 字幕跳转纯函数：空档跳最近句起点、重叠依原数组顺次跳转、首尾边界停留不循环 | unit | `npx vitest run test/unit/cueNavigation.test.ts -t "cueNavigation"` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 0 | UI-05 | T-09-Storage | 首次引导 localStorage 标记：无痕模式或存储异常时不崩溃并降级 | unit | `npx vitest run test/unit/cueNavigation.test.ts -t "guide"` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | UI-04 | — | useGestureNavigation hook：绑定 pointerdown/move/up 并触发 seek(targetMs) | unit / manual | `npm test` + 真机触摸测试 | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | UI-05 | — | GestureGuide 组件：1s 延迟出现，点击或手势或 3s 倒计时自动关闭 | manual-only | 播放页真机或 DevTools 检查引导显隐与持久化 | — | ⬜ pending |
| 09-02-03 | 02 | 1 | UI-04/05 | — | App.tsx 挂载与 SubtitleDisplay 样式（touch-action: none）整合 | manual-only | 真机手势盲操、刷新会话恢复检查 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/cueNavigation.test.ts` — `detectGesture`、`isGestureThrottled`、`findCueNavigationTarget`、`hasSeenGestureGuide` / `markGestureGuideSeen` 全量测试用例（覆盖正常、空档、重叠、越界、空字幕、首尾停留）
- [ ] （无框架安装需求 — Vitest 已就绪）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 影院暗场触控手势盲操：上滑跳下一句，下滑跳上一句 | UI-04 | node 测试环境无法渲染组件，真实触摸体验需验证 | 移动设备或 DevTools 移动触控模式下，在字幕区向上滑动 >40px，确认跳至下一句起点；向下滑动 >40px，确认跳至上一句起点 |
| 防误触分流：水平滑动、小幅抖动不触发手势跳转；Timeline 拖拽不受影响 | UI-04 / D-03 | 需要真实 Pointer/Touch 交互路径分流 | 在字幕区水平快速划过，确认不发生跳转；在 Timeline 上拖动进度条，确认时间轴正常拖拽无冲突 |
| 跳转后播放状态保持与 Session 持久化 | UI-04 / D-09 / D-10 | 跨组件与 IndexedDB 持久化链路 | 播放中滑动，确认无缝继续播放；暂停中滑动，确认保持暂停并更新字幕；滑动后立即刷新页面，确认从新跳转位置恢复播放 |
| 首次进入手势引导层展示与自动/手动关闭 | UI-05 / D-13 / D-14 / D-15 | 视觉层级与定时器动画 | 清除 localStorage 标记后进入播放页，1 秒后出现半透明低亮度引导图文；轻触屏幕或滑动或等待 3 秒，确认引导层消失且刷新后不再出现 |
| 移动端 touch-action 禁用下拉刷新 | UI-04 | 浏览器默认手势隔离 | 在 iOS Safari / Android Chrome 的字幕区向下拉动，确认不会触发页面滚动或橡皮筋下拉刷新 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
