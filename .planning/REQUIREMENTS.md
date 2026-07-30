# Requirements: CinemaSyncSubs

**Defined:** 2026-07-25
**Milestone:** v1.1 — Session Resilience
**Core Value:** 让非英语母语观众在影院看外语片时能跟上剧情

## v1.1 Requirements

Current milestone scope. Both rest on the same mechanism: a wall-clock-based playback session (subtitle ID + `startedAt` timestamp + offset) persisted to IndexedDB.

### Playback

- [ ] **PLAY-08**: User can return from playback page to subtitle selection without losing playback state
  - 播放控制栏提供弱化返回项（低视觉权重，防误触）
  - 接管 Android PWA 系统返回手势/返回键：回到选择页而非退出应用
  - 返回保留全部播放状态（当前字幕、时间偏移、显示设置）；时钟基于真实时间（startedAt 时间戳）继续走
  - 选择页顶部短暂提示"原字幕已保留，可直接继续播放"
  - 重新进入播放页：按 `now - startedAt + 偏移` 无缝续播

### File Management

- [ ] **FILE-03**: Playback session persists across app kill/refresh; user resumes from the correct position
  - 会话（字幕 ID、startedAt、偏移）持久化到 IndexedDB；偏移调整即时写入
  - 应用被误杀/刷新后重启：选择页顶部显示续播卡片（片名 + 已播时长），一键从正确位置续播
  - 续播卡片可手动关闭 = 放弃会话；超时自动作废（阈值在规划时定义，默认 ~6 小时）
  - 载入新字幕即替换现有会话

## v1 Requirements (Shipped 2026-07-29)

Archived for reference. Full details: `.planning/milestones/v1.0-REQUIREMENTS.md`

### Playback

- [x] **PLAY-01**: User can import SRT subtitle files via file picker or drag-drop
- [x] **PLAY-02**: System parses SRT files with automatic encoding detection (GBK/UTF-8/Big5/Shift-JIS)
- [x] **PLAY-03**: User can manually start playback by tapping a "Start" button
- [x] **PLAY-04**: Subtitles display synchronously using performance.now() + requestAnimationFrame timing
- [x] **PLAY-05**: Subtitles render as white text on pure black background (OLED-optimized)
- [x] **PLAY-06**: User can adjust subtitle timing offset (±N seconds) to fix misalignment
- [x] **PLAY-07**: User can toggle high-contrast mode (yellow text on black)

### Display

- [x] **DISP-01**: User can adjust font size via slider or +/- buttons
- [x] **DISP-02**: Screen stays awake during playback via Wake Lock API with NoSleep.js fallback
- [x] **DISP-03**: UI supports minimum brightness mode (gray text option for darker appearance)

### File Management

- [x] **FILE-01**: Imported subtitle files persist locally across sessions via IndexedDB
- [x] **FILE-02**: App works offline via Service Worker + Cache API (no network needed after first load)

### PWA & Distribution

- [x] **PWA-01**: User can add the app to home screen (PWA manifest)
- [x] **PWA-02**: App supports landscape orientation (CSS-based with rotate overlay fallback for iOS)
- [x] **PWA-03**: App shell precached for offline-first experience

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

- **FUTR-01**: Audio-based auto-sync (fingerprint matching to detect current position) — 评估于 2026-07-30（见 `notes/audio-sync-assessment.md`）：上映窗口期无合法参照音频，且真痛点已被 v1.1 会话持久化覆盖。重启触发条件：使用场景变为数字版/蓝光发行后的家庭观看
- **FUTR-02**: Online subtitle search and download (OpenSubtitles integration)
- **FUTR-03**: Multi-language simultaneous display (two languages at once)
- **FUTR-04**: Subtitle translation (real-time or pre-translated)

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / auth | No need for identity; local-only app |
| Social features (sharing, ratings) | Not core to the value proposition |
| Cross-device sync | Local-first design; adds backend complexity |
| Native iOS/Android app | PWA sufficient for v1; no App Store |
| Video/audio playback | This is a subtitle-only tool |
| DRM handling | User provides their own SRT files |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAY-01 | Phase 1 (v1.0) | Complete |
| PLAY-02 | Phase 1 (v1.0) | Complete |
| PLAY-03 | Phase 2 (v1.0) | Complete |
| PLAY-04 | Phase 2 (v1.0) | Complete |
| PLAY-05 | Phase 2 (v1.0) | Complete |
| PLAY-06 | Phase 4 (v1.0) | Complete |
| PLAY-07 | Phase 4 (v1.0) | Complete |
| DISP-01 | Phase 2 (v1.0) | Complete |
| DISP-02 | Phase 3 (v1.0) | Complete |
| DISP-03 | Phase 2 (v1.0) | Complete |
| FILE-01 | Phase 3 (v1.0) | Complete |
| FILE-02 | Phase 3 (v1.0) | Complete |
| PWA-01 | Phase 3 (v1.0) | Complete |
| PWA-02 | Phase 3 (v1.0) | Complete |
| PWA-03 | Phase 3 (v1.0) | Complete |
| PLAY-08 | Phase 5 (v1.1) | Pending |
| FILE-03 | Phase 6 (v1.1) | Pending |

**Coverage:**
- v1 requirements: 15 total, all shipped
- v1.1 requirements: 2 total, 2/2 mapped to roadmap (PLAY-08 → Phase 5, FILE-03 → Phase 6)

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-07-30 — v1.1 roadmap mapped (Phases 5-6)*
