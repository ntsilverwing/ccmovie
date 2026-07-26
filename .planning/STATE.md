# State: CinemaSyncSubs

## Project Reference
See: .planning/PROJECT.md (updated 2026-07-25)
**Core value:** 让非英语母语观众在影院看外语片时能跟上剧情
**Current focus:** Phase 1 — SRT Foundation

## Milestone
**Version:** v1.0
**Status:** In Progress
**Started:** 2026-07-26

## Current Phase
Phase 1 of 4: SRT Foundation

## Progress
**Plans:** 2/7 (Phase 1 planned)
**Phases:** 0/4
**Progress:** 5%

## Blockers
(None)

## Key Risks

| Risk | Mitigation | Phase |
|------|------------|-------|
| iOS Wake Lock broken on older versions (<18.4) | Dual-strategy: native API + NoSleep.js hidden video fallback | Phase 3 |
| SRT encoding corruption (GBK/BOM) | readAsArrayBuffer + explicit encoding detection + BOM stripping | Phase 1 |
| Subtitle timing drift over 2 hours | performance.now() + rAF architecture, never setInterval | Phase 2 |
| iOS 7-day cache eviction | IndexedDB primary + re-cache on launch | Phase 3 |
| iOS ignores manifest orientation | CSS portrait-mode rotate overlay | Phase 3 |

## Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Coarse granularity (4 phases) | Simple app scope, solo developer, minimal coordination overhead | 2026-07-26 |
| Phase 3 bundles PWA + Wake Lock + Persistence | These features share the "cinema readiness" theme and depend on Phase 2 completion | 2026-07-26 |
| Phase 4 for offset + high contrast | These are differentiators that need stable playback engine first | 2026-07-26 |

## Accumulated Context

### Architecture
- 3-layer pipeline: Parser → Playback Engine → Render Pipeline
- State Store as single source of truth
- Dual persistence: IndexedDB (subtitle data) + Cache API (app shell)
- Time-separation: performance.now() for timing, rAF for rendering only

### Tech Stack
- Vite 8.1.5 + vite-plugin-pwa 1.3.0
- Custom SRT parser (~50 lines, no subtitle.js — avoids Node.js stream deps)
- chardet 2.2.0 (encoding detection) + native TextDecoder (decoding)
- idb 8.0.3 (IndexedDB wrapper)
- Native Screen Wake Lock API + NoSleep.js fallback

### Open Questions
- ~~Encoding detection: TextDecoder heuristics vs iconv-lite~~ — RESOLVED: chardet + native TextDecoder (Phase 1)
- idb vs Dexie.js: STACK.md recommends idb, ARCHITECTURE.md recommends Dexie.js — resolve in Phase 3 planning
- NoSleep.js silent MP4 asset: needs generation — resolve in Phase 3 planning

---

*State initialized: 2026-07-26*
*Last updated: 2026-07-26*
