# 影院同步字幕工具 (CinemaSyncSubs)

## What This Is

一个 PWA 影院字幕工具，让非英语母语观众在影院看外语片时能跟上剧情。用户导入 SRT 字幕文件，横屏播放时黑屏白字显示字幕，支持中英双语界面、时间偏移调整和高对比度模式，可安装到主屏幕离线使用。

## Core Value

让非英语母语观众在影院看外语片时能跟上剧情——即使没有 CC 设备或 CC 只有英法字幕。

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

### Active

（无 — v1.0 所有需求已完成）

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

---

*Last updated: 2026-07-29 after v1.0 milestone*
