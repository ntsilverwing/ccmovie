# Roadmap: CinemaSyncSubs

## Milestones

- ✅ **v1.0 Cinema Subtitle PWA** — Phases 1-4 (shipped 2026-07-29)
- ✅ **v1.1 Session Resilience** — Phases 5-6 (shipped 2026-08-01)
- 🚧 **v1.2 Playback UI Redesign & Timeline** — Phases 7-10 (in progress)

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

### 🚧 v1.2 Playback UI Redesign & Timeline (In Progress)

**Milestone Goal:** 重构播放控制区，引入全局 Timeline 进度条和手势操作，解决控制区功能堆叠、无法快速定位时间点的问题。

- [x] **Phase 7: Engine Foundation** (2/2 plans) — completed 2026-08-31
- [ ] **Phase 8: Timeline & Progress Bar** - 可视化播放进度与拖拽导航
- [ ] **Phase 9: Gesture Navigation** - 暗场影院环境下的触控手势字幕导航
- [ ] **Phase 10: Control Layering & Settings Drawer** - 控制区分层与设置面板收纳

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

## Phase Details

### Phase 7: Engine Foundation

**Goal**: PlaybackEngine 支持精确定位控制与 Seek 后会话状态一致性
**Depends on**: Nothing (v1.2 first phase)
**Requirements**: ENG-01, ENG-02, ENG-03
**Success Criteria** (what must be TRUE):

  1. User can seek to any position during playback and subtitles update seamlessly without interruption
  2. User can seek while paused and subtitles update immediately without pressing play
  3. After seeking, refreshing the page resumes from the exact seek position (not pre-seek position)
  4. Timeline displays correct total duration matching the last subtitle cue end time

**Plans**: 2/2 plans completed

Plans:

- [x] 07-01: Engine Seek & Session Sync — completed 2026-08-31
- [x] 07-02: Total Duration Metadata — completed 2026-08-31

### Phase 8: Timeline & Progress Bar

**Goal**: 用户可可视化播放进度并通过拖拽时间线导航到任意位置
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):

  1. User sees a progress bar with current time on left and total duration on right
  2. User can drag the timeline to any position and playback updates seamlessly in both playing and paused states
  3. Timeline shows cue density markers indicating subtitle activity along the progress bar

**Plans**: 2 plans

Plans:
**Wave 1**

- [ ] 08-01: Timeline 纯函数与 previewSeek 基础 — 密度分桶/钳制/键盘步进（TDD）+ timelineLabel i18n

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 08-02: Timeline 组件与集成 — Timeline.tsx/.timeline* CSS/props 链 + 人工拖拽验证

**UI hint**: yes

### Phase 9: Gesture Navigation

**Goal**: 用户在暗场影院环境中可通过盲操触控手势导航字幕
**Depends on**: Phase 7
**Requirements**: UI-04, UI-05
**Success Criteria** (what must be TRUE):

  1. User can swipe up on the screen to jump to the next subtitle cue
  2. User can swipe down to jump to the previous subtitle cue
  3. First-time users see a brief gesture hint overlay that can be dismissed and won't appear again

**Plans**: TBD

Plans:

- [ ] 09-01: TBD

**UI hint**: yes

### Phase 10: Control Layering & Settings Drawer

**Goal**: 播放控制区功能分层，低频操作收纳进设置面板，主控制栏保持简洁
**Depends on**: Phase 8, Phase 9
**Requirements**: UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):

  1. Main control bar shows only Timeline + Play/Pause + Settings button
  2. User can open a settings drawer with offset, font size, contrast, dim mode, and fullscreen controls
  3. Controls auto-hide after 3 seconds of inactivity and reappear on screen tap

**Plans**: TBD

Plans:

- [ ] 10-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Engine Foundation | v1.2 | 2/2 | Completed | 2026-08-31 |
| 8. Timeline & Progress Bar | v1.2 | 0/2 | Not started | - |
| 9. Gesture Navigation | v1.2 | 0/1 | Not started | - |
| 10. Control Layering & Settings Drawer | v1.2 | 0/1 | Not started | - |
