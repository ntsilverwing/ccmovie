# 影院同步字幕工具 (CinemaSyncSubs)

## What This Is

一个 PWA 影院字幕工具，让非英语母语观众在影院看外语片时能跟上剧情。用户导入 SRT 字幕文件，横屏播放时黑屏白字显示字幕，支持中英双语界面、时间偏移调整和高对比度模式，可安装到主屏幕离线使用。

## Core Value

让非英语母语观众在影院看外语片时能跟上剧情——即使没有 CC 设备或 CC 只有英法字幕。

## Current Milestone: v1.2 Playback UI Redesign & Timeline

**Goal:** 重构播放控制区，引入全局 Timeline 进度条和手势操作，解决控制区功能堆叠、无法快速定位时间点的问题。

**Target features:**
- 播放控制区分层：主控制栏 + 设置面板（Drawer/Modal）
- 屏幕手势操作：上滑跳下一句、下滑跳上一句
- Timeline 进度条：支持拖拽定位，显示当前/总时长
- PlaybackEngine 增强 `seek(targetMs)`：播放中/暂停中 Seek
- Session 状态同步：Seek 后更新 PlaybackSession
- 总时长获取：解析字幕时提取最后一条 end 时间

**Key context:**
- 基于 v1.1 wall-clock session 机制，Seek 后需同步更新 startedAt/offset
- PlaybackControls.tsx 当前功能堆叠严重（10+ 按钮平铺）
- 当前 seekTo 仅用于后台恢复对齐，不支持暂停态任意 Seek

## Requirements

### Validated

- ✓ 用户可导入 SRT 字幕文件（文件选择器 + 拖放）— v1.0
- ✓ 解析 SRT 时间轴并逐条显示字幕 — v1.0
- ✓ 手动按下"开始"按钮后按时间轴播放字幕 — v1.0
- ✓ 黑屏白字显示模式（OLED 纯黑背景）— v1.0
- ✓ 最低亮度友好的 UI（大字体、高对比度白色文字）— v1.0
- ✓ 支持横屏显示（影院使用场景）— v1.0
- ✓ 添加到主屏幕功能（PWA manifest）— v1.0
- ✓ 时间偏移调整（±5s，0.5s 步进）— v1.0
- ✓ 高对比度模式（黄色 #FFD700，WCAG AAA）— v1.0
- ✓ 中英双语界面切换 — v1.0
- ✓ 全屏影院模式（Fullscreen API）— v1.0
- ✓ 播放页无损返回字幕选择页，状态全保留（PLAY-08）— v1.1
- ✓ 播放会话跨刷新/杀进程持久化，重进可一键续播（FILE-03）— v1.1
- ✓ PlaybackEngine 增强 seek(targetMs)：播放中/暂停中 Seek（ENG-01）— Phase 7
- ✓ Seek 后 Session 状态同步：更新 startedAt/offset（ENG-02）— Phase 7
- ✓ 总时长获取：解析字幕时提取最后一条 end 时间（ENG-03）— Phase 7
- ✓ Timeline 进度条：拖拽定位 + 当前/总时长显示（UI-03）— Phase 8
- ✓ Timeline 拖拽 Seek：播放中/暂停中无缝 Seek 且一次持久化（UI-02）— Phase 8
- ✓ Timeline Cue 密度标记：三档亮度 + 空档零 DOM（UI-01）— Phase 8
- ✓ 屏幕手势操作：上滑跳下一句、下滑跳上一句（UI-04）— Phase 9
- ✓ 手势提示 Overlay：首次引导可关闭（UI-05）— Phase 9
- ✓ 播放控制区分层：主控制栏 + 设置面板（UI-06）— Phase 10
- ✓ 设置面板 Drawer：偏移/字号/对比度/暗场/全屏收纳（UI-07）— Phase 10
- ✓ 控制栏自动隐藏：3 秒无操作隐藏、点击唤出（UI-08）— Phase 10

### Active

*(无 — v1.2 全部需求已验证)*

### Out of Scope

- 字幕快进/慢速调整（时间轴不同步时）— v1 手动对齐即可，时间偏移已覆盖
- 在线字幕搜索/下载 — v1 用户自行下载
- 音频自动对齐 — 预告片导致不可靠
- 原生 App（iOS/Android）— PWA 起步
- 多语言字幕同时显示 — v1 单语言
- 字幕翻译功能 — v1 仅播放已有字幕

## Context

- 北美影院 CC 闭字幕设备仅提供英语/法语字幕，无法服务非英语母语观众
- 部分场次无 CC 设备可用
- 电影上映后几天内通常就有可用的 SRT 字幕文件
- OLED 屏幕可实现纯黑背景（关闭像素），仅白色文字发光，对周围观众影响极小
- LCD 屏幕最低亮度约 2-5 nit，黑屏白字方案仍可用但漏光大于 OLED
- 用户群体：在北美影院看外语片、需要中文字幕等非英法字幕的观众
- **已发布 v1.0**：62 文件，+9,427 行代码，3 天开发周期
- **已发布 v1.1**：2 phases, 7 plans, 18 tasks — wall-clock session 持久化 + 断点续播
- **已发布 v1.2**：4 phases（07–10），17 文件 +2,023/−98 行 — Timeline 拖拽导航 + 暗场手势 + 控制区分层/设置抽屉，172 单测全绿
- PlaybackControls.tsx 当前承载 10+ 按钮平铺，暗场环境下操作困难
- v1.1 的 wall-clock session 机制（startedAt + offset）为 v1.2 Seek 同步提供基础

## Tech Stack

- Vite 6 + vite-plugin-pwa
- React 18 + TypeScript
- chardet（编码检测）+ native TextDecoder
- idb（IndexedDB 封装）
- Native Screen Wake Lock API + NoSleep.js 降级
- i18n: React Context + 字典（无额外依赖）

## Constraints

- **技术形态**: PWA 网站 — 无需 App Store，浏览器即可运行
- **同步方式**: 手动对齐（v1）— 预告片导致音频识别不可靠
- **字幕获取**: 用户自行下载 SRT（v1）
- **设备兼容**: 优先 OLED 屏幕优化，同时兼容 LCD

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA 而非原生 App | 无需配置 Android Studio/Xcode | ✅ 验证：开发部署高效 |
| 手动同步而非音频识别 | 预告片阶段无有效音频特征 | ✅ 验证：时间偏移功能完善 |
| 用户自行下载字幕 | v1 先验证核心体验 | ✅ 验证：文件导入流程完整 |
| 黑屏白字显示 | OLED 纯黑背景最小化影响 | ✅ 验证：Fullscreen API 纯黑 |
| 中英双语 | 目标用户需求 | ✅ 验证：i18n 完整 |
| Fullscreen API | 影院场景需隐藏状态栏 | ✅ 验证：自动全屏 + 手动切换 |
| Wake Lock 双策略 | iOS 版本兼容性 | ✅ 验证：原生 + NoSleep.js |
| FUTR-01 音频对齐保持 deferred | 上映窗口期无合法参照音频；会话持久化已覆盖真痛点 | — v1.1 评估结论 |
| Seek 双路径 + offset-inclusive 空间 | 播放态重锚定无缝继续，暂停态立即刷新字幕；入参与显示统一含 offset | ✅ 验证：Phase 7 UAT 7/7 + VERIFICATION 4/4 |
| totalDurationMs = 末 cue end | Timeline 右端即最后一条字幕 end，不扩展空白；零 cue 时为 0 | ✅ 验证：Phase 7 单元覆盖 + Timeline 正常显示 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-09-04 after v1.2 milestone*
