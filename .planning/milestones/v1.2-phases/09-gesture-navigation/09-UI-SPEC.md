---
phase: 9
slug: gesture-navigation
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-02
reviewed_at: 2026-09-02
---

# Phase 9 — UI Design Contract (Gesture Navigation)

> Visual and interaction contract for frontend phases. Generated per UI phase requirements and verified against project constraints.
>
> **Scope:** UI-04（暗场触控手势导航）、UI-05（首次进入手势引导）。定位为影院暗场环境下的**全屏盲操交互层与低亮度一次性引导浮层**——无动画直接切除、无高亮刺眼光污染、轻划即触（40px 短阈值 + 垂直优先 + 300ms 节流）、一次性半透明引导遮罩（1s 延时出现、3s 自动消失或轻触即灭、localStorage 永久记住）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — 原生 Web 平台（Pointer Events + CSS `touch-action: none` + React 18），零新依赖 [source: RESEARCH.md Standard Stack / D-01] |
| Icon library | none（引导卡片内使用内联轻量 SVG 矢量箭头或 unicode 简洁符号） |
| Font | `system-ui, -apple-system, sans-serif`（app 既有全局基线） |

**shadcn Gate 裁定：** `components.json` 不存在，栈为 Vite + React。Gate 结论 = **none** —— v1.2 里程碑锁定零新依赖（RESEARCH.md Standard Stack）与纯 CSS 方案（PROJECT.md Constraints）。无任何 registry 引入，Registry Safety 节为 N/A。

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage（本阶段） |
|-------|-------|-------|
| xs | 4px | 引导图标与文字间距 `gap: 4px` |
| sm | 8px | 引导项目间垂直间距 `gap: 8px` |
| md | 16px | 引导卡片内边距 `padding: 16px 20px` |
| lg | 24px | 引导卡片外边距与距边缘间距 |
| xl | 32px | 引导浮层居中安全区 |
| 2xl | 48px | 引导关闭轻触触发区（全屏遮罩，远大于 48px 最低触控标准） |
| 3xl | 64px | 本阶段未使用 |

Exceptions（固定交互与阈值量纲）:
- 滑动有效触发阈值 `40px`（垂直位移阈值，D-02，非间距）
- 滑动节流时间 `300ms`（D-04，时间量纲）
- 引导浮层延迟出现 `1000ms`（D-14，时间量纲）
- 引导浮层自动消失 `3000ms`（D-14，时间量纲）
- 引导卡片圆角 `8px`（对齐既有弹窗/控制块）

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| 引导标题 (Gesture Guide Title) | 1.05rem (16.8px) | 500 | 1.3 |
| 引导操作项 (Gesture Action Item) | 0.9rem (14.4px) | 400 | 1.4 |
| 引导关闭提示 (Dismiss Hint) | 0.8rem (12.8px) | 400 | 1.2 |
| 字幕区文字 (Subtitle Text) | 沿用既有 `--subtitle-font-size`，本阶段不改动 | 500 | 既有 |

**Rules:**
- 本阶段引导浮层仅引入轻量文字展示，字重严格遵循项目既有规范（500 标题，400 描述与提示）。
- 引导关闭提示使用 muted 次要文本色，确保在暗场中不引起视觉焦点分散。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#000000` | 播放视口全屏背景（OLED 黑，既有） |
| Secondary (30%) | `rgba(0, 0, 0, 0.75)` / `#161616` | 引导全屏遮罩底色与卡片半透明底色 |
| Accent (10%) | `#e0e0e0` / `#888888` | 引导图标与高对比文字（`#e0e0e0`），次要文字与说明（`#888888`） |
| Destructive | N/A | 本阶段无破坏性操作 |

**引导层暗场低亮度色板:**

| Element | Value | Source |
|---------|-------|--------|
| 全屏遮罩背景 | `rgba(0, 0, 0, 0.75)` | D-13 半透明深色遮罩，透出背景字幕但压暗周围 |
| 引导卡片底色 | `rgba(26, 26, 26, 0.92)` | 低亮度微弱灰黑底色 |
| 引导卡片边框 | `1px solid rgba(255, 255, 255, 0.12)` | 极细低对比边框，勾勒轮廓 |
| 引导标题文字 | `#e0e0e0` | 高对比度白色 |
| 手势动作说明 | `#cccccc` | 浅灰色正文 |
| 引导关闭提示 | `#888888` | 次要灰文字 |
| 手势箭头图标 | `#e0e0e0` | 对应滑动方向的直观图标 |

**暗场视觉规则（锁定）：**
- 切换字幕时**无任何高亮闪烁、淡入淡出动画**（D-12），直接切除，避免暗场中亮度跳变引起眼睛不适。
- 引导遮罩在 1 秒延迟后以 `opacity 0.2s ease` 平滑浮现，消失时同样平滑淡出，不使用突兀动画。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 引导浮层标题 | `暗场手势导航` / `Gesture Navigation` |
| 上滑动作说明 | `上滑：跳到下一句` / `Swipe up: Next subtitle` |
| 下滑动作说明 | `下滑：跳到上一句` / `Swipe down: Previous subtitle` |
| 浮层关闭提示 | `轻触任意处关闭` / `Tap anywhere to dismiss` |
| Primary CTA | **none** — 全屏任何位置轻触或滑动均可关闭引导 |
| Empty state | **none** — 无字幕时手势静默不生效 |
| Error state | **none** — 存储异常时内存优雅降级，无错误提示 |

**i18n 新增键**（写入 `src/i18n/translations.ts`，en + zh 对称）:

| Key | en | zh |
|-----|----|----|
| `gestureGuideTitle` | `Gesture Navigation` | `暗场手势导航` |
| `gestureGuideSwipeUp` | `Swipe up: Next subtitle` | `上滑：跳到下一句` |
| `gestureGuideSwipeDown` | `Swipe down: Previous subtitle` | `下滑：跳到上一句` |
| `gestureGuideDismiss` | `Tap anywhere to dismiss` | `轻触任意处关闭` |

---

## UI Considerations

Applicable state considerations resolved: 7 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | 无 cue 字幕文件 | ✅ covered | `findCueNavigationTarget` 返回 null，手势不触发 seek，页面状态保持不变 |
| loading | 进入播放页 | ✅ covered | 播放数据已解析就绪，引导层延时 1000ms 挂载，不阻塞初始渲染 |
| error | localStorage 不可用 / 无痕模式 | ✅ covered | `hasSeenGestureGuide` / `markGestureGuideSeen` 内置 try/catch，降级为当次 session 内存标记 |
| populated | 正常字幕播放与暂停 | ✅ covered | 手势触发 `seek(targetCue.start)`，播放中连续播放，暂停中即时刷新画面与时钟 |
| partial | 位于首句或尾句边界 | ✅ covered | D-06 规则：首句前下滑停留在首句，尾句后上滑停留在尾句，不循环 |
| partial | 位于字幕空档区间 | ✅ covered | D-07 规则：上滑跳至空档后下一句起点，下滑跳至空档前上一句起点，空档中保持黑屏 |
| overflow | 超宽 / 超长字幕多行文本 | ✅ covered | 手势监听器挂载于字幕容器外层，容器声明 `touch-action: none`，手势不截断长文本渲染 |

---

## Component Inventory & Interaction Contract

### 新增与修改文件清单

| Artifact | 职责 |
|----------|------|
| `src/playback/cueNavigation.ts` | 纯函数：`detectGesture`（滑动向量与 40px/垂直优先判决）、`isGestureThrottled`（300ms 节流）、`findCueNavigationTarget`（空档/重叠/边界字幕跳转目标计算）、`hasSeenGestureGuide`/`markGestureGuideSeen`（localStorage 辅助） |
| `test/unit/cueNavigation.test.ts` | 算法全边界单元测试（Vitest node 环境，100% 覆盖） |
| `src/hooks/useGestureNavigation.ts` | React Hook：Pointer 事件监听、指针捕获、手势触发与防误触拦截 |
| `src/components/GestureGuide.tsx` | 首次进入 1s 延时浮现的暗场半透明手势引导组件 |
| `src/index.css` 追加 | `.gesture-guide-*` 样式族及 `.subtitle-container` 的 `touch-action: none` |
| `src/i18n/translations.ts` 追加 | 手势引导四组双语键值 |
| `src/App.tsx` 修改 | 将手势导航 hook 与 GestureGuide 挂载至播放视图 |

### 交互与防误触合同

| 输入场景 | 判定条件 | 响应行为 |
|----------|----------|----------|
| 纵向向上划动 | $\Delta y \le -40\text{px}$ 且 $|\Delta y| > |\Delta x|$ | 判定为有效上滑：计算下一句 cue 的 start，执行 `seek(targetMs)`；进入 300ms 冷却期 |
| 纵向向下划动 | $\Delta y \ge 40\text{px}$ 且 $|\Delta y| > |\Delta x|$ | 判定为有效下滑：计算上一句 cue 的 start，执行 `seek(targetMs)`；进入 300ms 冷却期 |
| 水平划动 / 斜向划动 | $|\Delta x| \ge |\Delta y|$ | 判定为非垂直手势：忽略手势，不触发跳转，允许事件透传 |
| 短距离轻微触碰 / 抖动 | $|\Delta y| < 40\text{px}$ 且 $|\Delta x| < 40\text{px}$ | 判定为点击操作：忽略手势；如果引导层正处于显示状态，则立即关闭引导层 |
| 连续快速划动 | 距上次触发 $< 300\text{ms}$ | 判定为节流期内：忽略多余触发，防止单次快速划动多次跳句 |
| Timeline 进度条拖拽 | 触摸目标位于 `.timeline-container` 内部 | 事件直接由 Timeline 消费，不触发字幕手势导航 |
| 引导层显示状态下点击/划动 | 任意 PointerDown / PointerUp | 立即关闭引导层，写入 localStorage 标记，永不再弹 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none（Tool: none，未初始化） | not applicable |
| third-party | none declared | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-09-02
