# 影院同步字幕工具 (CinemaSyncSubs)

## What This Is

一个 PWA 工具，让非英语母语观众在北美影院观看外语片时，用手机作为同步字幕显示器。用户提前下载 SRT 字幕文件，在影院手动同步播放，黑屏白字显示字幕，解决"听不懂剧情"的核心痛点。

## Core Value

让非英语母语观众在影院看外语片时能跟上剧情——即使没有 CC 设备或 CC 只有英法字幕。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 用户可导入 SRT 字幕文件（文件选择器）
- [ ] 解析 SRT 时间轴并逐条显示字幕
- [ ] 手动按下"开始"按钮后按时间轴播放字幕
- [ ] 黑屏白字显示模式（OLED 纯黑背景）
- [ ] 最低亮度友好的 UI（大字体、高对比度白色文字）
- [ ] 支持横屏显示（影院使用场景）
- [ ] 添加到主屏幕功能（PWA manifest）

### Out of Scope

- 字幕快进/慢速调整（时间轴不同步时）— v1 手动对齐即可，时间轴偏移是边缘情况
- 在线字幕搜索/下载 — v1 用户自行下载，降低初始复杂度
- 音频自动对齐 — 预告片导致不可靠，v1 不做
- 原生 App（iOS/Android）— PWA 起步，无需 App Store
- 多语言字幕同时显示 — v1 单语言
- 字幕翻译功能 — v1 仅播放已有字幕

## Context

- 北美影院 CC 闭字幕设备仅提供英语/法语字幕，无法服务非英语母语观众
- 部分场次无 CC 设备可用
- 电影上映后几天内通常就有可用的 SRT 字幕文件
- OLED 屏幕可实现纯黑背景（关闭像素），仅白色文字发光，对周围观众影响极小
- LCD 屏幕最低亮度约 2-5 nit，黑屏白字方案仍可用但漏光大于 OLED
- 用户群体：在北美影院看外语片、需要中文字幕等非英法字幕的观众

## Constraints

- **技术形态**: PWA 网站 — 无需 App Store，浏览器即可运行，调试门槛最低
- **同步方式**: 手动对齐（v1）— 预告片导致音频识别不可靠
- **字幕获取**: 用户自行下载 SRT（v1）— 先验证核心体验
- **设备兼容**: 优先 OLED 屏幕优化，同时兼容 LCD
- **用户背景**: 产品经理，无开发经验，依赖 AI 工具生成代码

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA 而非原生 App | 无需配置 Android Studio/Xcode，浏览器即可调试 | — Pending |
| 手动同步而非音频识别 | 预告片阶段无有效音频特征，手动最务实 | — Pending |
| 用户自行下载字幕 | v1 先验证核心体验，降低初始复杂度 | — Pending |
| 黑屏白字显示 | OLED 纯黑背景最小化对周围观众影响 | — Pending |

---

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
*Last updated: 2026-07-25 after initialization*
