# Phase 10: Control Layering & Settings Drawer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 10-Control Layering & Settings Drawer
**Areas discussed:** TODO incorporation, Drawer Placement, Tap Interaction, Persistence, Non-control buttons, Cinema Environment adjustments

---

## TODO 折叠

| Option | Description | Selected |
|--------|-------------|----------|
| 纳入本阶段 | 将 playback-toolbar-layout.md 的改进纳入本阶段 | ✓ |
| 暂不纳入 | 留作以后的阶段 | |

**User's choice:** 纳入本阶段
**Notes:** 需求完全匹配 Phase 10 的核心目标，顺理成章合并。

---

## 设置面板形态与位置

| Option | Description | Selected |
|--------|-------------|----------|
| 底部滑出 | Bottom Sheet，需要处理与主控制栏的重叠问题 | ✓ |
| 侧边滑出 | Side Drawer，从右侧滑出 | |
| 全屏覆盖层 | Modal | |

**User's choice:** 底部滑出
**Notes:** 主要使用场景为移动端。用户特别强调：增加的上下滑动手势（切换字幕）只负责导航，不要引发面板滑出。面板应当只在点击时唤出。同时建议在滑动时可以显示进度条。

---

## 状态保存时机

| Option | Description | Selected |
|--------|-------------|----------|
| 实时生效并立即保存 | 调整时画面变化并立即写入 localStorage | ✓ |
| 统一保存 | 关闭面板时才保存 | |

**User's choice:** 实时生效并立即保存
**Notes:** 复用现有 `usePersistedSettings` 逻辑。

---

## 控制栏隐藏状态下的点击

| Option | Description | Selected |
|--------|-------------|----------|
| 仅唤出控制栏 | 点击屏幕仅唤醒 UI，不影响播放/暂停 | ✓ |
| 唤出并切换播放 | 点击屏幕唤醒 UI 并切换播放状态 | |

**User's choice:** 仅唤出控制栏
**Notes:** 避免用户想看进度时误触暂停，符合主流视频播放器直觉。

---

## 面板打开时的自动隐藏逻辑

| Option | Description | Selected |
|--------|-------------|----------|
| 暂停计时 | 面板打开时停止3秒自动隐藏倒计时 | ✓ |
| 保持计时 | 3秒无操作同时隐藏面板和控制栏 | |

**User's choice:** 暂停计时
**Notes:** 防止用户调节选项时面板消失。

---

## 非控制类按钮的归属

| Option | Description | Selected |
|--------|-------------|----------|
| 移至屏幕顶部 | 作为 Top Bar，与底栏同步自动隐藏 | ✓ |
| 移入设置面板 | 收纳在 Drawer 内部 | |
| 保留在底部主控制栏 | - | |

**User's choice:** 移至屏幕顶部
**Notes:** 保持主控制栏的极简风格，同时提供独立的操作和指示位置。

---

## 影院暗场环境下的精简建议

**User's choice:** 进一步调整
**Notes:** 
探讨了基于“不打扰周围的人”的极暗场场景。
用户提议：“字号部分，可以只要 A- / A+ 操作，不要‘标准’这个按钮。字号的恢复可以放在‘重置’按钮中一并处理，即重置时间轴以及字体大小等所有设置，恢复成默认。”
确认：取消“高对比度”选项，强制或默认使用暗场模式深色设计。将字号调节精简为按钮，重置功能整合。
