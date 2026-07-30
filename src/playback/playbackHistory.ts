/**
 * Playback history-entry policy (Phase 5: lossless playback navigation).
 *
 * Phase 5 introduces the project's FIRST History API usage — the codebase has
 * no router and no prior popstate handling (PATTERNS.md "No Analog Found"
 * row 1). This module isolates that policy as a pure, injectable decision
 * core so the push/replace/pop rules are testable without a DOM:
 *
 * - enterPlaybackHistory → decisions D-01/D-02 from 05-CONTEXT.md:
 *   register exactly ONE {view:'playback'} marker entry per playback visit;
 *   re-entry while the marker is on top REPLACES instead of pushing, so
 *   pause→resume and banner→resume paths never stack entries.
 * - exitPlaybackHistory → decision D-03 from 05-CONTEXT.md:
 *   consume ONLY entries this module created. Selection-page system back
 *   stays a natural app exit (Android convention); foreign/base history is
 *   never consumed, replaced, or rewritten.
 *
 * HistoryLike names the minimal slice of window.history this policy needs.
 * Injection keeps the module DOM-free: tests simulate the entry stack with a
 * fake, and App.tsx (Plan 05-04) passes the real host history object once as
 * trivial glue — no host-global reads happen here.
 */
export interface HistoryLike {
  readonly state: unknown
  pushState(state: unknown, unused: string): void
  replaceState(state: unknown, unused: string): void
  back(): void
}

/**
 * Shared frozen marker object for playback history entries (D-01).
 * Exported so App.tsx (05-04) and tests share one source of truth for the
 * entry shape. Carries no user data — only the view tag (threat T-05-02-02).
 */
export const PLAYBACK_ENTRY = Object.freeze({ view: 'playback' } as const)

/**
 * True iff `state` is a non-null object whose `view` field is the string
 * 'playback'. Field-level (not identity) check: popstate delivers structured
 * clones, so a JSON round-trip of the marker MUST still match. Extra fields
 * are tolerated; arrays, primitives, and other view values are rejected.
 */
export function isPlaybackEntry(state: unknown): boolean {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return false
  }
  return (state as { view?: unknown }).view === 'playback'
}

/**
 * Register the playback visit (D-01). If the marker is already on top
 * (re-entry) refresh it via replaceState — never stack (D-02); otherwise
 * push a fresh marker over whatever base or foreign state exists.
 */
export function enterPlaybackHistory(h: HistoryLike): void {
  if (isPlaybackEntry(h.state)) {
    h.replaceState(PLAYBACK_ENTRY, '')
  } else {
    h.pushState(PLAYBACK_ENTRY, '')
  }
}

/**
 * Retire the playback visit (D-03). Pops exactly our marker when it is on
 * top so the selection page's next system back exits the app naturally;
 * over any other top state this is a no-op — we touch only what we created.
 */
export function exitPlaybackHistory(h: HistoryLike): void {
  if (isPlaybackEntry(h.state)) {
    h.back()
  }
}
