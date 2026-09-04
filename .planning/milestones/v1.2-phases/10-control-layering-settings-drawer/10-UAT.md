---
status: complete
phase: 10-control-layering-settings-drawer
source: [10-VERIFICATION.md]
started: 2026-09-03T05:57:00Z
updated: 2026-09-03T05:57:00Z
---

## Current Test

number: 5
name: UI-08 手势滑动临时反馈
expected: |
  在字幕区域执行上滑或下滑切换字幕时，临时浮现 controls/timeline 2 秒展示视觉进度，随后自动淡出。
result: [pass]

## Tests

### 1. UI-06 播放控制区分层
expected: 进入播放页后，底部主控制栏仅保留 Timeline、播放/暂停（或继续）大按钮、⚙️ 设置按钮；原返回按钮与屏幕常亮指示已移至顶部 Top Bar。
result: [pass]

### 2. UI-07 设置面板 Drawer 唤出与暗场表现
expected: 点击 ⚙️ 设置按钮，自屏幕底部平滑滑出 Bottom Sheet 抽屉，背景为纯黑/暗色磨砂半透明；点击右上角 ✕ 或背景遮罩可关闭抽屉；无高对比度发光项。
result: [pass]

### 3. UI-07 设置项调节与全局重置
expected: 抽屉内包含 −0.5s / +0.5s 时间偏移调节；字号调节为 [ A- ] 与 [ A+ ] 离散按钮（限制在 36px~72px）；点击「全局重置」一键恢复时间偏移为 0 且字号为 48px。
result: [pass]

### 4. UI-08 抽屉展开时暂停自动隐藏
expected: 当设置面板处于展开状态时，暂停 3 秒无操作自动隐藏倒计时，抽屉保持常显；用户关闭抽屉后恢复 3 秒倒计时。
result: [pass]

### 5. UI-08 手势滑动临时反馈与全屏点击唤醒
expected: 控制栏自动隐藏后，点击屏幕中心仅唤醒 UI，不影响播放/暂停；上下滑动切换字幕时临时浮现进度条 2 秒作为视觉反馈。
result: [pass]

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

none yet
