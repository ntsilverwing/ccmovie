# Plan 07-01: Engine Seek & Session Sync

## Context
This plan implements requirements ENG-01 and ENG-02 from Phase 7 (Engine Foundation).
We need to allow exact seeking in `PlaybackEngine` both while playing and paused, and synchronize this state with the `PlaybackSession` so that reloads/restarts resume accurately. 

**Decisions:**
- D-08: 暂停状态 Seek 后必须保持暂停，同时立即以目标时刻的字幕或空白更新画面；不得自动播放。
- D-09: 暂停状态的定位在提交时立即持久化，保证刷新或被系统终止后仍能恢复到新位置。
- D-11: 定位采用 offset-inclusive 空间，目标时间应包含 offset。

## Steps

1. **Extend `src/playback/session.ts` for Seek**
   - Export a new pure function `seekSession(session: PlaybackSession, targetMs: number, now: number): PlaybackSession`.
   - If playing (`pausedElapsedMs === null`): update `startedAt = now - (targetMs - session.offsetMs)`.
   - If paused (`pausedElapsedMs !== null`): update `pausedElapsedMs = targetMs - session.offsetMs`.
   - Write unit tests in `test/unit/session.test.ts` for both paused and playing states.

2. **Extend `src/playback/PlaybackEngine.ts` for Seek**
   - Modify the existing `seekTo(elapsedMs: number)` method.
   - If playing, it already sets `startTime = performance.now() - (elapsedMs - offsetMs)` and resets `lastIndex = -1`. Keep this.
   - If paused, it must update `pausedElapsed = elapsedMs - offsetMs`, reset `lastIndex = -1`, and immediately call `findActiveCue` using the new `elapsedMs`. If the cue changes, call `this.onCueChange(activeIndex)`.
   - Write unit tests in `test/unit/playbackEngine.test.ts` ensuring `onCueChange` is fired immediately when paused and that `pausedElapsed` is stored correctly.

3. **Expose Seek in `src/hooks/usePlaybackEngine.ts`**
   - Add `seek: (targetMs: number) => void` to the returned hook object.
   - Implementation:
     ```typescript
     const seek = useCallback((targetMs: number) => {
       engineRef.current?.seekTo(targetMs)
       setSession((prev) => prev ? seekSession(prev, targetMs, Date.now()) : prev)
     }, [])
     ```
   - The existing `useEffect` on `session` will naturally persist the modified session to IndexedDB, fulfilling D-09.

## Verification
- Run `npx vitest` to ensure session and playback engine tests pass.
- Start the dev server (`npm run dev`) and test seeking in both playing and paused states.
