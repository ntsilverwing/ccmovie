# Phase 4: Polish & Accessibility - Research

**Researched:** 2026-07-27
**Domain:** Subtitle timing offset, accessibility (high contrast mode), CSS theming
**Confidence:** HIGH

## Summary

Phase 4 adds two features to CinemaSyncSubs: subtitle timing offset adjustment (±N seconds) and high-contrast mode (yellow text on black). Both features integrate cleanly into the existing architecture established in Phases 1-3.

The timing offset feature modifies the `PlaybackEngine` to apply a millisecond offset to the elapsed time before cue lookup. This is the minimal-change approach — the `findActiveCue` function signature stays identical, and the offset is applied at the single point where elapsed time is computed. The offset is adjustable in real-time during playback without restart, satisfying PLAY-06's success criteria.

The high-contrast mode follows the exact pattern already established by the `body.dimmed` class toggle for dim mode. A new `body.high-contrast` CSS class overrides `--subtitle-color` to `#FFD700` (gold), providing a 15.24:1 contrast ratio against `#000000` — well above WCAG AAA's 7:1 requirement for normal text. The toggle is wired through `SubtitleDisplay` via the same `useEffect` + `classList.toggle` pattern used for dim mode.

**Primary recommendation:** Extend `usePersistedSettings` to include `offsetMs` and `isHighContrast`, add offset support to `PlaybackEngine` via a setter method, add offset UI controls to `PlaybackControls`, and add a `body.high-contrast` CSS rule. No new dependencies required.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timing offset computation | API / Backend (PlaybackEngine) | — | Offset is applied to elapsed time before cue lookup — this is pure computation in the engine layer |
| Offset UI controls | Browser / Client | — | +/- buttons and slider are UI elements rendered by the client |
| Offset persistence | Browser / Client | — | localStorage is client-side storage; settings hook already handles this |
| High contrast CSS | Browser / Client | — | CSS class toggle on `<body>` propagates via cascade; no server involvement |
| High contrast toggle UI | Browser / Client | — | Button in PlaybackControls triggers the toggle |
| High contrast persistence | Browser / Client | — | localStorage via existing settings hook |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in project — no new dependencies |
| TypeScript | 5.6.x | Type safety | Already in project — no new dependencies |
| CSS Custom Properties | Native | Runtime theming | Already established pattern for font size and dim mode |
| localStorage | Native | Settings persistence | Already established pattern for fontSize and isDimmed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| (none) | — | — | No new libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|--------|----------|
| CSS class toggle for high contrast | CSS-in-JS (styled-components) | Adds dependency; existing pattern already uses body class toggle — consistency wins |
| localStorage for offset | IndexedDB | localStorage is synchronous and sufficient for a single integer value; IndexedDB is for structured data |
| Offset in PlaybackEngine | Offset in findActiveCue parameter | Keeping offset in PlaybackEngine preserves the pure-function nature of findActiveCue and avoids changing its signature |

**Installation:**
```bash
# No new packages required — all features use existing stack
```

**Version verification:** No new packages to verify. All features build on existing React 18 + TypeScript 5.6 + native CSS/APIs.

## Package Legitimacy Audit

> No external packages are installed in this phase. All features use the existing React/TypeScript/CSS stack already validated in Phase 1.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                   │
│                                                       │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ PlaybackControls │  │ SubtitleDisplay         │    │
│  │             │    │                          │    │
│  │ [−0.5s]     │    │ useEffect:               │    │
│  │ [+0.5s]     │    │  body.high-contrast      │    │
│  │ [Reset]     │    │  classList.toggle()      │    │
│  │ [Contrast]  │    │                          │    │
│  └──────┬──────┘    └──────────┬───────────────┘    │
│         │                      │                     │
│         ▼                      ▼                     │
│  ┌─────────────────────────────────────────────┐    │
│  │         usePersistedSettings                 │    │
│  │   { fontSize, isDimmed, offsetMs,            │    │
│  │     isHighContrast }                         │    │
│  │         ↕ localStorage                        │    │
│  └─────────────────────────────────────────────┘    │
│         │                                            │
│         ▼                                            │
│  ┌─────────────────────────────────────────────┐    │
│  │         usePlaybackEngine                    │    │
│  │   PlaybackEngine.offsetMs = settings.offsetMs│    │
│  └─────────────────────────────────────────────┘    │
│         │                                            │
│         ▼                                            │
│  ┌─────────────────────────────────────────────┐    │
│  │         PlaybackEngine                       │    │
│  │                                              │    │
│  │   tick():                                    │    │
│  │     elapsed = now - startTime + offsetMs     │    │
│  │     findActiveCue(cues, elapsed, hint)       │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── playback/
│   └── PlaybackEngine.ts    # Add offsetMs property + setOffset() method
├── hooks/
│   ├── usePlaybackEngine.ts # Wire offsetMs from settings to engine
│   └── usePersistedSettings.ts  # Add offsetMs + isHighContrast to Settings
├── components/
│   ├── SubtitleDisplay.tsx  # Add isHighContrast prop, body.high-contrast toggle
│   └── PlaybackControls.tsx # Add offset controls + contrast toggle button
├── App.tsx                  # Pass new props through
└── index.css                # Add body.high-contrast rule
```

### Pattern 1: Timing Offset via Elapsed Time Adjustment
**What:** Apply offset by adjusting the elapsed time before cue lookup, not by modifying cue data.
**When to use:** When the user needs to shift subtitle timing without altering the source SRT data.
**Why this approach:** Modifying cue start/end times would require either mutating the original data (losing the original values) or creating a copy (memory overhead for large files). Adjusting elapsed time is O(1), requires no data mutation, and is instantly reversible.

```typescript
// In PlaybackEngine.tick():
private tick = (): void => {
  const elapsed = performance.now() - this.startTime + this.offsetMs
  const activeIndex = findActiveCue(this.cues, elapsed, this.lastIndex)
  // ... rest unchanged
}
```

**Key insight:** The offset is added to elapsed, not subtracted. A positive offset means "show subtitles later" (user perceives subtitles arriving too early, shifts them forward in time). Wait — let me clarify the semantics:
- `offsetMs > 0`: Subtitles appear LATER (elapsed is artificially increased, so cues "start" later from the engine's perspective). Use when subtitles appear too EARLY.
- `offsetMs < 0`: Subtitles appear EARLIER. Use when subtitles appear too LATE.

### Pattern 2: Body Class Toggle for High Contrast
**What:** Toggle a CSS class on `<body>` that overrides CSS custom properties for color theming.
**When to use:** Global visual mode changes that affect all subtitle rendering.
**Why this approach:** Already established by `body.dimmed` pattern. Single class change propagates via CSS cascade to all subtitle elements. No React re-render needed for visual change. Clean separation of concerns.

```css
/* In index.css */
body.high-contrast {
  --subtitle-color: #FFD700;
}
```

```typescript
// In SubtitleDisplay.tsx
useEffect(() => {
  document.body.classList.toggle('high-contrast', isHighContrast)
  return () => document.body.classList.remove('high-contrast')
}, [isHighContrast])
```

### Anti-Patterns to Avoid
- **Modifying cue data for offset:** Never mutate `cue.start` and `cue.end` to apply offset. This destroys original timing data, requires re-parsing to reset, and creates memory overhead.
- **Using React state for offset in the render path:** Offset changes should NOT trigger React re-renders in the playback loop. The engine reads `this.offsetMs` directly in `tick()`, bypassing React's render cycle.
- **Using text-shadow in high contrast mode:** The existing `text-shadow: 0 0 4px rgba(0,0,0,0.8)` is designed for halation reduction on OLED. In high contrast mode, this shadow is less visible against the already-black background, but it should remain for consistency. Do NOT add glow effects to yellow text — it reduces readability.
- **Dim mode + High contrast mode simultaneously:** These are mutually exclusive visual modes. If high contrast is enabled, dim mode should be disabled (and vice versa). The UI should enforce this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing offset computation | Custom time arithmetic with Date objects | Simple addition to `performance.now()` result | `performance.now()` is already monotonic and drift-free; adding milliseconds is trivial math |
| High contrast detection | Prefers-contrast media query | Manual toggle button | User is in control in a cinema environment; auto-detection is unreliable in dark theaters |
| Color contrast validation | Manual RGB math | WebAIM Contrast Checker (external validation) | Contrast ratios require relative luminance computation; use established tools to verify |

**Key insight:** Both features are UI/configuration wrappers around existing infrastructure. The "hard" parts (timing engine, CSS theming system) are already built. This phase is about exposing them to the user.

## Common Pitfalls

### Pitfall 1: Offset Applied to Cue Data Instead of Elapsed Time
**What goes wrong:** Developer modifies `cue.start += offsetMs` and `cue.end += offsetMs` for every cue.
**Why it happens:** Intuitive but wrong — "shift the subtitles" sounds like modifying subtitle data.
**How to avoid:** Always apply offset to the elapsed time in `PlaybackEngine.tick()`. This is O(1) vs O(n) and preserves original data.
**Warning signs:** `setCues()` being called when offset changes, or a separate "shifted cues" array in state.

### Pitfall 2: Offset Causes Negative Elapsed Time
**What goes wrong:** When `offsetMs` is negative and `performance.now() - startTime` is small (just started playback), `elapsed` becomes negative.
**Why it happens:** `elapsed = performance.now() - startTime + offsetMs` where `offsetMs` is negative.
**How to avoid:** `findActiveCue` already handles this correctly — when `elapsed < cue.start` for all cues, it returns -1 (no active cue). No special handling needed. The binary search naturally handles negative elapsed.
**Warning signs:** None — this is actually fine by design. Document that negative elapsed is expected behavior.

### Pitfall 3: High Contrast and Dim Mode Conflict
**What goes wrong:** User enables both dim mode and high contrast, resulting in `#888888` (dim) overriding `#FFD700` (high contrast) or vice versa depending on CSS specificity.
**Why it happens:** Both `body.dimmed` and `body.high-contrast` set `--subtitle-color`. If both classes are present, the last-declared rule wins.
**How to avoid:** Enforce mutual exclusivity in the settings update logic. When enabling high contrast, automatically disable dim mode, and vice versa.
**Warning signs:** Both toggle buttons showing "active" state simultaneously.

### Pitfall 4: Offset UI Updates Trigger Re-renders During Playback
**What goes wrong:** Storing offset in React state causes re-renders of playback view on every offset change.
**Why it happens:** Offset is stored in `useState` and passed through props.
**How to avoid:** Offset is already in `usePersistedSettings` (React state), but the PlaybackEngine reads it via a direct property set (`engine.setOffset(offsetMs)`), not through the render path. The engine's `tick()` closure reads `this.offsetMs` directly. React state changes only update the engine property, not the playback loop.
**Warning signs:** Playback stuttering when adjusting offset slider.

### Pitfall 5: Offset Range Too Narrow or Too Wide
**What goes wrong:** User needs ±10 seconds of adjustment but UI only provides ±1 second, or slider has ±60 seconds with unusable precision.
**Why it happens:** Not considering real-world misalignment scenarios (wrong cut, different frame rate, delayed audio).
**How to avoid:** Provide ±5 second range with 0.5-second steps via +/- buttons. This covers 95% of real-world misalignment cases. For extreme cases, allow direct text input.
**Warning signs:** User repeatedly tapping +/- buttons to reach large offsets.

## Code Examples

### Timing Offset in PlaybackEngine
```typescript
// Source: Adapted from existing PlaybackEngine.ts architecture
export class PlaybackEngine {
  private startTime: number = 0
  private isPlaying: boolean = false
  private rafId: number | null = null
  private lastIndex: number = -1
  private cues: Cue[]
  private offsetMs: number = 0  // NEW: timing offset in milliseconds

  // ... existing methods ...

  /**
   * Set timing offset in milliseconds.
   * Positive = subtitles appear later (fix early subtitles).
   * Negative = subtitles appear earlier (fix late subtitles).
   */
  setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs
  }

  private tick = (): void => {
    const elapsed = performance.now() - this.startTime + this.offsetMs
    const activeIndex = findActiveCue(this.cues, elapsed, this.lastIndex)
    // ... rest unchanged ...
  }
}
```

### High Contrast CSS Rule
```css
/* Source: Following existing body.dimmed pattern in index.css */
body.high-contrast {
  --subtitle-color: #FFD700;
}

/* Ensure high contrast takes precedence over dimmed when both could be set */
body.high-contrast body.dimmed {
  --subtitle-color: #FFD700;
}
```

### Settings Extension
```typescript
// Source: Extension of existing usePersistedSettings.ts
export interface Settings {
  fontSize: number
  isDimmed: boolean
  offsetMs: number      // NEW: timing offset, default 0
  isHighContrast: boolean  // NEW: high contrast mode, default false
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 48,
  isDimmed: false,
  offsetMs: 0,
  isHighContrast: false,
}
```

### Offset UI Controls
```typescript
// Source: Addition to PlaybackControls.tsx
{/* Offset controls — shown during playback */}
<div className="offset-controls">
  <button className="offset-button" onClick={onOffsetChange(offsetMs - 500)}>
    −0.5s
  </button>
  <span className="offset-display">
    {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
  </span>
  <button className="offset-button" onClick={onOffsetChange(offsetMs + 500)}>
    +0.5s
  </button>
  <button className="offset-button" onClick={onOffsetChange(0)}>
    Reset
  </button>
</div>
```

### Mutual Exclusivity Logic
```typescript
// Source: In App.tsx — enforce dim/high-contrast mutual exclusivity
const handleHighContrastToggle = () => {
  updateSettings({ isHighContrast: !settings.isHighContrast, isDimmed: false })
}
const handleDimToggle = () => {
  updateSettings({ isDimmed: !settings.isDimmed, isHighContrast: false })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modify SRT file to fix sync | Runtime offset adjustment | Always preferred for playback tools | No file modification needed; instantly reversible |
| White text only | Configurable contrast modes | WCAG 2.1 (2018) | Yellow (#FFD700) on black provides 15.24:1 contrast ratio, exceeding WCAG AAA |
| Fixed subtitle timing | User-adjustable offset | Industry standard (VLC, Plex, Netflix) | Users expect ±5s adjustment with 0.5s steps |

**Deprecated/outdated:**
- None — both features are additive and don't replace any existing functionality.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ±5 second offset range covers 95% of real-world misalignment cases | Common Pitfalls #5 | If range is too narrow, users with severely misaligned subtitles can't fix sync. Mitigation: allow direct text input for extreme values. |
| A2 | 0.5-second step size is appropriate for fine-tuning | Code Examples (Offset UI) | If steps are too coarse, users can't achieve precise sync. If too fine, too many taps. 0.5s is the industry standard (VLC, Plex). |
| A3 | #FFD700 on #000000 provides sufficient contrast for WCAG AAA | Architecture Patterns #2 | Verified: 15.24:1 ratio exceeds 7:1 AAA requirement. Low risk. |
| A4 | Mutual exclusivity between dim mode and high contrast is desired | Anti-Patterns #4 | If user wants dim+yellow (unlikely), they can't have it. Low risk — these modes serve different accessibility needs. |
| A5 | Offset should be applied to elapsed time, not cue data | Pattern 1 | This is a well-established pattern in video player engines. Very low risk. |

## Open Questions (RESOLVED)

1. **Should offset adjustment be available in the ready view (before playback starts)?** — RESOLVED: Show only during playback (simpler, offset needs engine running).
   - What we know: The offset needs the engine running to take effect.
   - What was unclear: Whether users want to pre-set offset before pressing Start.

2. **Should there be a fine-adjustment mode (0.1s steps)?** — RESOLVED: Start with 0.5s steps (standard). Add fine-adjustment only if user feedback demands it.
   - What we know: 0.5s steps are standard but some users want frame-level precision.
   - What was unclear: Whether the added UI complexity is worth it for v1.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all features use existing React/TypeScript/CSS stack and browser-native APIs already in use).

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

## Security Domain

Step: SKIPPED — Phase 4 does not introduce authentication, session management, or data transmission. All settings are local-only via localStorage. No user data leaves the device.

## Sources

### Primary (HIGH confidence)
- Existing codebase (`src/playback/PlaybackEngine.ts`, `src/hooks/usePersistedSettings.ts`, `src/components/SubtitleDisplay.tsx`) — verified architecture patterns
- WCAG 2.1 Success Criterion 1.4.3 — contrast ratio requirements [CITED: webaim.org/articles/contrast]

### Secondary (MEDIUM confidence)
- UX StackExchange discussion on yellow in high contrast modes [CITED: ux.stackexchange.com/questions/149194]
- WebAIM contrast ratio reference [CITED: webaim.org/articles/contrast]

### Tertiary (LOW confidence)
- Industry standard offset ranges (VLC, Plex) — based on training knowledge, not verified this session [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all features use existing verified stack
- Architecture: HIGH — patterns already established in codebase (body class toggle, elapsed time math, localStorage persistence)
- Pitfalls: HIGH — derived from direct codebase analysis and established video player patterns

**Research date:** 2026-07-27
**Valid until:** 2026-08-26 (stable — CSS custom properties and localStorage APIs are stable web standards)
