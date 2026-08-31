# Domain Pitfalls

**Domain:** Cinema Subtitle PWA — Playback UI Redesign & Timeline (v1.2)
**Researched:** 2026-08-31
**Overall confidence:** HIGH (cross-referenced web research against actual codebase: PlaybackEngine.ts, session.ts, usePlaybackEngine.ts, PlaybackControls.tsx)

---

## Critical Pitfalls

Mistakes that break the core v1.2 experience or corrupt session persistence.

### Pitfall 1: Timeline Scrubber Flicker During Playback

**What goes wrong:**
User drags the timeline thumb while subtitles are playing. The scrubber position flickers — jumping between the user's drag position and the engine's continuously-advancing position. The rAF tick keeps computing `elapsed = performance.now() - startTime + offsetMs` and firing `onCueChange`, which re-renders the timeline, overriding the thumb position set by the drag handler.

**Why it happens:**
The PlaybackEngine's `tick()` runs every frame via rAF and always computes position from `startTime`. During a drag, the UI tries to set position from mouse/touch coordinates, but the next tick overwrites it. This is the #1 reported issue in custom seekbar implementations (React Player #1860, Medium seekbar tutorials).

**Consequences:**
Scrubbing is unusable during playback. User cannot seek. In a dark cinema, this is a showstopper — they can't see well enough to precisely tap, and dragging doesn't work.

**Prevention:**
- **Pause the engine's position advance during scrub, not playback itself.** Set a `isScrubbing` flag in the engine that makes `tick()` skip position computation (keep rAF running for resume, but don't call `onCueChange`). On scrub release, call `seekTo(targetMs)` and clear the flag.
- Alternative (simpler): call `engine.pause()` on scrub start, `engine.play()` + `seekTo()` on scrub end. This matches native browser seekbar behavior.
- **Never** let the drag handler write position state that the rAF tick will overwrite on the next frame.

**Warning signs:**
- Thumb position oscillates between two values during drag
- `onCueChange` fires during drag when it shouldn't
- Console shows rapid alternating cue indices

**Phase to address:**
Phase: Timeline UI (UI-03) + Enhanced Seek (ENG-01) — must be solved together

---

### Pitfall 2: Session-Engine Clock Desync After Seek

**What goes wrong:**
User seeks via timeline. The engine's `seekTo()` updates `startTime` so the engine shows the correct position. But the wall-clock session (`PlaybackSession.startedAt`) is NOT re-anchored. The SessionBanner, ResumeCard, and any future resume-from-persisted-state all show the OLD position — or worse, a position that jumps backward when the user resumes after a refresh.

**Why it happens:**
The dual-source clock architecture uses `performance.now()` for the engine and `Date.now()` for the session. `seekTo(elapsedMs)` only touches the engine:
```typescript
// Current seekTo — engine only
this.startTime = performance.now() - (elapsedMs - this.offsetMs)
```
The session's `startedAt` still reflects the original play start. After seek, `sessionElapsedMs(session, now)` returns `now - startedAt + offsetMs` — which is the PRE-seek position, not the post-seek position.

**Consequences:**
- Banner time display jumps back to pre-seek position on next tick
- If user refreshes after seeking, resume restarts from the OLD position
- The 6-hour session expiry window is measured from the wrong `startedAt`
- After Android suspend, `resyncToSession()` re-anchors the engine to the stale session position, undoing the user's seek

**Prevention:**
- After every seek, re-anchor the session: `startedAt = Date.now() - (targetMs - offsetMs)` so that `now - startedAt + offsetMs === targetMs` for all future `now`.
- Add a `seekSession(session, targetMs, now, offsetMs)` pure function to session.ts that returns a fresh session with re-anchored `startedAt`.
- The hook's seek handler must call BOTH `engine.seekTo(targetMs)` AND `setSession(seekSession(...))` atomically.
- **Test:** seek to 30min, refresh page, verify resume starts at 30min (not 0 or pre-seek position).

**Warning signs:**
- Banner time decreases after a forward seek
- Resume after refresh doesn't match the position shown before refresh
- `sessionElapsedMs` returns a value that doesn't match the engine's current cue

**Phase to address:**
Phase: Session State Sync (ENG-02) — this IS the ENG-02 deliverable

---

### Pitfall 3: Offset Double-Application in Seek Path

**What goes wrong:**
After seeking, the displayed position is off by exactly the offset value (e.g., +2.5s). The user set offset to +2.5s to fix early subtitles, seeks to 1:00:00, but the display shows 1:00:02.500.

**Why it happens:**
The current `seekTo` subtracts offset:
```typescript
this.startTime = performance.now() - (elapsedMs - this.offsetMs)
```
Then `tick()` adds it back:
```typescript
const elapsed = performance.now() - this.startTime + this.offsetMs
```
This is correct for the engine. BUT if the session's `sessionElapsedMs` also adds offset (`base + session.offsetMs`), and the seek target was already in "offset-inclusive space" (the value the user sees), then offset gets applied twice: once by the engine's internal accounting, once by the session display function.

The existing `restoreSession` path handles this correctly: it passes `sessionElapsedMs(live, now)` (offset-inclusive) to `seekTo`, which subtracts offset internally. But a naive seek implementation might pass a raw target without considering which space it's in.

**Consequences:**
- Position display is consistently wrong by the offset amount
- Confusing debugging: the math looks correct in isolation but the spaces are mixed

**Prevention:**
- **Define position spaces explicitly:** "engine space" = raw subtitle time (no offset), "display space" = engine space + offset. Document which space each function expects.
- `seekTo` accepts display-space targets (what the user sees) and converts internally — this is the existing contract.
- Session re-anchoring must also work in display space: `startedAt = now - (targetDisplayMs - offsetMs)`.
- Add a contract test: `seekTo(X)` followed by `tick()` must produce elapsed ≈ X (within frame delta).

**Warning signs:**
- Displayed time is off by exactly the offset value
- Seek to 0:00:00 shows the offset value instead of 0:00:00

**Phase to address:**
Phase: Enhanced Seek (ENG-01) + Session State Sync (ENG-02)

---

### Pitfall 4: Gesture False Positives in Dark Theater

**What goes wrong:**
User holds the phone in a dark cinema. Slight hand tremors or grip adjustments trigger swipe gestures, jumping to the next/previous subtitle unexpectedly. Or: the swipe is interpreted as a scroll, doing nothing, and the user swipes harder — triggering two jumps.

**Why it happens:**
- No minimum distance threshold: any touch movement > 1px triggers navigation
- No velocity check: slow drags (user resting finger) count as swipes
- Touch events aren't prevented from propagating to the browser's scroll handler
- The cinema context means the phone is often held in one hand with an unstable grip

**Consequences:**
- Subtitle jumps to wrong position, user loses their place in the movie
- User can't find where they were (no undo for gesture jumps)
- Frustration in a dark environment where the controls are hard to see

**Prevention:**
- **Minimum distance threshold:** require > 30px vertical movement before recognizing a swipe (prevents tremor false positives)
- **Velocity threshold:** require movement speed > 100px/s (prevents slow accidental drags)
- **Direction lock:** once a swipe direction is determined, lock it — don't allow the same touch to trigger both up and down
- **Visual feedback:** show a transient indicator ("Next subtitle" / "Previous subtitle") during the swipe so the user knows what will happen
- **Haptic feedback** (if available): a light vibration on gesture recognition confirms the action
- **Cooldown period:** 300ms after a gesture to prevent rapid-fire accidental triggers

**Warning signs:**
- Subtitles jump when user is just holding the phone
- Multiple jumps from a single swipe gesture
- User reports "it keeps skipping on its own"

**Phase to address:**
Phase: Gesture Navigation (UI-02)

---

### Pitfall 5: React Re-Render Storm During Timeline Drag

**What goes wrong:**
Every mousemove/touchmove event during a timeline drag dispatches a state update. At 60fps drag speed, that's 60 `setState` calls per second, each triggering a re-render of the timeline component AND its parent (PlaybackControls) AND any children. The UI becomes janky, battery drains rapidly, and on low-end devices the drag lags behind the finger.

**Why it happens:**
React's `useState`/`useReducer` trigger re-renders on every dispatch. The natural implementation stores drag position in state:
```typescript
const [dragPosition, setDragPosition] = useState(0)
// In drag handler:
setDragPosition(clientX) // 60x/sec = 60 re-renders/sec
```
This is the same class of problem that causes React Flow to re-render all 100 nodes when dragging one.

**Consequences:**
- Visible jank during drag — thumb lags behind finger
- Battery drain during a 2-hour movie (drag happens multiple times)
- On low-end Android devices (common in the target demographic), the UI may freeze

**Prevention:**
- **Use useRef for drag position, not useState.** Update a ref during drag, and directly manipulate the DOM (e.g., `thumb.style.transform`) for visual feedback. Only commit to React state on drag end.
- **Throttle state commits:** if you must use state, throttle to 15-20fps (every 50-66ms) — smooth enough for visual feedback, 3-4x fewer renders.
- **Isolate the timeline component:** wrap in `React.memo` so parent re-renders don't cascade into the timeline.
- **Avoid inline function props** in the timeline — they force re-renders on every parent render.

**Warning signs:**
- Chrome DevTools Performance panel shows 60+ "Update" events per second during drag
- Battery drains faster than expected during playback
- Drag feels "sticky" on mid-range devices

**Phase to address:**
Phase: Timeline UI (UI-03)

---

### Pitfall 6: Session Persistence Write Amplification on Seek

**What goes wrong:**
Every pixel of timeline drag triggers `setSession()`, which triggers the `useEffect` persistence effect, which calls `saveSession()` → IndexedDB write. During a 2-second drag, that's 120+ IndexedDB writes. This drains battery, causes micro-stutters, and on iOS (with its aggressive storage management) may hit quota limits or corrupt the session record.

**Why it happens:**
The existing `usePlaybackEngine` hook persists on every `setSession` call:
```typescript
useEffect(() => {
  if (session !== null) {
    void saveSession(session)
  }
}, [session])
```
This is correct for play/pause/stop transitions (infrequent), but if seek also calls `setSession` on every drag tick, the persistence layer gets hammered.

**Consequences:**
- Battery drain during a 2-hour movie
- Micro-stutters on every drag frame (IndexedDB write is async but the `setSession` → `useEffect` → `saveSession` chain has overhead)
- On iOS, excessive writes may trigger storage pressure, causing the 7-day eviction to happen faster

**Prevention:**
- **Decouple drag position from session state.** The session should only be updated on seek COMMIT (drag end), not during drag.
- During drag, update a ref or local state for visual feedback only.
- On drag end, call `seekTo()` + `setSession()` ONCE.
- **Debounce session persistence** if seek must update during drag: throttle to once per 500ms maximum.

**Warning signs:**
- IndexedDB write count is proportional to drag distance
- Battery drains faster when user interacts with timeline
- `saveSession` called more than once per user action

**Phase to address:**
Phase: Session State Sync (ENG-02) + Timeline UI (UI-03)

---

## Moderate Pitfalls

### Pitfall 7: Touch-Action CSS Oversight Blocks Gestures

**What goes wrong:**
Swipe gestures don't fire because the browser intercepts the touch as a scroll or pinch-zoom. The user swipes but nothing happens.

**Why it happens:**
Mobile browsers default to `touch-action: auto` on most elements. Without explicit `touch-action: none` or `touch-action: pan-y` on the gesture area, the browser's default behavior (scroll, zoom) takes priority over custom touch handlers. On iOS, `preventDefault()` in touch handlers only works if the listener is non-passive.

**Prevention:**
- Add `touch-action: none` to the gesture overlay element (the full-screen area that captures swipes)
- Add `touch-action: pan-y` to the timeline (allows vertical scroll but captures horizontal drag)
- Use `{ passive: false }` on touch event listeners that call `preventDefault()`
- Test on real iOS Safari — the simulator doesn't reproduce touch-action bugs reliably

---

### Pitfall 8: Gesture Discoverability in Dark Environment

**What goes wrong:**
User doesn't know swipe gestures exist. They only see the (now layered) control bar and never discover they can swipe to skip subtitles.

**Why it happens:**
Gestures are invisible by definition. In a dark cinema, the user can't see on-screen hints. The v1.0 UI had a single obvious "Start" button; v1.2 adds hidden interactions.

**Prevention:**
- Show a one-time gesture hint overlay on first v1.2 launch (dismissible, with "don't show again")
- Add subtle chevron icons (↑↓) on the screen edges as gesture affordances
- Include gesture instructions in the settings panel
- **Always provide button alternatives** — the existing ±0.5s offset buttons can serve as the accessible fallback for subtitle navigation

---

### Pitfall 9: Playing vs Paused Seek Asymmetry

**What goes wrong:**
Seeking while playing works smoothly, but seeking while paused leaves the engine in a weird state — the subtitle doesn't update until the user presses play, or the engine restarts unexpectedly.

**Why it happens:**
The current `seekTo()` only updates `startTime` and resets `lastIndex`. If the engine is paused, the rAF loop isn't running, so `tick()` won't fire to detect the new active cue. The user seeks while paused, sees no change, and thinks it didn't work.

**Convention:**
- After `seekTo()` while paused, manually call `findActiveCue()` and `onCueChange()` to update the displayed subtitle immediately.
- Or: after seek while paused, run a single `tick()` to re-evaluate the active cue without starting the rAF loop.
- Document the expected behavior: "Seek while paused = jump to that position and show the subtitle there (if any). Seek while playing = jump and continue playing."

---

### Pitfall 10: Total Duration Edge Cases

**What goes wrong:**
Timeline shows total duration as 2:00:00, but the last subtitle ends at 1:52:00. The last 8 minutes of the timeline are empty — the scrubber moves but no subtitles appear. Or: the last cue has an incorrect end time (many SRT files have the last cue end at 24:00:00 as a sentinel).

**Why it happens:**
The plan says "extract last cue end time" for total duration. But:
- SRT files often have a "credits" cue with an artificially long end time
- Some SRT files have gaps between the last real subtitle and the end of the movie
- The last cue's end time may be wrong (typo: 99:59:59)

**Prevention:**
- **Clamp total duration** to a reasonable maximum (e.g., 4 hours) to handle sentinel values
- **Validate the last cue:** if its duration is > 1 hour, it's likely a sentinel — use the start time instead
- **Consider using the second-to-last cue** if the last one is an outlier
- **Display "no subtitle" state** cleanly when the scrubber is in a gap

---

## Minor Pitfalls

### Pitfall 11: Seek Beyond Cue Boundaries Shows Stale Subtitle

**What goes wrong:**
User seeks to a gap between cues. The previous subtitle remains on screen because `onCueChange` only fires when the active index changes, and the gap returns -1 — but the UI might not clear the display if the previous index was also -1.

**Prevention:**
- Ensure `onCueChange(-1)` clears the subtitle display
- Test seeking to: before first cue, between cues, after last cue

---

### Pitfall 12: iOS System Gesture Conflicts

**What goes wrong:**
User's swipe-from-edge triggers iOS back gesture or app switch instead of subtitle navigation.

**Why it happens:**
iOS reserves the left/right screen edges for system back navigation. Swipes starting within ~20px of the edge are intercepted by the OS.

**Prevention:**
- Don't capture swipes in the outer 20px of the screen edges
- Use vertical swipes (up/down) for subtitle navigation — they don't conflict with iOS edge gestures
- Document this as a known limitation

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store drag position in useState | Simple implementation | 60 re-renders/sec during drag | Never — use useRef |
| Skip session re-anchor after seek | Less code | Resume after refresh is wrong | Never |
| Use last cue end as total duration | Easy to implement | Wrong duration for sentinel values | Only with validation/clamping |
| No gesture distance threshold | Gestures feel responsive | False positives in dark theater | Never |
| Persist session on every drag tick | Position always saved | Battery drain, iOS storage pressure | Never — persist on commit only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Timeline → Engine | Drag handler sets state that rAF tick overwrites | Pause position advance during scrub; seekTo on release |
| Timeline → Session | seekTo without re-anchoring startedAt | Re-anchor: `startedAt = now - (targetMs - offsetMs)` |
| Gesture → Engine | Swipe triggers seekTo in engine space (without offset) | Convert to display space, then seekTo handles offset internally |
| Gesture → React | Touch handlers cause full re-render | Use refs + direct DOM manipulation for visual feedback |
| Seek → IndexedDB | setSession on every drag tick | Only setSession on drag end (seek commit) |
| Session → Banner | Banner reads stale startedAt after seek | Re-anchor session before setSession so banner shows correct time |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 60fps state updates during drag | Janky thumb, battery drain | useRef for drag position, commit on release | Immediately on any drag |
| IndexedDB write per drag frame | Micro-stutter, battery drain | Persist only on seek commit | Immediately on any drag |
| Full PlaybackControls re-render on timeline drag | All buttons re-render unnecessarily | React.memo on Timeline component | Immediately on any drag |
| Gesture handler runs hit test on every touchmove | CPU usage during slow drags | Early-exit if direction locked | Low-end Android devices |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hidden gestures | User never discovers swipe navigation | One-time hint overlay + persistent chevron affordances |
| No seek undo | User accidentally seeks, loses their place | Show a "return to previous position" toast for 3 seconds |
| Timeline too thin in dark | User can't see or hit the timeline track | Min 48px touch target height, high-contrast track color |
| No haptic feedback | User unsure if gesture registered | Vibration API on gesture recognition (if available) |
| Gesture conflicts with control bar | Swiping near the bottom hits buttons instead | Place control bar in a non-gesture zone, or use a dead zone |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces for v1.2.

- [ ] **Timeline scrubber:** Works while paused AND while playing — verify no flicker in both states
- [ ] **Seek + Session sync:** Seek to 30min, refresh page, verify resume starts at 30min (not 0, not pre-seek)
- [ ] **Offset after seek:** With +2.5s offset, seek to 1:00:00, verify display shows 1:00:00 (not 1:00:02.500)
- [ ] **Gesture false positive:** Hold phone with slight tremor for 10s — verify no accidental subtitle jumps
- [ ] **Gesture commit:** Swipe, then immediately refresh — verify the seek position was persisted
- [ ] **Drag performance:** Chrome DevTools Performance — verify < 5 state commits per drag (not 60+)
- [ ] **Total duration:** Test with SRT files that have sentinel last cues (24:00:00) — verify reasonable duration
- [ ] **Seek to gap:** Seek between two cues — verify subtitle display clears (shows "no subtitle")
- [ ] **Playing seek:** Seek while playing — verify playback continues smoothly from new position
- [ ] **Paused seek:** Seek while paused — verify subtitle updates immediately without pressing play

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Session desync after seek | LOW | Add `seekSession` pure function, re-anchor in seek handler, hotfix |
| Scrubber flicker | MEDIUM | Add `isScrubbing` flag to engine, pause position advance during drag |
| Gesture false positives | LOW | Add distance/velocity thresholds, no engine changes needed |
| Re-render storm | LOW | Refactor drag handler from useState to useRef |
| Write amplification | LOW | Move setSession from drag handler to drag-end handler |
| Offset double-application | MEDIUM | Audit all seek call sites for position-space correctness, add contract tests |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Scrubber flicker | UI-03 + ENG-01 | Drag timeline while playing — thumb follows finger smoothly |
| Session desync | ENG-02 | Seek → refresh → resume at correct position |
| Offset double-application | ENG-01 + ENG-02 | Contract test: seekTo(X) → tick() ≈ X |
| Gesture false positives | UI-02 | Hold phone test: no jumps in 10s |
| Re-render storm | UI-03 | Performance panel: < 5 commits per drag |
| Write amplification | ENG-02 | IndexedDB write count per seek = 1 |
| Touch-action CSS | UI-02 | Swipe test on real iOS Safari |
| Gesture discoverability | UI-02 | First-launch hint overlay visible |
| Playing/paused seek asymmetry | ENG-01 | Seek while paused → subtitle updates immediately |
| Total duration edge cases | ENG-03 | Test with sentinel-value SRT files |

---

## Sources

- [Implementing seek-bar from scratch - Medium](https://medium.com/@akashduttaofficial2503/implementing-seekbar-for-audio-and-video-player-from-scratch-e0316dce846c) [MEDIUM]
- [React Player #1860: onPause glitches with seek bar](https://github.com/cookpete/react-player/issues/1860) [MEDIUM]
- [BBC TAL Media Playback state machine](https://bbc.github.io/tal/overview/media-playback.html) [HIGH]
- [Firefox AudioSinkWrapper: seek-resume vs unmute](https://firefox-source-docs.mozilla.org/media/AudioSinkWrapper.html) [HIGH]
- [React Flow performance: avoid accessing nodes in components](https://reactflow.dev/learn/advanced-use/performance) [MEDIUM]
- [Gestify: Web Video Gesture Controls Guide](https://www.rabbitpair.com/en/blog/gestify-video-gesture-control-guide) [MEDIUM]
- [Navigating Pitfalls of Gestural Interfaces - CreateWithSwift](https://www.createwithswift.com/navigating-pitfalls-the-dos-and-donts-of-gestural-interfaces) [MEDIUM]
- [Mobile Accessibility Patterns - TestParty](https://testparty.ai/blog/mobile-accessibility-patterns) [MEDIUM]
- [interact.js #892: Draggable items stop after a few pixels mobile](https://github.com/taye/interact.js/issues/892) [MEDIUM]
- [WebKit #162562: Scroll swipe gesture plays inline videos](https://bugs.webkit.org/show_bug.cgi?id=162562) [HIGH]
- Codebase analysis: PlaybackEngine.ts, session.ts, usePlaybackEngine.ts, PlaybackControls.tsx, SessionBanner.tsx, ResumeCard.tsx, db/sessions.ts [HIGH]

---

*Pitfalls research for: CinemaSyncSubs v1.2 — Playback UI Redesign & Timeline*
*Researched: 2026-08-31*
