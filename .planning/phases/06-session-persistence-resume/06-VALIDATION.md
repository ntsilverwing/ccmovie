---
phase: 6
slug: session-persistence-resume
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` → `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`npm test` → `vitest run`) |
| **Config file** | `vitest.config.ts` — `include: ['test/**/*.test.ts']`, `environment: 'node'` (no change needed) |
| **Quick run command** | `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts` |
| **Full suite command** | `npm test` (currently 7 files / 87 tests, all green) + `npm run build` (`tsc -b` gate) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts test/unit/playbackEngine.test.ts`
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | TBD | FILE-03 #1 | — | N/A | unit (DB layer) | `npx vitest run test/unit/sessions.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | TBD | FILE-03 (infra) | — | N/A | unit (fake-idb v1→v2 reopen) | `npx vitest run test/unit/sessions.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | TBD | FILE-03 #3 | — | N/A | unit (injected-now expiry boundary) | `npx vitest run test/unit/session.test.ts` | ✅ extend | ⬜ pending |
| 6-01-04 | 01 | TBD | FILE-03 #2 | — | N/A | unit (pure selector) | `npx vitest run test/unit/session.test.ts` | ✅ extend | ⬜ pending |
| 6-01-05 | 01 | TBD | FILE-03 (restore) | — | N/A | unit (engine + fake rAF ordering) | `npx vitest run test/unit/playbackEngine.test.ts` | ✅ extend | ⬜ pending |
| 6-01-06 | 01 | TBD | FILE-03 #2 | — | N/A | manual_procedural | human device checkpoint (kill→relaunch→resume position) | n/a — UAT | ⬜ pending |

*Task IDs/TBD columns finalized from PLAN.md during execution. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/sessions.test.ts` — store CRUD, upgrade ladder, expiry-clear-on-load, replacement sequence (FILE-03 #1/#3/#4)
- [ ] Extend `test/unit/session.test.ts` — `isSessionExpired` boundaries, `isValidSession` rejection table (FILE-03 #3)
- [ ] Extend `test/unit/playbackEngine.test.ts` — restore ordering contract (play→seekTo sequence observable via injected callbacks)
- [ ] `npm install --save-dev fake-indexeddb@^6.2.5` — Wave 0 install (legitimacy: OK)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kill→relaunch→card renders→one-tap resume lands at wall-clock position | FILE-03 #2 | Real IndexedDB persistence across process kill cannot be simulated in node-env Vitest | Kill app mid-playback, relaunch, compare resume position vs wall clock |
| The 3-line persist `useEffect` wiring fires on session identity change | FILE-03 #1 | Effect is wiring; policy behavior covered by store-layer unit tests | Observe save/clear calls in devtools during create/pause/resume/offset/stop |
| Dismiss → relaunch shows no card; stale session (`startedAt` edited in devtools) → no card | FILE-03 #3 | UX confirmation after store-clear unit tests | Follow 05-UAT device checkpoint format |
| ResumeCard rendering/base styling | FILE-03 #2 | No component-test setup exists (Phase 5 precedent: manual verification) | Visual check during device checkpoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
