---
status: passed
phase: 07-engine-foundation
date: 2026-09-04
---

## Must-Haves

| # | ROADMAP Success Criteria | 结果 | 证据 |
|---|---|---|---|
| 1 | User can seek to any position during playback and subtitles update seamlessly without interruption | verified | `src/playback/PlaybackEngine.ts:142-145` 播放分支 `startTime = performance.now() - (targetMs - offsetMs)` + `lastIndex = -1` 重锚定无缝继续；`test/unit/playbackEngine.test.ts`（seek while playing re-anchors and continues）通过；UAT #1 pass |
| 2 | User can seek while paused and subtitles update immediately without pressing play | verified | `src/playback/PlaybackEngine.ts:146-152` 暂停分支更新 `pausedElapsed` 并立即 `findActiveCue + onCueChange`，不启动 rAF；`test/unit/playbackEngine.test.ts`（seek while paused … fires onCueChange immediately）通过；UAT #2 pass |
| 3 | After seeking, refreshing the page resumes from the exact seek position (not pre-seek position) | verified | `src/playback/session.ts:108-119` `seekSession` 纯函数：播放态 `startedAt = now - (targetMs - offsetMs)`、暂停态 `pausedElapsedMs = targetMs - offsetMs`，使 `sessionElapsedMs` 立即等于 targetMs；`src/hooks/usePlaybackEngine.ts:237-240` `seek` 原子更新 engine + session，复用已有 persist effect 写入 IndexedDB；`test/unit/session.test.ts` 3 用例（播放重锚定/暂停更新/resume 平滑）通过；UAT #3 pass |
| 4 | Timeline displays correct total duration matching the last subtitle cue end time | verified | `src/imports/srtParser.ts:124` `totalDurationMs = cues.length > 0 ? cues[cues.length-1].end : 0`；`src/types/subtitle.ts:52` 类型字段；`src/App.tsx:193,261` 两处 StoredSubtitle 重建回填；`src/components/Timeline.tsx` 右端/上界消费 `totalDurationMs`；`test/unit/srtParser.test.ts`（正常=末 cue end / 空=0）通过 |

## Automated Checks

| 检查 | 结果 |
|---|---|
| `npm test` | 全绿：11 文件 / 172 tests passed（含 session 44、playbackEngine 19、srtParser 13） |
| `npx tsc --noEmit` | 干净，exit 0 |
| `npm run build` | 未跑（test + tsc 已充分覆盖本阶段纯引擎/解析变更；Timeline 消费侧由 Phase 08 验证） |

## Requirement Traceability

| 需求 | 交代 |
|---|---|
| ENG-01（PlaybackEngine.seek：播中无缝继续 / 暂停触发 onCueChange 实时更新） | 覆盖：`PlaybackEngine.seek` 双路径 + 暂停即时 cue 发射；单测 D1（07-01-SUMMARY coverage D1）pass；UAT #1/#2/#4 pass |
| ENG-02（Seek 后 Session 同步：重锚定 startedAt，保证刷新/杀进程后恢复到 Seek 位置） | 覆盖：`seekSession` 双态重锚定 + hook `seek` 原子更新 + effect 持久化；单测 D2（播放重锚定/暂停更新/resume 平滑）pass；UAT #3/#5 pass |
| ENG-03（解析时提取最后一条字幕 end 作为 totalDurationMs 供 Timeline） | 覆盖：`parseSRT` Step 10 派生 + `ParsedSubtitle.metadata.totalDurationMs` + App 两处重建回填；单测（07-02-SUMMARY coverage D1/D2）pass；UAT #6/#7 pass |

## Human Verification

已由 `07-UAT.md` 覆盖：7/7 pass（3 项人工测试：播中 Seek 无缝继续 / 暂停 Seek 立即刷新 / Seek 后刷新恢复；4 项自动覆盖：engine 双态、seekSession、totalDurationMs、重建回填），status complete，无新增项。none。

## Known Observations

非阻塞观察项（源自 `07-REVIEW.md`：0 Critical / 2 Warning / 3 Info；08/09/10 均已通过各自 UAT，未暴露实际故障）：

- WR-01（Warning）：`usePlaybackEngine.seek` 在 `session === null`（idle ready 态）时只推进 engine 不建会话，后续 `play()` 走 `createSession` 从 0 新建，可能造成引擎/会话位置分叉。属 idle 态边缘路径，不在 Phase 7 四条 Success Criteria 范围内（SC 均以活跃会话为前提），且未在 UAT 与后续阶段暴露故障；记录观察，不阻塞。建议后续在 hook 层加守卫（无会话时 no-op 或先建会话）或由调用方禁用 idle 态 seek。
- WR-02（Warning）：三层 seek 入口无 `Number.isFinite` 校验，NaN/负数可毒化计时。实际调用方均为数值型（Phase 08 `clampToDuration` 负责上界夹紧），无确定性复现路径；记录观察，不阻塞。建议在 `seek`/`seekSession` 入口加有限性守卫 + 下界夹紧。
- IN-01（Info）：`App.tsx` 两处 StoredSubtitle 重建逻辑重复，加字段需改两处；行为正确，仅可维护性问题。
- IN-02（Info）：`totalDurationMs` 取文件顺序最后一条而非全量 max，乱序 SRT 会低估右端；与引擎自停条件一致，符合 D-01 标准 SRT 有序假设。
- IN-03（Info）：暂停分支 `lastIndex = -1` 冗余赋值 + `parseInt` 未传 radix；无行为影响。
