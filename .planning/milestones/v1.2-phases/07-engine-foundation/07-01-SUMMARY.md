---
phase: 07-engine-foundation
plan: 01
subsystem: playback
tags: [playback-engine, session, seek, offset-inclusive, wall-clock, vitest, tdd]
requires:
  - phase: 05-lossless-playback-navigation
    provides: PlaybackEngine seekTo offset-inclusive contract, session wall-clock model
  - phase: 06-session-persistence-resume
    provides: usePlaybackEngine persistence effect (hasPersistedRef), IndexedDB session hydration
provides:
  - PlaybackEngine.seek(targetMs) — playing re-anchors startTime, paused updates pausedElapsed + immediate onCueChange
  - seekSession(session, targetMs, now) pure transition — playing: startedAt = now - (targetMs - offsetMs), paused: pausedElapsedMs = targetMs - offsetMs
  - usePlaybackEngine.seek(targetMs) — engine.seek + setSession(seekSession) with effect-driven IndexedDB persistence
affects: [08-timeline-progress-bar, 09-gesture-navigation, 10-control-layering]

tech-stack:
  added: []
  patterns:
    - "Paused seek immediate cue emission: pausedElapsed → findActiveCue → onCueChange without starting rAF"
    - "Offset-inclusive seek space: targetMs includes offsetMs, engine stores offset-exclusive pausedElapsed"
    - "Hook-level seek atomically updates engine and session so existing persist effect handles IndexedDB"

key-files:
  created: []
  modified:
    - src/playback/session.ts
    - src/playback/PlaybackEngine.ts
    - src/hooks/usePlaybackEngine.ts
    - test/unit/session.test.ts
    - test/unit/playbackEngine.test.ts

key-decisions:
  - "D-08 paused Seek保持暂停并立即更新画面: paused分支不调用play(), 通过findActiveCue+onCueChange立即刷新字幕"
  - "D-09 暂停定位立即持久化: hook的seek通过setSession触发已有persist effect, 不在拖拽中间帧写IndexedDB"
  - "D-11 offset-inclusive空间: seek入参targetMs与sessionElapsedMs一致, 内部减去offsetMs存储"

patterns-established:
  - "Engine seek dual-path: isPlaying ? re-anchor startTime : update pausedElapsed + emit cue"
  - "Session seek pure function with clock injection: seekSession(session, targetMs, now)"
  - "seekTo alias preserves Android-suspend re-anchor contract"

requirements-completed: [ENG-01, ENG-02]

coverage:
  - id: D1
    description: "PlaybackEngine.seek 在播放态重锚定 startTime 无缝继续, 暂停态更新 pausedElapsed 并立即触发 onCueChange"
    requirement: ENG-01
    verification:
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#seek while paused updates pausedElapsed and fires onCueChange immediately"
        status: pass
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#seek while playing re-anchors and continues"
        status: pass
    human_judgment: false
  - id: D2
    description: "seekSession 在播放态重算 startedAt, 暂停态更新 pausedElapsedMs, 使得 sessionElapsedMs 立即等于 targetMs"
    requirement: ENG-02
    verification:
      - kind: unit
        ref: "test/unit/session.test.ts#seekSession re-anchors playing session"
        status: pass
      - kind: unit
        ref: "test/unit/session.test.ts#seekSession updates paused session"
        status: pass
      - kind: unit
        ref: "test/unit/session.test.ts#resuming after paused seek starts at targetMs"
        status: pass
    human_judgment: false
  - id: D3
    description: "usePlaybackEngine.seek 原子更新 engine 与 session, 刷新后从 Seek 位置续播"
    requirement: ENG-02
    verification:
      - kind: unit
        ref: "test/unit/session.test.ts + test/unit/playbackEngine.test.ts — 117 tests green"
        status: pass
    human_judgment: true
    rationale: "IndexedDB 持久化与刷新后续播需真机/浏览器手动验证, 单元测试仅覆盖纯函数与引擎内存状态"

duration: 8min
completed: 2026-08-31
status: complete
---

# Phase 07 Plan 01: Engine Seek & Session Sync Summary

**PlaybackEngine 与 session 新增 offset-inclusive Seek：播放态重锚定无缝继续，暂停态立即刷新字幕并同步 wall-clock 会话，刷新后续播落在 Seek 位置**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-31T10:30:00Z
- **Completed:** 2026-08-31T11:46:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `seekSession()` 纯函数实现 ENG-02：播放态 `startedAt = now - (targetMs - offsetMs)`，暂停态 `pausedElapsedMs = targetMs - offsetMs`，`sessionElapsedMs` 立即等于目标值
- `PlaybackEngine.seek(targetMs)` 实现 ENG-01：播放态重置 `startTime`，暂停态更新 `pausedElapsed` 并立即 `findActiveCue` + `onCueChange`，`seekTo` 保留为别名
- `usePlaybackEngine.seek` 暴露：`engineRef.current?.seek(targetMs)` + `setSession(prev => seekSession(prev, targetMs, Date.now()))`，复用已有 persist effect 实现 D-09 立即持久化

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend session.ts for Seek** - `98e0b1e` (feat: seekSession pure transition + 3 unit tests)
2. **Task 2: Extend PlaybackEngine.ts for Seek** - `98e0b1e` (feat: dual-path seek + paused immediate cue emission)
3. **Task 3: Expose Seek in usePlaybackEngine.ts** - `98e0b1e` (feat: hook seek + session sync)

**Plan metadata:** `98e0b1e` (feat: engine seek with session sync)

## Files Created/Modified

- `src/playback/session.ts` - 新增 `seekSession` 纯函数，offset-inclusive 目标空间
- `src/playback/PlaybackEngine.ts` - 新增 `seek(targetMs)` 双路径实现，`seekTo` 改为别名
- `src/hooks/usePlaybackEngine.ts` - 新增 `seek` 回调，暴露于返回对象
- `test/unit/session.test.ts` - 新增 seekSession 3 用例：播放重锚定、暂停更新、暂停后 resume 平滑
- `test/unit/playbackEngine.test.ts` - 新增暂停 Seek 立即触发 onCueChange 用例

## Decisions Made

- D-08：暂停 Seek 不自动播放，通过 `findActiveCue(targetMs)` 立即计算并触发回调，保持暂停态
- D-09：暂停定位在提交时通过 `setSession` 触发一次性 IndexedDB 写入，不在拖拽每帧写入
- D-11：所有 Seek 入参与显示均采用 offset-inclusive 空间，与 SessionBanner 一致

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Timeline 拖拽可直接调用 `usePlaybackEngine.seek(targetMs)`，无需额外引擎或会话适配
- 暂停态 Seek 的立即 cue 刷新已满足 Timeline 暂停拖拽实时预览需求
- 已验证 `npm test` 117 passed, `tsc --noEmit` clean

---
*Phase: 07-engine-foundation*
*Completed: 2026-08-31*
