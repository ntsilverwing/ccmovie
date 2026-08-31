# Project Research Summary

**Project:** CinemaSyncSubs v1.2 — Playback UI Redesign & Timeline
**Domain:** Cinema subtitle PWA — Playback engine extension with timeline, gestures, and settings drawer
**Researched:** 2026-08-31
**Confidence:** HIGH

## Executive Summary

CinemaSyncSubs v1.2 is a focused UI redesign milestone for an existing cinema subtitle PWA. The product's core premise — OLED pure-black display for dark theater use — drives every architectural decision: minimal lit pixels, large touch targets, and gesture-based "blind" operation. Research confirms that all four v1.2 features (Timeline UI, gesture controls, settings drawer, enhanced seek) can be built with the existing React 18 + TypeScript + pure-CSS stack with **zero new dependencies**, keeping the production bundle at ~85 KB gzipped (well under the 90 KB target).

The recommended approach is to extend the existing dual-source clock architecture (wall-clock session + monotonic engine) with a unified `seek(targetMs)` entry point that atomically re-anchors both clocks. The Timeline component uses Pointer Events API with a ref-based drag pattern (not useState) to avoid 60fps re-render storms. Gesture detection is a custom ~30-line hook for vertical swipes only. The settings drawer is a CSS `transform: translateY()` slide-up panel. All patterns are well-established in the existing codebase — this milestone is about consistent extension, not new architectural paradigms.

The key risks are session-engine clock desync after seek (a correctness bug that breaks resume-from-persisted-state), timeline scrubber flicker during playback (a showstopper in dark theater), and gesture false positives from hand tremors. All three have clear prevention strategies documented in the research. The architecture is well-understood, the stack is stable, and the build order is dependency-respecting — this is a low-risk, high-confidence milestone.

## Key Findings

### Recommended Stack

**Zero new dependencies.** The existing stack handles all v1.2 requirements without adding any package. The project's deliberate zero-UI-library philosophy is an asset — the features are simple enough that any library would increase bundle size without meaningful development speedup.

**Core technologies:**
- **React 18.3.1 + TypeScript 5.6.3**: UI framework and type safety — unchanged
- **Vite 6.0.1 + vite-plugin-pWA 1.3.0**: Build tooling and service worker — unchanged
- **Pointer Events API**: Unified touch+mouse drag handling for timeline scrubbing — built into all target browsers (iOS Safari 13+, Chrome 84+)
- **CSS Custom Properties + Transitions**: Theming and drawer animation — already in use for dark theater styling
- **idb 8.0.3**: IndexedDB wrapper for session persistence — unchanged

**Bundle budget:** Current 77 KB gzipped → estimated ~85 KB after v1.2 (zero new deps). Target: stay under 90 KB.

### Expected Features

**Must have (table stakes):**
- Progress bar with current/total time display — every media player has this
- Drag/scrub to seek — works in both playing AND paused states (current `seekTo()` is playing-only)
- Tap to reveal/hide controls with 3-second auto-hide timeout
- Play/Pause button — already built, repositioned in layered layout
- Current time / total duration display — reuse existing `formatElapsedHMS()`

**Should have (competitive differentiators):**
- Gesture-based cue navigation (swipe up = next, down = prev) — operates blind by touch in dark theater
- Timeline with cue markers — visual density indicator unique to subtitle players
- Session-persistent seek — resume after refresh continues from post-seek position
- Seek during pause — subtitle updates immediately without pressing play
- Large touch targets (48x48px min) — already built, must preserve in new layout

**Defer (v2+):**
- Cue text tooltip on timeline scrub — nice-to-have, add after timeline launch
- Keyboard shortcuts for desktop testing — developer convenience
- Haptic feedback on gesture — confirmation feedback, low priority
- Chapter/scene markers, waveform from mic, Apple Watch companion — future considerations

**Anti-features to explicitly avoid:** Speed control (desyncs from theater audio), thumbnail preview (no video stream exists), skip intro (no metadata), always-on controls (light pollution), volume/brightness swipe (OS handles this).

### Architecture Approach

The architecture extends the existing dual-source clock pattern with a unified seek re-anchor mechanism. The wall-clock session (`PlaybackSession.startedAt`) and monotonic engine (`PlaybackEngine.startTime`) must agree after any seek — this is the central architectural invariant. A new `seekSession()` pure function in session.ts and a `seek()` callback in the hook ensure atomic updates to both clocks plus persistence.

**Major components:**
1. **PlaybackEngine** (modified) — Add `seek(targetMs)` method that re-anchors `startTime` in both playing and paused states
2. **Timeline.tsx** (new) — Progress bar with Pointer Events drag-to-seek, rAF position polling, cue markers
3. **SettingsDrawer.tsx** (new) — Slide-up panel consolidating offset, font, contrast, dim, fullscreen controls
4. **useGestureDetection.ts** (new) — Vertical swipe detection with distance/velocity thresholds and direction lock
5. **usePlaybackEngine.ts** (modified) — Expose `seek()` callback, accept `totalDurationMs`, wire gesture/timeline integration

**Key patterns:**
- Dual-source clock with seek re-anchor (session + engine stay in sync)
- Hook-exposed imperative seek (single entry point for all position changes)
- Timeline position polling via rAF (battery-friendly, pauses in background tabs)
- Gesture-to-seek bridge (vertical swipes map to cue-boundary seeks)

### Critical Pitfalls

1. **Timeline scrubber flicker during playback** — The rAF tick overwrites drag position on every frame. Prevention: pause engine position advance during scrub (isScrubbing flag), seekTo on release. Never let drag handler write state that the tick will overwrite.

2. **Session-engine clock desync after seek** — `seekTo()` updates engine but not session. Banner shows old position, resume after refresh restarts from pre-seek position. Prevention: always re-anchor `startedAt = now - (targetMs - offsetMs)` in the same atomic operation.

3. **Offset double-application in seek path** — Display shows position off by exactly the offset value. Prevention: define position spaces explicitly (engine space vs display space), document which space each function expects, add contract tests.

4. **Gesture false positives in dark theater** — Hand tremors trigger unwanted subtitle jumps. Prevention: 30px minimum distance threshold, 100px/s velocity threshold, direction lock, 300ms cooldown.

5. **React re-render storm during timeline drag** — 60 setState calls/sec = janky UI + battery drain. Prevention: useRef for drag position, direct DOM manipulation for visual feedback, commit to state only on drag end.

6. **Session persistence write amplification on seek** — Every drag tick triggers IndexedDB write. Prevention: decouple drag position from session state, only setSession on seek commit (drag end).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Total Duration + Enhanced Seek + Session Sync
**Rationale:** These are the zero-UI dependencies that unblock everything else. Total duration is a one-line parser addition. Enhanced seek and session sync are the core engine changes that Timeline and Gestures both depend on. Doing these first de-risks the entire milestone.
**Delivers:** `totalDurationMs` in parsed metadata, `seek(targetMs)` engine method, `seekSession()` pure function, `seek()` hook callback, session persistence on seek.
**Addresses:** ENG-01 (Enhanced Seek), ENG-02 (Session Seek Sync), ENG-03 (Total Duration)
**Avoids:** Pitfall 2 (session desync), Pitfall 3 (offset double-application), Pitfall 6 (write amplification)

### Phase 2: Timeline UI
**Rationale:** The most visible new feature and the primary navigation interface. Depends on Phase 1's seek and total duration. Must be rock-solid for dark theater use — flicker-free scrubbing is a showstopper if broken.
**Delivers:** Timeline component with progress bar, drag-to-seek, current/total time, cue markers, rAF position polling.
**Addresses:** UI-03 (Timeline Progress Bar), table-stakes progress bar + drag-seek + time display
**Avoids:** Pitfall 1 (scrubber flicker), Pitfall 5 (re-render storm)

### Phase 3: Gesture Navigation
**Rationale:** The unique differentiator for subtitle players. Depends on Phase 1's seek. Independent of Phase 2 (different touch surface — display area vs timeline bar). Can be developed in parallel with Phase 2 if team capacity allows.
**Delivers:** `useGestureDetection` hook, swipe up/down cue navigation, one-time hint overlay, gesture affordance chevrons.
**Addresses:** UI-02 (Gesture Cue Nav), differentiator: gesture-based cue navigation
**Avoids:** Pitfall 4 (false positives), Pitfall 7 (touch-action CSS), Pitfall 8 (discoverability)

### Phase 4: Settings Drawer + Control Layering
**Rationale:** Pure UI refactor that consolidates existing controls. No new logic. Depends on nothing (independent of Phases 2-3) but should come after to avoid refactoring twice. The final phase that completes the redesign vision.
**Delivers:** SettingsDrawer component, slimmed PlaybackControls (Play/Pause + Timeline + Settings toggle), auto-hide on idle.
**Addresses:** UI-01 (Settings Drawer), table-stakes tap-to-reveal/hide, should-have large touch targets
**Avoids:** UX pitfall: timeline too thin in dark (48px touch target)

### Phase Ordering Rationale

- **Phase 1 first** because it has zero UI but unblocks all UI work. The dependency chain is: total duration → timeline, seek → timeline + gestures, session sync → all seek operations.
- **Phases 2 and 3 in parallel** (or sequential) because they depend on Phase 1 but not on each other. They touch different surfaces (timeline bar vs display area) and have different interaction models.
- **Phase 4 last** because it's a pure UI consolidation. It doesn't enable any other feature and benefits from having the new Timeline and gesture patterns in place first.
- **Pitfall-driven ordering:** Session sync (Phase 1) must be correct before Timeline (Phase 2) can work reliably. Seek must support paused state (Phase 1) before Timeline drag-while-paused (Phase 2) is usable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Timeline):** The scrubber flicker prevention (isScrubbing flag vs pause/play pattern) needs a spike to determine the cleanest integration with the existing engine. The rAF position polling pattern needs validation against the existing engine tick loop.
- **Phase 3 (Gestures):** Gesture conflict resolution between vertical swipe (cue nav) and potential future horizontal swipe (scrub) needs a clear direction-lock strategy. Real iOS Safari testing required for touch-action behavior.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Pure additions to existing well-tested code. `seekSession()` is a pure function — easily unit tested. `totalDurationMs` is a one-line parser addition.
- **Phase 4 (Settings Drawer):** CSS slide-up panel is a well-established pattern. The project already uses `position: fixed` + transitions for the existing control bar.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps — research confirms existing stack is sufficient. Bundle budget verified by build output. |
| Features | HIGH | Clear table stakes vs differentiators. Anti-features well-justified for cinema context. Dependency graph validated against existing code. |
| Architecture | HIGH | Patterns derived from existing codebase analysis. Build order respects dependencies. Anti-patterns identified with prevention strategies. |
| Pitfalls | HIGH | Cross-referenced web research (React Player issues, BBC TAL, Firefox docs) against actual codebase. Critical pitfalls have clear prevention + verification steps. |

**Overall confidence:** HIGH

### Gaps to Address

- **Timeline scrubber interaction pattern:** The `isScrubbing` flag approach vs pause/play-on-scrub approach needs a quick spike during Phase 2 planning. Both are documented; the right choice depends on engine internals.
- **Gesture hint overlay design:** The one-time hint overlay (Pitfall 8) needs UX design. It's a dark-theater constraint — hints must be minimal, dismissible, and not light-polluting.
- **Cue marker rendering performance:** With 1000+ cues, rendering individual marker dots on the timeline could be a performance concern. May need canvas rendering or virtualization. Validate during Phase 2.
- **Real device testing:** Touch-action CSS behavior (Pitfall 7) and gesture false positives (Pitfall 4) cannot be fully validated in simulators. Plan for real iOS Safari and Android Chrome testing.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: PlaybackEngine.ts, session.ts, usePlaybackEngine.ts, PlaybackControls.tsx, App.tsx
- BBC TAL Media Playback state machine — seek/pause state handling patterns
- Firefox AudioSinkWrapper docs — seek-resume behavior reference
- WebKit bug #162562 — iOS inline video gesture handling
- Current bundle measurement via `npm run build` (77 KB gzipped, 2026-08-31)

### Secondary (MEDIUM confidence)
- @use-gesture/react v10.3.1 via Context7 — API confirmed for future migration path
- React Player issue #1860 — scrubber flicker during playback (validates Pitfall 1)
- Medium seekbar tutorial — custom seekbar implementation patterns
- Gestify Video Gesture Control Guide — swipe direction mapping conventions
- React Flow performance guide — re-render storm prevention patterns
- CreateWithSwift: Navigating Pitfalls of Gestural Interfaces — gesture false positive prevention
- Mobile Accessibility Patterns (TestParty) — touch target sizing

### Tertiary (LOW confidence)
- react-swipeable v7.0.2 — confirmed unmaintained (2 years), not recommended
- Hammer.js v2.0.8 — confirmed unmaintained since 2016, not recommended
- Custom touch swipe patterns via tavily — consistent pattern across sources but not officially documented

---

*Research completed: 2026-08-31*
*Ready for roadmap: yes*
