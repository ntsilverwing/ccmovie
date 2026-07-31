# Roadmap: CinemaSyncSubs

## Milestones

- ✅ **v1.0 Cinema Subtitle PWA** — Phases 1-4 (shipped 2026-07-29)
- 🚧 **v1.1 Session Resilience** — Phases 5-6 (in progress)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3...): Planned milestone work — numbering is continuous across milestones (v1.0 ended at Phase 4; v1.1 starts at Phase 5)
- Decimal phases (5.1, 5.2): Urgent insertions (marked INSERTED), execute between surrounding integers

<details>
<summary>✅ v1.0 Cinema Subtitle PWA (Phases 1-4) — SHIPPED 2026-07-29</summary>

- [x] **Phase 1: SRT Foundation** — 2/2 plans, completed 2026-07-27
- [x] **Phase 2: Playback & Display** — 3/3 plans, completed 2026-07-27
- [x] **Phase 3: Cinema Readiness** — 5/5 plans, completed 2026-07-29
- [x] **Phase 4: Polish & Accessibility** — 1/1 plans, completed 2026-07-29

Full v1.0 phase details archived: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Session Resilience (In Progress)

**Milestone Goal:** 播放会话基于真实时间轴持久化——返回不误丢、杀进程可续播，彻底消除"手动重新对轴"的痛点

**Shared mechanism:** Both v1.1 requirements rest on one wall-clock playback session — subtitle ID + `startedAt` real timestamp + offset — persisted via idb/IndexedDB. Resume position is always `now − startedAt + offset`. Mechanism rationale: `.planning/notes/audio-sync-assessment.md`

- [x] **Phase 5: Lossless Playback Navigation** — 4/4 plans, completed 2026-07-30
- [ ] **Phase 6: Session Persistence & Resume** — Session survives app kill/refresh; one-tap resume card on relaunch

## Phase Details

### Phase 5: Lossless Playback Navigation

**Goal**: User can leave the playback page and come back without ever losing the synced position — the subtitle clock keeps pace with real time while they're away
**Depends on**: Phase 4 (v1.0 playback engine complete)
**Requirements**: PLAY-08
**Success Criteria** (what must be TRUE):

  1. User can exit playback via a low-visual-weight back control (no accidental taps) and land on the subtitle selection page
  2. User pressing the Android PWA system back gesture/button during playback lands on the selection page instead of exiting the app
  3. User returning to the selection page sees a brief "original subtitle retained, continue playing" hint, with full playback state intact (current cue, timing offset, display settings)
  4. User re-entering playback resumes at the exact position implied by real elapsed time (`now − startedAt + offset`) — no manual re-sync needed

**Plans**: 4/4 plans executed
**Plan list**:

- [x] 05-01-PLAN.md — Wall-clock session timing model (TDD: session.ts + vitest RED/GREEN)
- [x] 05-02-PLAN.md — Navigation history interception policy (TDD: playbackHistory.ts + vitest RED/GREEN)
- [x] 05-03-PLAN.md — Session UI surfaces (SessionBanner, SessionToast, low-weight back control, i18n, CSS)
- [x] 05-04-PLAN.md — App.tsx integration: view decoupling, popstate interception, leave/resume flows, device checkpoint

**UI hint**: yes

### Phase 6: Session Persistence & Resume

**Goal**: Playback session persists across app kill/refresh; the user resumes from the correct position via a resume card and never re-syncs manually
**Depends on**: Phase 5
**Requirements**: FILE-03
**Success Criteria** (what must be TRUE):

  1. User's active session (subtitle ID, `startedAt`, offset) is persisted to IndexedDB, with every offset adjustment written immediately
  2. User relaunching the app after a kill/refresh sees a resume card atop the selection page (movie title + elapsed duration) and resumes from the correct position in one tap
  3. User can dismiss the resume card to abandon the session, and sessions older than the expiry threshold (default ~6 hours; exact value finalized during Phase 6 planning) are automatically invalidated
  4. User loading a new subtitle replaces any existing session

**Plans**: TBD
**UI hint**: yes

## Backlog

Deferred to v2 (not in current roadmap):

| Item | Description | Reason |
|------|-------------|--------|
| FUTR-01 | Audio-based auto-sync (fingerprint matching) | No legal reference audio during theatrical window; real pain point covered by v1.1 session persistence (assessed 2026-07-30) |
| FUTR-02 | Online subtitle search/download (OpenSubtitles) | Adds API complexity; v1 user provides own SRT |
| FUTR-03 | Multi-language simultaneous display | Niche use case; v1 single language |
| FUTR-04 | Subtitle translation (real-time or pre-translated) | High complexity; v1 plays existing subtitles |
| Multi-movie management | Switch between multiple stored subtitles | v1 single movie per session sufficient |
| Export-to-file backup | Backup subtitles to file for iOS 7-day eviction recovery | Enhancement after core experience validated |

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. SRT Foundation | v1.0 | 2/2 | Complete | 2026-07-27 |
| 2. Playback & Display | v1.0 | 3/3 | Complete | 2026-07-27 |
| 3. Cinema Readiness | v1.0 | 5/5 | Complete | 2026-07-29 |
| 4. Polish & Accessibility | v1.0 | 1/1 | Complete | 2026-07-29 |
| 5. Lossless Playback Navigation | v1.1 | 4/4 | Complete | 2026-07-30 |
| 6. Session Persistence & Resume | v1.1 | 0/TBD | Not started | - |

## Coverage

- **v1.0:** 15/15 requirements complete (100%) — archived in `.planning/milestones/v1.0-ROADMAP.md`
- **v1.1:** 2/2 requirements mapped (100%) — PLAY-08 → Phase 5, FILE-03 → Phase 6

---

*Roadmap created: 2026-07-26*
*Last updated: 2026-07-30 — v1.1 roadmap created (Phases 5-6)*
