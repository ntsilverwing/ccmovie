# Phase 7: Engine Foundation - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

为字幕播放引擎增加精确定位能力：播放中和暂停中均可 Seek；每次定位后，单调引擎时钟与 wall-clock 会话锚点保持一致并可正确续播；解析结果提供最后一条有效字幕结束时间作为总时长。Timeline、手势和控制区 UI 不在本阶段实现。

</domain>

<decisions>
## Implementation Decisions

### 定位边界
- **D-01:** Timeline 的右端是最后一条有效字幕的结束时间；定位到该时间时停在末尾，不提供额外片尾空白区。
- **D-02:** 所有定位入口统一将目标时间夹紧到 `[0, totalDurationMs]`；不接受或保存越界位置。
- **D-03:** 播放中定位到总时长时立即结束播放并清除会话，不能留下可错误续播的持久化记录。
- **D-04:** 播放中定位到 `0:00` 时继续播放并等待第一句字幕；开场无字幕区保持黑屏，不能吸附到第一句或自动暂停。

### 字幕空档与异常输入
- **D-05:** 定位到两条字幕之间的空档时，播放和暂停状态均显示黑屏空白；不保留前一句、不预显下一句，也不自动吸附。
- **D-06:** 对解析器保留的重叠字幕，不重排、不改写；沿用原 SRT 数组顺序和既有查找语义。
- **D-07:** 没有有效 cue、总时长为零时，定位保持空闲且不创建/保存会话。

### 暂停时定位与会话同步
- **D-08:** 暂停状态 Seek 后必须保持暂停，同时立即以目标时刻的字幕或空白更新画面；不得自动播放。
- **D-09:** 暂停状态的定位在提交时立即持久化，保证刷新或被系统终止后仍能恢复到新位置；不在拖拽过程的每一帧写 IndexedDB。
- **D-10:** 暂停定位后刷新或重启，用户点现有「续播」操作时从该位置直接播放，沿用 v1.1 一键续播语义。
- **D-11:** Timeline 输入和显示采用 offset-inclusive 的校正后位置空间，与 `sessionElapsedMs()`、SessionBanner 和 ResumeCard 一致；定位不得重置或重复应用 offset。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and requirements
- `.planning/ROADMAP.md` §Phase 7 — Phase goal, dependency boundary, and observable success criteria.
- `.planning/REQUIREMENTS.md` §Engine Enhancement — Locked requirements ENG-01, ENG-02, and ENG-03.
- `.planning/PROJECT.md` §Current Milestone and §Constraints — Product context, manual synchronization boundary, and PWA compatibility constraints.

### Existing timing design
- `.planning/notes/audio-sync-assessment.md` — Basis for retaining manual synchronization and the dual-clock playback design referenced by the session module.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/playback/PlaybackEngine.ts`: Existing `seekTo(elapsedMs)` already re-anchors a playing engine in offset-inclusive position space; `findActiveCue()` provides binary search and intentionally returns `-1` in cue gaps.
- `src/playback/session.ts`: Pure clock-injected session transitions, `sessionElapsedMs()`, `updateSessionOffset()`, and `formatElapsedHMS()` establish the persisted-session model.
- `src/hooks/usePlaybackEngine.ts`: Owns engine/session coordination and the semantic-change-only persistence effect; this is the single integration point that should expose user-initiated Seek.
- `src/imports/srtParser.ts` and `src/types/subtitle.ts`: Parser already returns ordered valid cues and metadata; extend the parsed result shape with total duration derived from the final valid cue.
- `test/unit/playbackEngine.test.ts`, `test/unit/session.test.ts`, and `test/unit/srtParser.test.ts`: Established Vitest faked-clock and pure-function test patterns for new contracts.

### Established Patterns
- `performance.now()` is the PlaybackEngine's only timing source; `Date.now()` belongs exclusively at session call sites. Do not merge the clocks.
- Position values passed to `PlaybackEngine.seekTo()` and `sessionElapsedMs()` are offset-inclusive. `pausedElapsedMs` is offset-exclusive.
- Session persistence is effect-driven after a semantic transition, never driven by rAF ticks; preserve the `hasPersistedRef` boot-hydration guard.
- The existing restore sequence is `setCues()` -> `play()` -> `seekTo()` and its tests are an explicit ordering contract.

### Integration Points
- Extend `PlaybackEngine` so a paused seek updates `pausedElapsed`, resets the cue hint, and emits the destination cue/empty state without starting rAF.
- Add a pure session transition in `src/playback/session.ts` that re-anchors playing or paused records at a requested offset-inclusive target without double-applying `offsetMs`.
- Expose one hook-level seek entry point in `usePlaybackEngine`; it must update engine and session together so the existing persistence effect saves only the completed position.
- Extend the parse/import and saved-subtitle reconstruction paths to carry `totalDurationMs` into later Timeline work.

</code_context>

<specifics>
## Specific Ideas

用户优先保证暗场影院中的时间轴准确性：空档即黑屏、开场保持等待、末尾立即结束。刷新后的「续播」仍应是一键直接播放，但必须从用户最后一次暂停定位的位置开始。

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `playback-toolbar-layout.md` — 控制条整体布局优化属于 Phase 10 的 Control Layering & Settings Drawer，不并入 Phase 7。

</deferred>

---

*Phase: 7-Engine Foundation*
*Context gathered: 2026-08-31*
