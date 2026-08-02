# Phase 5: Lossless Playback Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 5-Lossless-Playback-Navigation
**Areas discussed:** 返回手势拦截策略, 离开后系统行为, 重进播放的入口, 返回控件形态

---

## 返回手势拦截策略

| Option | Description | Selected |
|--------|-------------|----------|
| pushState + popstate | state 携带 {view:'playback'} 标记；URL 干净、无路由依赖；replaceState 防堆叠 | ✓ |
| hash 路由 | URL 变为 #/playback；经典方案但多一层 URL 噪音 | |
| 让 dev 决定 | 交给 researcher/planner | |

**User's choice:** pushState + popstate

| Option | Description | Selected |
|--------|-------------|----------|
| 自然退出 | 选择页返回键 = 退出 app（Android 惯例） | ✓ |
| 双击退出 | 二次确认 toast，多一层交互 | |
| 让 dev 决定 | 交给 planner | |

**User's choice:** 自然退出

**Notes:** 调研依据——pushState+popstate 是 Android PWA standalone 拦截返回的标准方案（WICG/MDN）；项目内此前零 history 使用。

---

## 离开后系统行为

| Option | Description | Selected |
|--------|-------------|----------|
| 双释放 | 退全屏 + 释放 Wake Lock；重进时手势链内重新申请 | ✓ |
| 仅退全屏 | Wake Lock 保持，选择页也不灭屏——非纯黑界面长亮影院更显眼 | |
| 全保持 | 选择页也跑在全屏中，状态栏不可见 | |
| 让 dev 决定 | 交给 planner | |

**User's choice:** 双释放

**Notes:** 调研依据——MDN/Best practice：锁只在"需要观看内容"的活动期间持有（放映中持锁、编辑中放锁）；SPA 内切视图不触发 visibilitychange，因此必须由 app 主动释放。重进后控制栏短暂显示沿用既有 3s 自动隐藏（agent 裁量）。

---

## 重进播放的入口

| Option | Description | Selected |
|--------|-------------|----------|
| 顶部常驻横幅 | 选择页顶部常驻“继续播放”横幅（片名+已播时长+一键续播），与 Phase 6 卡片同位同构 | ✓ |
| 就绪视图落地 | 落在 CuePreview+Start 就绪视图——与“返回字幕选择页”的需求预期不符 | |
| 浮动返回钮 | 右下 FAB——底部拇指区误触风险 | |
| 让 dev 决定 | 交给 planner | |

**User's choice:** 顶部常驻横幅

| Option | Description | Selected |
|--------|-------------|----------|
| 可关=放弃 | 横幅可关闭，关闭 = 停止放弃会话（与 Phase 6 一致） | ✓ |
| 不可关闭 | 只能点进播放或加载新字幕 | |
| 让 dev 决定 | 交给 planner | |

**User's choice:** 可关=放弃

**Notes:** 横幅组件预留与 Phase 6 续播卡片共用基础——Phase 6 在其上加 IndexedDB 来源与过期语义。

---

## 返回控件形态

| Option | Description | Selected |
|--------|-------------|----------|
| 单击可逆 | 单击即返回，防误触 = 弱化样式 + 完全可逆（横幅一键回） | ✓ |
| 双击确认 | 误触率近零但黑暗中双击节奏难把握 | |
| 长按确认 | 意图明确但无可发现性 | |
| 让 dev 决定 | 交给 planner | |

**User's choice:** 单击可逆

**Notes:** 调研依据——Baymard：可逆操作优于确认摩擦；WCAG/MD 触控区 ≥48px 保留。影院黑暗环境明确否决一切交互摩擦设计。

---

## the agent's Discretion

- 返回控件形态细节：沿用双语文字按钮家族（‹ 返回），降不透明度，≥48px 触控区
- Toast 时长：3–4 秒自动淡出
- 重进播放视图后控制栏短暂显示，沿用既有自动隐藏计时器
- 离开期间字幕自然播完的视图收敛（status → idle 后按现有逻辑）

## Deferred Ideas

- `.planning/todos/pending/v1-pwa-subtitle-player.md` — 历史 v1 种子已全量交付，用户确认忽略，可后续清理
