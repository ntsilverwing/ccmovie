# Roadmap: CinemaSyncSubs

## Milestones

- ✅ **v1.0 Cinema Subtitle PWA** — Phases 1-4 (shipped 2026-07-29)
- ✅ **v1.1 Session Resilience** — Phases 5-6 (shipped 2026-08-01)

## Phases

<details>
<summary>✅ v1.0 Cinema Subtitle PWA (Phases 1-4) — SHIPPED 2026-07-29</summary>

- [x] Phase 1: SRT Foundation (2/2 plans) — completed 2026-07-27
- [x] Phase 2: Playback & Display (3/3 plans) — completed 2026-07-27
- [x] Phase 3: Cinema Readiness (5/5 plans) — completed 2026-07-29
- [x] Phase 4: Polish & Accessibility (1/1 plan) — completed 2026-07-29

</details>

<details>
<summary>✅ v1.1 Session Resilience (Phases 5-6) — SHIPPED 2026-08-01</summary>

- [x] Phase 5: Lossless Playback Navigation (4/4 plans) — completed 2026-07-30
- [x] Phase 6: Session Persistence & Resume (3/3 plans) — completed 2026-08-01

</details>

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
