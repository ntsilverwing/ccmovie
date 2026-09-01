---
phase: 8
slug: timeline-progress-bar
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10（node 环境，无 jsdom / 无 @testing-library） |
| **Config file** | `vitest.config.ts`（`include: ['test/**/*.test.ts']`, `environment: 'node'`） |
| **Quick run command** | `npx vitest run test/unit/timelineDensity.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 seconds |

> **关键约束**：测试环境为 node —— 组件渲染行为（thumb 显隐、层叠、真机拖拽）无法自动测试。全部可测逻辑（密度分桶、钳制、键盘步进计算）抽成纯函数，组件壳保持薄。不为组件测试引入 jsdom/@testing-library（零新依赖约束）。

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run test/unit/timelineDensity.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + `tsc --noEmit` clean
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | UI-03 | T-08-DoS | 固定桶数 → DOM 节点数恒定 | unit | `npx vitest run test/unit/timelineDensity.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 0 | UI-01 | T-08-Tampering | seek 目标钳制 [0, totalDurationMs]，拒绝非有限值 | unit | `npx vitest run test/unit/timelineDensity.test.ts -t clamp` | ❌ W0 | ⬜ pending |
| 08-0x-xx | — | 1+ | UI-01 | — | 时间显示复用 formatElapsedHMS（负值钳 0:00:00） | unit（既有） | `npx vitest run test/unit/session.test.ts` | ✅ | ⬜ pending |
| 08-0x-xx | — | 1+ | UI-02 | — | 播放态提交末端 → 立即结束清会话（07-D-03） | unit（既有） | `npx vitest run test/unit/playbackEngine.test.ts -t seek` | ✅ | ⬜ pending |
| 08-0x-xx | — | 1+ | UI-02 | — | 预览/提交分离：engine-only preview 不产生 session 对象 | manual | 真机拖拽验证 | — | ⬜ pending |
| 08-0x-xx | — | 1+ | UI-01/02/03 | — | 组件集成（thumb 显隐、aria-valuetext、层叠、触摸/键盘） | manual-only | 真机或 DevTools 触摸模拟 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/timelineDensity.test.ts` — 密度分桶 + clampToDuration 全部边界用例（空文件/单 cue/跨桶 cue/空桶无标记/三档分级/重叠 cue 原序计入；钳制含 NaN/Infinity/越界）
- [ ] （无框架安装需求 — Vitest 已就绪）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 拖拽实时预览：拖动中字幕与时间即时更新，松手后一次持久化 | UI-02 | node 测试环境无法渲染组件，jsdom 引入违反零依赖约束 | DevTools 触摸模拟或真机：拖动 Timeline 观察字幕即时变化；刷新页面确认恢复到松手位置 |
| 播放中拖拽无缝继续 / 暂停中拖拽保持暂停并立即刷新字幕 | UI-02 | 需要真实播放状态 | 真机：播放中拖拽确认不中断；暂停中拖拽确认画面立即更新且不自动播放 |
| thumb 静止隐藏、触摸/拖动/聚焦显现；触控区域扩大不改变布局 | UI-01/D-06/D-11 | 视觉行为 | 真机：静止观察 thumb 消失；触摸后出现；检查布局无位移 |
| aria-valuetext "播放进度，1:12 / 2:05" 读屏 | UI-01/D-13 | 读屏语义 | DevTools Accessibility 面板或 VoiceOver/TalkBack 检查 |
| 键盘左右方向键 5 秒步进 | UI-02/D-12 | 键盘交互 | 聚焦 Timeline，按 ←/→ 验证 ±5s 且夹紧边界 |
| iOS Safari 拖拽连续性（[ASSUMED] 社区轶事级问题） | UI-02 | 需 iOS 真机 | iOS Safari 拖拽 Timeline 多次，确认无中断 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
