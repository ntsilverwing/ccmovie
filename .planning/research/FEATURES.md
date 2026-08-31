# Feature Research

**Domain:** Cinema Subtitle PWA — Playback UI Redesign (Timeline, Gestures, Enhanced Seek)
**Researched:** 2026-08-31
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist given modern media player conventions. Missing these = the redesign feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Progress bar with current/total time** | Every media player since QuickTime has shown progress. Users expect to see where they are in the film. | LOW | Total duration = last cue end time (ENG-03). Current time = session elapsed. |
| **Drag/scrub to seek** | Standard since YouTube/Netflix. Users expect to drag the progress bar to jump to a position. | MEDIUM | Requires enhanced `seek(targetMs)` that works in BOTH playing and paused states (ENG-01). Current `seekTo()` is playing-only. |
| **Tap to reveal/hide controls** | Modern players auto-hide controls. Users tap screen to bring them back. Netflix/YouTube established this. | LOW | Current implementation already has `controlsVisible` — needs auto-hide on idle timeout. |
| **Play/Pause button** | Obvious. Current implementation has it. | LOW | Already built. Just needs repositioning in layered layout. |
| **Current time / total duration display** | Standard alongside progress bar. "1:23:45 / 1:58:00" format. | LOW | Reuse existing `formatElapsedHMS()` from session.ts. |
| **Offset adjustment (+/- 0.5s)** | Already built but needs relocation to settings panel. | LOW | Currently inline in control bar — move to settings drawer. |

### Differentiators (Competitive Advantage)

Features that set the product apart for the cinema subtitle use case. Not expected, but highly valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Gesture-based cue navigation (swipe up/down)** | In a dark theater, the user can't see buttons. Swipe up = next line, swipe down = previous line — operates blind by touch. Unique to subtitle players vs video players. | MEDIUM | Standard media apps use vertical swipe for volume/brightness, but subtitle context repurposes it for cue navigation. Must coexist with horizontal seek. |
| **Timeline with cue markers** | Small dots/markers on the progress bar showing where each subtitle cue starts. Visual density indicator — helps users anticipate upcoming dialogue. | MEDIUM | Distinct from video players that show chapter markers. Cue density is unique to subtitle timeline. |
| **Session-persistent seek** | After seeking, the wall-clock session stays accurate. If user refreshes after seeking, resume continues from the new position. | MEDIUM | Requires ENG-02: update `startedAt`/`offsetMs` on seek so `sessionElapsedMs()` stays correct. Differentiator vs naive players that lose position on refresh. |
| **Seek during pause** | User pauses, drags timeline to a specific subtitle, releases. The paused display shows the target cue immediately. | MEDIUM | Current `seekTo()` only works in playing state. Enhanced `seek(targetMs)` must work in paused state too — most casual players don't even know if their player supports paused-seek. |
| **Large touch targets in dark theater** | Already built (48x48px min) but the redesign must preserve this. Controls usable by feel in pitch black. | LOW | Existing constraint — carry forward into new layered layout. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in the cinema subtitle context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Speed control (0.5x/1.5x/2x)** | Users want to slow down fast dialogue. | Cinema context: playback is synchronized to the FILM'S audio, not independent. Speed change desyncs from the theater's audio track. | Already out of scope in PROJECT.md — time offset adjustment covers the sync need without breaking audio coupling. |
| **Thumbnail preview on scrub** | Netflix/YouTube show video preview while dragging. | No video stream exists — only subtitle cues. Video preview is architecturally impossible. | Show cue text preview instead: as user drays, display the target cue's subtitle text in a floating tooltip. |
| **Skip intro/credits button** | Netflix popularized this. | Cinema subtitle context: no reliable metadata for intro/credits boundaries. Manual timeline + cue markers is more accurate. | Cue marker density visually shows dialogue gaps (credits = sparse section). |
| **Persistent always-on controls** | Users want to always see buttons. | In a dark theater, any lit UI element distracts from the film and disturbs neighbors. OLED pure-black is the entire product premise. | Auto-hide with instant tap-to-reveal. Controls appear only on demand. |
| **Volume/Brightness vertical swipe** | Standard video player gesture. | Cinema context: volume is handled by the device/OS. Brightness is pre-set before film starts. No need for in-player adjustment. | Repurpose vertical swipe for cue navigation (the product's unique differentiator). |
| **Audio waveform visualization** | Looks professional. | No audio stream exists. Would be pure decoration consuming OLED pixels (light pollution in theater). | Cue-position markers provide functional information instead. |

## Feature Dependencies

```
Total Duration (ENG-03)
    └──requires──> Timeline Progress Bar (UI-03)

Timeline Progress Bar (UI-03)
    └──requires──> Enhanced seek(targetMs) (ENG-01)
                        └──requires──> Session Seek Sync (ENG-02)

Enhanced seek(targetMs) (ENG-01)
    └──requires──> Seek during pause (new capability)

Gesture Navigation (UI-02)
    └──conflicts──> Horizontal swipe seek (choose one axis)

Settings Drawer (UI-01)
    └──contains──> Offset adjustment (existing)
    └──contains──> Font size slider (existing)
    └──contains──> High contrast toggle (existing)
    └──contains──> Dim toggle (existing)
    └──contains──> Fullscreen toggle (existing)

Auto-hide controls ──enhances──> Cinema dark-theater UX
```

### Dependency Notes

- **Timeline requires Total Duration (ENG-03):** Cannot render a progress bar without knowing the end point. Total duration = last cue end time, extracted at parse time.
- **Timeline drag-seek requires Enhanced seek (ENG-01):** The current `seekTo()` is designed for session re-anchor (playing state only). Timeline scrubbing needs a new `seek(targetMs)` that works in paused state too.
- **Enhanced seek requires Session Seek Sync (ENG-02):** After seeking, the wall-clock session's `startedAt`/`offsetMs` must update so `sessionElapsedMs()` returns the new position. Without this, a refresh after seek would resume from the pre-seek position.
- **Gesture Navigation conflicts with Horizontal Swipe Seek:** Both use swipes. Resolution: horizontal = timeline scrub (drag the bar itself), vertical = cue navigation (swipe anywhere). This mirrors Gestify's pattern (horizontal = seek, vertical = volume/brightness) but repurposes vertical for cues.
- **Settings Drawer contains existing controls:** The current 10+ button flat layout in `PlaybackControls.tsx` must be redistributed. Primary bar gets play/pause + timeline + settings gear. Everything else goes in the drawer.

## MVP Definition

### Launch With (v1.2)

Minimum viable product — what's needed to validate the redesign concept.

- [ ] **Total duration extraction (ENG-03)** — Without this, no progress bar. Parses at file import.
- [ ] **Timeline progress bar (UI-03)** — Thin bar showing current/total time + cue markers. Auto-hides with controls.
- [ ] **Enhanced seek(targetMs) (ENG-01)** — Works in both playing and paused states. Core engine change.
- [ ] **Session seek sync (ENG-02)** — Seek updates `startedAt`/`offsetMs`. Session stays accurate.
- [ ] **Gesture: swipe up/down for cue nav (UI-02)** — Up = next cue, down = prev cue. Works in dark theater.
- [ ] **Settings drawer (UI-01)** — Consolidates offset, font, contrast, dim, fullscreen into one panel.
- [ ] **Auto-hide controls on idle** — Tap to reveal, 3s timeout to hide. Reduces light pollution.

### Add After Validation (v1.x)

Features to add once core redesign is working.

- [ ] **Cue text tooltip on timeline scrub** — Show target cue text while dragging. Trigger: user feedback after timeline launch.
- [ ] **Keyboard shortcuts for desktop testing** — Arrow keys for cue nav, space for play/pause. Trigger: developer workflow improvement.
- [ ] **Haptic feedback on gesture** — Subtle vibration on cue skip. Trigger: user requests confirmation feedback.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Chapter/scene markers** — Long-press timeline to add bookmarks. Why defer: requires manual annotation, no metadata source.
- [ ] **Waveform from device microphone** — Audio-based sync. Why defer: PROJECT.md explicitly deferred (trailer audio unreliable).
- [ ] **Apple Watch / Wear OS companion** — Cue nav on wrist. Why defer: v1 is phone-only PWA.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Total duration extraction (ENG-03) | HIGH (unblocks timeline) | LOW (parse-time extraction) | P1 |
| Enhanced seek(targetMs) (ENG-01) | HIGH (unblocks timeline + gestures) | MEDIUM (engine modification) | P1 |
| Session seek sync (ENG-02) | HIGH (data integrity) | LOW (pure function addition) | P1 |
| Timeline progress bar (UI-03) | HIGH (core redesign goal) | MEDIUM (new component + CSS) | P1 |
| Gesture: swipe cue nav (UI-02) | HIGH (unique differentiator) | MEDIUM (touch handler + conflict resolution) | P1 |
| Settings drawer (UI-01) | MEDIUM (consolidation, not new function) | MEDIUM (relayout + animation) | P1 |
| Auto-hide controls on idle | MEDIUM (cinema UX) | LOW (timeout + CSS transition) | P2 |
| Cue text tooltip on scrub | LOW (nice-to-have) | LOW (overlay component) | P3 |
| Keyboard shortcuts | LOW (desktop convenience) | LOW (event listener) | P3 |
| Haptic feedback on gesture | LOW (confirmation) | LOW (Vibration API) | P3 |

**Priority key:**
- P1: Must have for this milestone (v1.2)
- P2: Should have, add when possible (idle auto-hide — can ship without but degrade cinema UX)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Video Players (YouTube/Netflix) | Subtitle Tools (Subtitle Edit / LLN) | Our Approach |
|---------|-------------------------------|--------------------------------------|--------------|
| Timeline scrub | Drag progress bar + thumbnail preview | Waveform-based navigation | Drag progress bar + cue markers (no video/waveform exists) |
| Seek during pause | Supported in most | Varies | Must support — user may pause to find a specific line |
| Vertical swipe | Volume (right side) / Brightness (left side) | Not available | Next/prev cue (unique to subtitle context) |
| Horizontal swipe | Seek ±10s per swipe | Seek by word | Timeline drag (more precise than fixed skip) |
| Settings panel | Gear icon → modal overlay | Sidebar panel | Bottom drawer (thumb-reachable on phone in landscape) |
| Auto-hide controls | 3s idle timeout | Usually persistent | 3s idle timeout + tap to reveal |
| Cue markers on timeline | Chapters (if available) | Line numbers | Cue start positions as density markers |
| Dark environment OLED | Not considered | Not considered | Core design constraint — pure black, minimal lit pixels |

## Cinema-Specific Behavior Notes

### Expected Behavior in Theater Context

1. **Controls auto-hide within 3 seconds** — In a dark theater, any persistent UI glows and disturbs neighbors. The screen should be 99% pure black showing only white subtitle text. Controls appear on tap, disappear after 3s idle.

2. **Large touch targets (min 48x48px)** — Already built. User operates by feel in the dark. New layout must NOT shrink buttons.

3. **Gesture conflict resolution** — Horizontal gestures near the timeline = scrub. Vertical gestures anywhere = cue nav. Tap (no movement) = reveal controls. Implement with direction lock: once a gesture direction is detected, lock to that axis for the duration of the touch.

4. **Seek feedback during pause** — When paused and user drags the timeline, the subtitle display must update in real-time to show the cue at the drag position. This is the "preview" behavior — since we can't show video frames, we show the subtitle text.

5. **Offset adjustment in settings drawer** — Currently inline as ±0.5s buttons. In the drawer, use a slider or stepper. This is less frequently used (set once per film), so it belongs in the secondary panel.

6. **Session persistence after seek** — If user seeks then the browser refreshes, the resume card must show the post-seek position. This requires ENG-02 session sync on every seek operation.

### Gesture Mapping (Cinema Subtitle Context)

| Gesture | Action | Rationale |
|---------|--------|-----------|
| Tap (no movement) | Toggle controls visibility | Universal "show me controls" gesture |
| Swipe up | Jump to next cue | Natural "forward" direction. Replay current line if already at cue start. |
| Swipe down | Jump to previous cue | Natural "backward" direction. |
| Drag on timeline | Seek to position | Precise navigation within the film. Works playing or paused. |
| Long press | (Reserved) | Could show cue details or context. Not in v1.2. |

### Timeline Design for Subtitle Context

The timeline in a subtitle player differs from video players:

- **No thumbnail preview** — Impossible without video. Replace with cue text tooltip on drag.
- **Cue markers** — Small dots at each cue's start time. Dense sections = dialogue-heavy. Sparse sections = silence/credits.
- **Current position indicator** — Bright dot/line showing where the film currently is.
- **Buffer/loaded indicator** — Not applicable (no streaming). Subtitles are fully loaded.
- **Chapter markers** — Not available without metadata. Cue density serves as implicit chapter indicator.

## Implementation Dependencies (Existing Code)

| New Feature | Depends On Existing | What Changes |
|-------------|---------------------|--------------|
| Total duration (ENG-03) | SRT parser (already extracts cue.end) | Store `totalDurationMs` at parse time, pass to UI |
| Enhanced seek (ENG-01) | `PlaybackEngine.seekTo()` | Add public `seek(targetMs)` method. Works when paused by updating `pausedElapsed` and firing `onCueChange` |
| Session sync (ENG-02) | `PlaybackSession` model + `sessionElapsedMs()` | Add `seekSession(session, targetMs, now)` pure function. Update `startedAt` so formula holds |
| Timeline (UI-03) | `formatElapsedHMS()` from session.ts | New `Timeline` component. Reads session elapsed + total duration |
| Gestures (UI-02) | None (new touch handler) | New `useGestureDetection` hook or inline touch handlers on the playback screen |
| Settings drawer (UI-01) | Existing controls in `PlaybackControls.tsx` | Extract secondary controls into a slide-up drawer component |

## Sources

- [Video Player UI: Best Examples, Patterns & UX Tips — Eleken](https://www.eleken.co/blog-posts/video-player-ui) — Auto-hide controls, gesture patterns, modern player design philosophy
- [Media Player Gesture Controls — TimeShift](https://timeshiftmediaplayer.wordpress.com/using-media-player-gesture-controls) — Swipe direction mapping conventions
- [Gestify Video Gesture Control Guide — RabbitPair](https://www.rabbitpair.com/en/blog/gestify-video-gesture-control-guide) — Swipe-to-seek, vertical swipe patterns, direction lock
- [Enhancing User Navigation in Smartphone Video Playback — T&F](https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2657560) — Academic study on mobile video navigation patterns
- [How to Design a Media Player — Think.Design](https://think.design/blog/how-to-design-a-media-player) — Skip gestures, preview thumbnails, cognitive load
- [Material Design Navigation Patterns](https://m1.material.io/patterns/navigation.html) — Navigation pattern vocabulary and hierarchy
- [Dark Mode UI Design Best Practices — UX Planet](https://uxplanet.org/dark-mode-ui-design-best-practices-8d3a00a83924) — Dark environment considerations, OLED optimization

---

*Feature research for: Cinema Subtitle PWA — Playback UI Redesign (v1.2)*
*Researched: 2026-08-31*
