---
status: complete
phase: 03-cinema-readiness
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-07-27T12:00:00Z
updated: 2026-07-29T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Import persists across page reload
expected: 导入 SRT 文件后刷新页面，该影片出现在"已保存"列表中，可以选中播放
result: pass

### 2. App loads saved subtitles on startup
expected: 应用启动时从 IndexedDB 加载已保存字幕，无需重新导入即可看到历史记录
result: pass

### 3. Saved movies UI: select and delete
expected: 导入视图中显示已保存影片列表，带删除按钮；选中后加载字幕到准备视图
result: issue
reported: "进入字幕预览后缺少返回按键，只能通过手势操作返回，需要增加一个返回操作按钮"
severity: major

### 4. PWA installable to home screen
expected: 浏览器显示安装按钮；添加到主屏幕后以独立横屏模式启动
result: issue
reported: "在Chrome中选择'安装并创建快捷方式'后，从桌面图标进入仍显示浏览器地址栏，不算真正的PWA应用"
severity: major

### 5. Icon assets display correctly
expected: PWA 图标和启动画面在设备上显示正常，无变形或缺失
result: issue
reported: "1)图标是黑色方块，用户提供了ccmovie.png放在项目目录；2)没有splash screen（用户说暂不需要，后续再补）；3)应用名称不对，应显示'CC Movie'"
severity: major

### 6. Wake Lock keeps screen on during playback
expected: 点击"开始"播放后屏幕保持常亮；点击"停止"后屏幕可正常休眠
result: pass

### 7. Wake Lock re-acquires after app switch
expected: 播放中切换到其他应用再返回，Wake Lock 重新激活，屏幕保持常亮
result: pass

### 8. RotateOverlay shows in portrait mode
expected: 竖屏时显示"请旋转设备"覆盖层；横屏时覆盖层隐藏
result: pass

### 9. Service Worker update prompt
expected: 有新版本 Service Worker 时提示用户更新（仅在非播放状态弹出）
result: skipped
reason: "No new version deployed to trigger update prompt"

### 10. App works offline
expected: 首次加载后断开网络，应用仍能正常加载并播放字幕
result: pass

### 11. idb database layer with typed schema (auto-pass)
expected: idb 数据库层使用类型化 CinemaSyncDB 架构
result: pass
source: automated
coverage_id: 03-01-D1

### 12. Four CRUD functions (auto-pass)
expected: saveSubtitle, getSubtitle, getAllSubtitles, deleteSubtitle 四个函数正常工作
result: pass
source: automated
coverage_id: 03-01-D2

### 13. PWA dependencies configured (auto-pass)
expected: vite-plugin-pwa 配置 manifest（standalone, landscape）和 Workbox 预缓存
result: pass
source: automated
coverage_id: 03-02-D1

## Summary

total: 13
passed: 8
issues: 3
pending: 0
skipped: 1
blocked: 0

## Deferred Follow-Ups

- test: 6
  idea: "在功能区增加屏幕常亮状态指示：当 Wake Lock 激活时，显示'已开启屏幕常亮'字样，让用户明确知道当前状态"
  deferred_at: 2026-07-29

- gap_id: G-03-1
  truth: "影院模式完全全屏，纯黑背景，无任何 UI 元素遮挡"
  status: resolved
  resolved_by: 03-03-PLAN.md
  resolved_at: 2026-07-28
  severity: blocker
  test: 1
  root_cause: "未使用 Fullscreen API，仅 CSS position: fixed；播放条无自动隐藏逻辑；PWA standalone 仅在安装后生效"
  debug_session: ".planning/debug/cinema-fullscreen.md"

- gap_id: G-03-1b
  truth: "播放条 UI 在横屏模式下完整显示、大小合理"
  status: resolved
  resolved_by: 03-04-PLAN.md
  resolved_at: 2026-07-28
  severity: major
  test: 1
  root_cause: "9 个水平元素最小宽度 968px，超出手机横屏 viewport (667-932px)；无 max-width/overflow/响应式处理；字号 slider 无可见标签"
  debug_session: ".planning/debug/playback-bar-ui.md"

- gap_id: G-03-1c
  truth: "字幕字体大小可调节，适应不同屏幕和观影距离"
  status: resolved
  resolved_by: 03-04-PLAN.md
  resolved_at: 2026-07-28
  severity: major
  test: 1
  root_cause: "字号 slider 功能存在但被播放条溢出遮挡，手机横屏时无法触及；默认字号 48px 偏大"
  debug_session: ".planning/debug/subtitle-font-size.md"

- gap_id: G-03-1d
  truth: "界面支持中英文切换"
  status: resolved
  resolved_by: 03-05-PLAN.md
  resolved_at: 2026-07-28
  severity: major
  test: 1
  root_cause: "从未实现 i18n，~30 个英文硬编码在 7 个文件中，无 i18n 库/字典/语言状态"
  debug_session: ".planning/debug/language-toggle.md"

- gap_id: G-03-3
  truth: "字幕预览页面有明确的返回按钮，用户可随时返回导入视图"
  status: resolved
  resolved_by: direct-fix
  resolved_at: 2026-07-29
  severity: major
  test: 3
  root_cause: "App.tsx Ready 视图缺少返回按钮，无 setSubtitle(null) 的 UI 触发"
  debug_session: ".planning/debug/preview-back-button.md"

- gap_id: G-03-4
  truth: "PWA 安装后以独立应用模式启动，无浏览器地址栏"
  status: resolved
  resolved_by: direct-fix + deferred-testing
  resolved_at: 2026-07-29
  severity: major
  test: 4
  root_cause: "图标实际尺寸 2048×2048 与 manifest 声明不匹配（已修复）；Chrome 要求 HTTPS 才能安装 PWA（Tailscale HTTP 不可用，需部署到 HTTPS 环境测试）"
  debug_session: ".planning/debug/pwa-standalone.md"

- gap_id: G-03-5
  truth: "PWA 图标正确显示（非黑色方块），应用名称为 'CC Movie'"
  status: resolved
  resolved_by: direct-fix
  resolved_at: 2026-07-29
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
