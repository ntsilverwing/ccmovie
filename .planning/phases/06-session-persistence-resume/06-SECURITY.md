---
phase: 6
slug: session-persistence-resume
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 6 — Security

> Per-phase security contract for Session Persistence & Resume (FILE-03).
> All plan-time threat mitigations verified present at L1 grep depth (ASVS L1).
> Short-circuit applied: threats_open: 0 + register_authored_at_plan_time: true + L1 → auditor skipped per workflow rule.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| IndexedDB → app | Persisted session record read at boot is untrusted input (user/devtools/extension writable) | PlaybackSession JSON |
| npm registry → devDependencies | fake-indexeddb install is a supply-chain crossing | devDep (not shipped) |
| Device clock → session math | startedAt/expiry computed against a user-controllable wall clock | number (ms epoch) |
| React state → IndexedDB | Every persist-effect write crosses from app memory into durable storage | PlaybackSession object |
| Gesture handler → engine | Restored position computed from wall clock at tap time | number (ms) |
| IndexedDB → boot render | Persisted record drives UI; treated as untrusted input (validated upstream in 06-01) | PlaybackSession → React state |
| IndexedDB record → saved-subtitle soft link | subtitleId/fileName join may dangle after saved-list deletion | id / fileName string |
| Same-origin storage → user privacy | Local playback state persists on-device | PlaybackSession JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01-01 | Tampering | loadSession / boot hydration | high | mitigate | isValidSession shape-validates every field on read (session.ts:126); invalid/corrupt records discarded + cleared; module total, never throws (sessions.ts:29) | closed |
| T-06-01-02 | Tampering (clock skew) | isSessionExpired / elapsed math | medium | mitigate | Strictly-greater expiry predicate (session.ts:115); negative age treated as not-expired; formatElapsedHMS clamps display to 0:00:00 (session.ts:147) | closed |
| T-06-01-03 | Denial of Service (self) | getDB upgrade callback | high | mitigate | oldVersion-guarded ladder prevents ConstraintError (database.ts:65-71); v1→v2 reopen covered by fake-indexeddb test | closed |
| T-06-01-SC | Tampering (supply chain) | npm install fake-indexeddb | high | mitigate | Package Legitimacy OK (6.2.5, 5.0M dl/wk, no postinstall); devDependency only, never shipped; slopcheck clean | closed |
| T-06-02-01 | Denial of Service (self: quota/battery) | persist effect | medium | mitigate | Writes fire only on session-object identity change (create/pause/resume/offset/stop); engine ticks never allocate new session → no write amplification (~100-byte single record) | closed |
| T-06-02-02 | Tampering (state destruction via race) | persist effect at mount | high | mitigate | hasPersistedRef guard (usePlaybackEngine.ts:160): mount-time null session performs no delete, killing delete-before-hydrate race under StrictMode double-invocation | closed |
| T-06-02-03 | Elevation of Privilege / logic abuse | restoreSession ordering | medium | mitigate | Locked setCues → play → seekTo order (usePlaybackEngine.ts:257) covered by Task-1 contract tests; resumeSession no-jump preserves frozen paused-origin positions | closed |
| T-06-02-SC | Tampering (supply chain) | npm/pip/cargo installs | high | mitigate | Only install is fake-indexeddb (06-01): legitimacy OK, slopcheck clean, no [ASSUMED]/[SUS] packages | closed |
| T-06-03-01 | Tampering (forged record → bad render/position) | boot hydration + ResumeCard | high | mitigate | Records pass isValidSession before any UI state set (06-01); invalid records cleared → selection page renders byte-identical to v1.0 (App.tsx:85,89) | closed |
| T-06-03-02 | Tampering (clock skew abuse of startedAt) | expiry gate + card meta | medium | mitigate | Strictly-greater expiry predicate (06-01) bounds staleness; negative elapsed clamped to 0:00:00 by formatElapsedHMS (session.ts:147); card never shows NaN/negative | closed |
| T-06-03-03 | Information Disclosure | card DOM rendering of fileName | low | accept | React text-node escaping automatic; no dangerouslySetInnerHTML anywhere in project (verified by grep); record contains only movie file name + timestamps on origin-isolated storage with no network path (prohibition: local-only) | closed — accepted |
| T-06-03-04 | Tampering (dangling soft link) | handleResumeFromSession cue lookup | medium | mitigate | id lookup → fileName fallback → silent clearSessionRecord + card removal on miss (App.tsx:115,179); resume never navigates with empty cues (I-3) | closed |
| T-06-03-SC | Tampering (supply chain) | npm/pip/cargo installs | high | mitigate | Only install is fake-indexeddb (06-01): legitimacy OK, slopcheck clean, no [ASSUMED]/[SUS] packages | closed |

*Status: closed = mitigation found in implementation OR accepted risk documented*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation present) · accept (documented in Accepted Risks Log)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-06-03-03 | T-06-03-03 | fileName rendered via React text nodes (auto-escaped); no dangerouslySetInnerHTML exists in project; origin-isolated IndexedDB with no network exfiltration path; local-only playback data is the explicit project scope | orchestrator (L1 grep-verified) | 2026-08-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By | Method |
|------------|---------------|--------|------|--------|--------|
| 2026-08-01 | 13 | 13 | 0 | orchestrator | L1 grep-depth, ASVS L1 short-circuit (auditor skipped) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (R-06-03-03)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-01
