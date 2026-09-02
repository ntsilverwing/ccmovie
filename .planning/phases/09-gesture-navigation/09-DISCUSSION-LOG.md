# Phase 9: Gesture Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 09-Gesture Navigation
**Areas discussed:** 手势触发与防误触, 逐句跳转语义, 与播放状态联动, 首次引导与可发现性

---

## 手势触发与防误触

| Option | Description | Selected |
|--------|-------------|----------|
| 全屏字幕区（推荐） | 除 Timeline/控制区外的中央黑屏字幕区全屏响应，最适合盲操 | ✓ |
| 仅中央 60% 区域 | 避开屏幕边缘，防止与系统手势/刘海冲突 | |
| 由你决定 | 按现有布局与暗场可用性自主决定 | |

**User's choice:** 全屏字幕区
**Notes:** 暗场盲操无需瞄准

| Option | Description | Selected |
|--------|-------------|----------|
| 短阈值 40px（推荐） | 轻划即可触发，影院中手持抖动也能完成 | ✓ |
| 中等 80px | 更刻意才触发，误触最少 | |
| 由你决定 | 按真机手感与防误触平衡自主选择 | |

**User's choice:** 短阈值 40px
**Notes:** 配合方向锁定防误触

| Option | Description | Selected |
|--------|-------------|----------|
| 垂直优先分流（推荐） | 垂直位移大于水平位移时判定为手势并阻止后续点击；水平或小幅位移交由 Timeline/控制区处理 | ✓ |
| 手势层独占全屏 | 只要在字幕区触摸就优先判手势 | |
| 由你决定 | 按现有 Timeline 的 touch-action 自主设计 | |

**User's choice:** 垂直优先分流

| Option | Description | Selected |
|--------|-------------|----------|
| 300ms 节流（推荐） | 一次滑动后 300ms 内忽略重复触发 | ✓ |
| 无限制 | 每次滑动都立即跳转 | |
| 由你决定 | 按暗场盲操的容错与效率自主权衡 | |

**User's choice:** 300ms 节流

---

## 逐句跳转语义

| Option | Description | Selected |
|--------|-------------|----------|
| 上=下一句，下=上一句（推荐） | 符合“上推前进、下拉回退”直觉 | ✓ |
| 相反：上=上一句，下=下一句 | 按时间轴纵向隐喻 | |
| 由你决定 | 按暗场直觉自主选择 | |

**User's choice:** 上=下一句，下=上一句

| Option | Description | Selected |
|--------|-------------|----------|
| 边界停留（推荐） | 已到开头/结尾时保持当前字幕或黑屏，不循环 | ✓ |
| 循环跳转 | 末尾后回到开头 | |
| 由你决定 | 按影院连续观看预期自主处理 | |

**User's choice:** 边界停留

| Option | Description | Selected |
|--------|-------------|----------|
| 按时间最近句（推荐） | 上滑跳到空档后下一句开头，下滑跳到空档前上一句开头，空档保持黑屏不吸附 | ✓ |
| 固定跳到下一句开头 | 无论空档位置规则最简单 | |
| 由你决定 | 按 Phase 7 空档黑屏不吸附原则自主定义 | |

**User's choice:** 按时间最近句

| Option | Description | Selected |
|--------|-------------|----------|
| 按原 SRT 顺序（推荐） | 沿用解析器保留的数组顺序，与 Phase 7 D-06 一致 | ✓ |
| 按结束时间排序 | 重叠时以结束早的先跳 | |
| 由你决定 | 按解析结果自主处理 | |

**User's choice:** 按原 SRT 顺序

---

## 与播放状态联动

| Option | Description | Selected |
|--------|-------------|----------|
| 保持原状态（推荐） | 播放中继续播放，暂停中保持暂停并立即显示目标句/空白 | ✓ |
| 一律暂停 | 任何跳转后都暂停 | |
| 由你决定 | 按 Phase 7 D-08 原则自主决定 | |

**User's choice:** 保持原状态

| Option | Description | Selected |
|--------|-------------|----------|
| 立即同步并持久化（推荐） | 跳转后立即更新 Timeline 进度与 Session，刷新后续播落在新手势位置 | ✓ |
| 仅更新画面不同步进度 | 手势只切字幕，Timeline 仍按原时间走 | |
| 由你决定 | 按 wall-clock 会话一致性自主选择 | |

**User's choice:** 立即同步并持久化

| Option | Description | Selected |
|--------|-------------|----------|
| 句首 start（推荐） | 跳到目标 cue 的 start 时间 | ✓ |
| 句中 | 跳到句中 | |
| 由你决定 | 按逐句导航完整性自主选择 | |

**User's choice:** 句首 start

| Option | Description | Selected |
|--------|-------------|----------|
| 无动画直接切（推荐） | 暗场中直接显示目标句/空白 | ✓ |
| 轻微淡入 | 100ms 淡入 | |
| 由你决定 | 按影院低干扰原则自主决定 | |

**User's choice:** 无动画直接切

---

## 首次引导与可发现性

| Option | Description | Selected |
|--------|-------------|----------|
| 居中半透明遮罩（推荐） | 全屏低亮度遮罩居中显示简短图文 | ✓ |
| 底部 Toast | 底部短条提示 | |
| 由你决定 | 按暗场可发现性与低干扰自主选择 | |

**User's choice:** 居中半透明遮罩

| Option | Description | Selected |
|--------|-------------|----------|
| 首次进入播放页 1 秒后出现（推荐） | 给用户 1 秒适应黑屏，再显示；点击任意处或 3 秒后轻点手势自动消失 | ✓ |
| 立即出现需手动关闭 | 进入即显示，必须点关闭才消失 | |
| 由你决定 | 按首次体验的打扰与可发现性平衡自主决定 | |

**User's choice:** 首次进入播放页 1 秒后出现

| Option | Description | Selected |
|--------|-------------|----------|
| 仅一次不再出现（推荐） | 用 localStorage 标记已看过 | ✓ |
| 每次新字幕文件都再提示 | 更换电影时再次引导 | |
| 由你决定 | 按持久化与打扰度自主选择 | |

**User's choice:** 仅一次不再出现

| Option | Description | Selected |
|--------|-------------|----------|
| 无需入口（推荐） | 一次性提示足够，暗场工具保持极简 | ✓ |
| 设置中提供入口 | 在 Phase 10 设置面板中加入“查看手势说明” | |
| 由你决定 | 按极简与可学习性自主权衡 | |

**User's choice:** 无需入口

---

## the agent's Discretion

无 — 本次全部选项均有明确选择，未使用“由你决定”。

## Deferred Ideas

- 左右滑动或其他手势扩展 — 未来手势能力
- 控制区分层与自动隐藏的进一步优化 — Phase 10
- `playback-toolbar-layout.md` 已确认属于 Phase 10，不并入 Phase 9
