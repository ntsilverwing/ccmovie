# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Playback UI Redesign & Timeline

**Shipped:** 2026-09-03
**Phases:** 4 (07–10) | **Plans:** 5 | **Tests:** 172/172 全绿

### What Was Built
- PlaybackEngine offset-inclusive Seek：播放态重锚定无缝继续，暂停态立即刷新字幕并同步 wall-clock 会话（ENG-01/02）
- SRT 解析派生 totalDurationMs = 末 cue end，贯通 StoredSubtitle 重建路径（ENG-03）
- Timeline 进度条：密度分桶三档标记、拖拽导航、engine-only previewSeek（零 IndexedDB 写入）（UI-01/02/03）
- 暗场手势导航：上滑下一句/下滑上一句 + 首次引导浮层（UI-04/05）
- 控制区分层：主控制栏 + 设置抽屉（偏移/字号/重置）+ 3 秒自动隐藏（UI-06/07/08）
- 评审修复 WR-01（idle 态 seek no-op 防分叉）、WR-02（seek 非有限输入守卫）

### What Worked
- Engine-first 依赖排序：07 先行，08/09/10 直接复用 seek 能力，无返工
- Coverage-aware UAT：单元覆盖的交付自动通过，人工只测 3+2 项关键行为
- 全部分支在 master 线性推进，无 worktree 合并成本
- UAT 一次通过率 smoothing：08（9+3 deferred）、09（5/5）、10（5/5）、07（7/7 + 修复复验 2/2）

### What Was Inefficient
- Phase 07 当初以"无 VERIFICATION.md / 无 UAT"状态被标完成，事后补验证、补评审、补修复，多花整轮关卡
- `phase.complete` 机械推进把 STATE 指回 Phase 08 并把 ROADMAP 07 行写成 2/0，需手工修复
- 里程碑审计停在 tech_debt：nyquist 0/4（07/10 缺 VALIDATION.md），VALIDATION 产出不均衡
- audit-open 确认工具无法寻址已归档目录条目，2 条历史延期项只能披露、不能标记抑制

### Patterns Established
- Offset-inclusive seek 空间：入参与显示统一含 offset，内部减 offset 存储
- Engine-only 预览（previewSeek）与提交（seek）分离：拖拽中间帧零持久化写入，松手提交一次
- 暂停 Seek 立即 cue 刷新且不自动播放

### Key Lessons
1. 阶段完成的定义 = plans + VERIFICATION + UAT 三件套，缺一件都不算完成——事后补的成本高于当时做
2. `phase.complete` 之后必须肉眼复核 STATE/ROADMAP diff，CLI 的"下一阶段"指针在乱序完成面前不可信
3. PROJECT.md Active 区要在每次 transition 同步，否则会留下"已做完却还 open"的 stale 条目（本次 9/10 即如此）
4. 已归档的技术债需要披露通道：写不进抑制标记，就写进 STATE.md 明细表

### Cost Observations
- Model mix: 未统计
- Sessions: v1.2 跨 5 天（08-31 → 09-04），约 6 个工作会话
- Notable: 验证与修复关卡（verifier/reviewer/fixer 子代理）一次通过率高，无返工循环

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.2 | ~6 | 4 | 引入 coverage-aware UAT 与 verify:pre/post 关卡；修复走 code-review --fix 闭环 |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.2 | 172 passing | 单元全绿 | 0 新增依赖（延续零依赖研究结论） |

### Top Lessons (Verified Across Milestones)
1. 零新依赖可交付完整播放体验（v1.1/v1.2 连续验证）
2. 真机/桌面边缘场景（键盘、读屏、iOS 真机）适合 defer 而非阻塞发布
