# Phase 9: Gesture Navigation - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 7 (4 new, 3 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/playback/cueNavigation.ts` (new) | utility（纯函数模块） | transform | `src/playback/timelineDensity.ts` & `src/playback/session.ts` | exact |
| `test/unit/cueNavigation.test.ts` (new) | test | batch | `test/unit/timelineDensity.test.ts` | exact |
| `src/hooks/useGestureNavigation.ts` (new) | hook | event-driven | `src/hooks/useWakeLock.ts` & `src/hooks/usePlaybackEngine.ts` | exact |
| `src/components/GestureGuide.tsx` (new) | component | presentational / dismissable overlay | `src/components/SessionBanner.tsx` & `src/components/ResumeCard.tsx` | exact |
| `src/App.tsx` (modify: 挂载手势与引导) | integration | state distribution | 自身 L490-530（播放视图挂载） | exact |
| `src/index.css` (modify: 引导层与 touch-action) | style | — | 自身（暗场色板 L5-14、弹窗居中与层级） | exact |
| `src/i18n/translations.ts` (modify: 双语键) | config/i18n | — | 自身（en/zh 对称字典） | exact |

---

## Pattern Assignments

### 1. `src/playback/cueNavigation.ts` (utility, transform) — TDD 先行（tdd_mode: true）

**Analog:** `src/playback/timelineDensity.ts` 与 `src/playback/session.ts`

**设计要点：**
- 纯函数，不依赖浏览器 DOM（除了 localStorage 辅助函数使用防御性隔离），在 Node 环境 Vitest 下 100% 可测。
- `detectGesture(startX: number, startY: number, endX: number, endY: number, threshold = 40): 'up' | 'down' | null`:
  - 计算 $\Delta x = endX - startX, \Delta y = endY - startY$；
  - 严格垂直优先：$|\Delta y| \ge threshold$ 且 $|\Delta y| > |\Delta x|$；
  - $\Delta y < 0$ 返回 `'up'`，$\Delta y > 0$ 返回 `'down'`；其他返回 `null`。
- `isGestureThrottled(now: number, lastTriggeredAt: number, throttleMs = 300): boolean`:
  - `now - lastTriggeredAt < throttleMs` 返回 `true`。
- `findCueNavigationTarget(cues: readonly Cue[], currentTimeMs: number, direction: 'up' | 'down'): number | null`:
  - 空数组返回 `null`；
  - 边界停留：第一句前下滑返回 `null`，最后一句后上滑返回 `null`（D-06）；
  - 空档跳转：处于两句之间空档时，上滑跳到下一句的 `start`，下滑跳到上一句的 `start`（D-07）；
  - 正常处于某句内部时：上滑跳至下一句 `start`，下滑跳至上一句 `start`；
  - 重叠字幕按原始数组下标顺次跳转（D-08）。
- `hasSeenGestureGuide(storage = window.localStorage): boolean`:
  - 包含 try/catch，防止无痕模式或 SecurityError 崩溃，安全返回 boolean。
- `markGestureGuideSeen(storage = window.localStorage): void`:
  - 包含 try/catch，写入键 `cinemasyncsubs-gesture-guide-seen` 为 `'true'`。

### 2. `test/unit/cueNavigation.test.ts` (test, batch)

**Analog:** `test/unit/timelineDensity.test.ts`

**设计要点：**
- Vitest node 环境，零外部 mock 依赖；
- 覆盖 `detectGesture` 的 40px 边界、严格垂直判定、对角线平局、微弱抖动等用例；
- 覆盖 `isGestureThrottled` 0ms、299ms、300ms、301ms 各种时间差；
- 覆盖 `findCueNavigationTarget` 空数组、单条字幕、正常连续字幕、跨越空档、片头空档、片尾空档、重叠字幕、首尾边界停留；
- 覆盖 `hasSeenGestureGuide` / `markGestureGuideSeen` 的无痕模式异常拦截。

### 3. `src/hooks/useGestureNavigation.ts` (hook, event-driven)

**Analog:** `src/hooks/usePlaybackEngine.ts`

**设计要点：**
- 暴露 `containerRef` 或返回事件绑定对象 / 处理函数，挂载于字幕区；
- 使用 `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`；
- 在 `pointerdown` 时记录起手坐标 `(clientX, clientY)`，调用 `e.currentTarget.setPointerCapture(e.pointerId)`；
- 在 `pointerup` 时计算总位移，调用 `detectGesture`；若判定为有效手势且未被节流，则触发对应的 `onSwipeUp` 或 `onSwipeDown` 回调，更新 `lastTriggeredTime`；
- 在抬手或取消时释放指针捕获；
- 若发生有效滑动，调用 `e.preventDefault()` 并重置标记，防止触发随后的模拟点击。

### 4. `src/components/GestureGuide.tsx` (component, presentational)

**Analog:** `src/components/SessionBanner.tsx`

**设计要点：**
- 挂载后通过 `useEffect` 设置 1000ms 定时器控制浮现（D-14）；
- 浮现后设置 3000ms 定时器自动淡出并卸载；
- 支持点击任意处或划动立即关闭；
- 关闭时调用 `markGestureGuideSeen()` 写入 localStorage；
- 遵循 UI-SPEC 色板，使用 `rgba(0, 0, 0, 0.75)` 半透明遮罩与低亮度文字。

### 5. `src/App.tsx` (integration)

**Analog:** 自身播放视图挂载点

**设计要点：**
- 仅在 `status !== 'idle'` 播放视图挂载手势与引导；
- 上滑回调：`const target = findCueNavigationTarget(cues, currentMs, 'up'); if (target !== null) seek(target);`；
- 下滑回调：`const target = findCueNavigationTarget(cues, currentMs, 'down'); if (target !== null) seek(target);`；
- 控制区与 Timeline 位于字幕区下方，不受字幕区 Pointer 事件拦截影响。
