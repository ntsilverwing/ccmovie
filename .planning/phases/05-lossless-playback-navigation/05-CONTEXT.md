# Phase 5: Lossless Playback Navigation - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

播放页 ↔ 选择页的无损导航（PLAY-08）：用户可离开播放页回到字幕选择页而不丢失任何播放状态（当前字幕、时间偏移、显示设置）；字幕时钟基于真实时间继续走；重进播放页按 `now − startedAt + offset` 无缝续播。同时接管 Android PWA 系统返回手势/返回键，使其回到选择页而非退出应用。

**不在本阶段：** 跨杀进程/刷新的会话持久化（IndexedDB 写入、续播卡片、过期策略）= Phase 6。Phase 5 的会话只存活在内存中——但会话数据模型（字幕 ID + startedAt 时间戳 + offset）应在本阶段成型，设计上为 Phase 6 直接落库预留结构。

</domain>

<decisions>
## Implementation Decisions

### 返回手势拦截
- **D-01:** 采用 `history.pushState` + `popstate` 接管 Android PWA 返回手势/返回键。进入播放视图时 push 一条带 `{view:'playback'}` 标记的 state 条目；`popstate` 触发视图切换（播放→选择页）而非应用退出。
- **D-02:** 防止历史条目堆叠：从任何路径重进播放视图时先检查栈顶 state，已是 playback 条目则用 `replaceState` 而非再 push。
- **D-03:** 选择页（非播放页）按系统返回键 = 自然退出 app（Android 惯例），不做二次确认。

### 离开播放页后的系统行为
- **D-04:** 双释放——离开播放视图即 `exitFullscreen()` + 释放 Wake Lock。字幕时钟继续走（playback status 保持），不 pause。
- **D-05:** 重进播放视图时在用户点击手势链内重新申请 Wake Lock + 全屏（沿用现有 `handlePlay` 同步手势链模式，iOS 兼容）。

### 重进播放的入口
- **D-06:** Toast 短暂提示消退后，选择页顶部常驻"继续播放"横幅（片名 + 已播时长 + 一键续播按钮），会话存活期间一直展示。
- **D-07:** 横幅与 Phase 6 的续播卡片设计为同位置、同组件基础，两期 UI 天然一致。Phase 6 在其上加 IndexedDB 来源与过期语义。
- **D-08:** 横幅可手动关闭，关闭 = 停止并放弃当前会话（语义与 Phase 6 续播卡片一致，单一心智模型）。

### 返回控件
- **D-09:** 单击可逆——返回控件单击即返回，无双击/长按/弹窗确认。防误触由两点承担：低视觉权重样式 + 操作完全可逆（横幅一键回播放，按 Baymard "可逆优于确认" 原则）。

### the agent's Discretion
- 返回控件具体形态：沿用现有双语文字按钮家族（如 `‹ 返回`），降低不透明度/视觉权重，触控区保持 ≥48px（现有 `control-button` 家族规范）。
- Toast 时长：3–4 秒自动淡出（"短暂"的量级由 planner 定）。
- 重进播放视图后控制栏短暂显示，沿用既有 3 秒自动隐藏计时器逻辑。
- 播放中离开期间若字幕自然播完（引擎 auto-stop），回到选择页时横幅/视图按 `status → idle` 后的现有逻辑收敛。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与机制设计
- `.planning/REQUIREMENTS.md` § v1.1 → PLAY-08 — 本期锁定的 5 条行为细则（控制栏弱化返回项、系统返回接管、状态保留、选择页提示、无缝续播公式）
- `.planning/notes/audio-sync-assessment.md` — 会话机制设计依据：`startedAt` 真实时间戳 + 偏移，重进按 `now − startedAt + offset` 定位；Phase 5/6 共用此机制
- `.planning/ROADMAP.md` § Phase 5 — 目标与 4 条成功标准

无外部 spec/ADR —— 需求已完整捕获于上述决策与引用中。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/playback/PlaybackEngine.ts` — `startTime = performance.now() − pausedElapsed` 的绝对时间架构；同会话内跨视图天然存活（engine 实例在 hook 的 ref 里，不随视图切换销毁）。`setOffset` 已支持运行中实时调偏移。
- `src/hooks/usePlaybackEngine.ts` — useReducer 状态机（idle/playing/paused）+ engineRef 模式；本阶段视图状态不应塞进此 reducer，宜在 App 层新增独立 view 状态。
- `src/components/PlaybackControls.tsx` — 播放控制栏组件，弱化返回项插入点（playing/paused 分支的按钮家族中）。
- `src/hooks/usePersistedSettings.ts` — 设置（含 offsetMs）已持久化 localStorage，跨视图天然保留。
- `src/App.tsx` 的 `handlePlay` — Wake Lock + 全屏的手势链申请模式，D-05 直接复用。
- `src/db/database.ts` + `src/db/subtitles.ts` — idb 封装已就绪（Phase 6 落库用，本阶段只读不写库）。

### Established Patterns
- 无 router、无 URL 路由概念 —— 三视图（import / ready / playback）由 `App.tsx` 内 `playbackState.status` + `subtitle` 条件渲染驱动。本阶段首次引入 history API。
- 视图分支硬耦合：`status === 'playing'|'paused'` 即强制渲染播放视图——这是要解开的耦合（新增 view 状态后，playing 也可停留在选择视图）。
- 控制栏 3 秒无操作自动隐藏（pointermove/touchstart 重置）——返回控件会随之隐藏，与"低视觉权重"目标一致。
- i18n：所有 UI 文案走 `t(key)` 字典（en/zh），新文案（横幅、toast、返回）需双语键。
- CSS 类名 + `index.css`（无 Tailwind）；`.saved-movies` 列表是选择页顶部区域的现有样式参照。

### Integration Points
- `App.tsx` — 新增 view 状态（如 `'selection' | 'playback'`）替代 status 硬耦合；history pushState/popstate 监听生命周期的唯一家。
- 离开播放路径（返回控件 + popstate）→ 双释放（`handleStop`-like 但不清状态：退全屏 + 放锁，不 stop 引擎）。
- 选择页顶部（import 视图 `saved-movies` 区之上）→ 常驻横幅挂点；toast 同区域。
- `App.tsx` `handleImport` 现有 `stop()` 调用 —— 载入新字幕替换会话的既有入口，与 D-08 语义衔接。

</code_context>

<specifics>
## Specific Ideas

- 用户明确 PWA 线上环境安装已验证可用，历史 todo（v1-pwa-subtitle-player.md）无需跟进。
- 影院场景主线：任何在黑暗环境中增加交互摩擦的设计（确认弹窗、双击、长按）均被明确否决——可逆性优先。

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `.planning/todos/pending/v1-pwa-subtitle-player.md`（开发 v1 PWA 字幕播放页面）— 历史 v1 种子，其范围已全部在 v1.0 交付；经用户确认不纳入本阶段，可后续清理。

None otherwise — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Lossless-Playback-Navigation*
*Context gathered: 2026-07-30*
