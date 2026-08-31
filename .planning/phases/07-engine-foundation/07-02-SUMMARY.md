---
phase: 07-engine-foundation
plan: 02
subsystem: import
tags: [srt-parser, metadata, totalDurationMs, subtitle, vitest]
requires:
  - phase: 07-engine-foundation
    provides: 07-01 seek infrastructure (not strictly required but same milestone)
provides:
  - ParsedSubtitle.metadata.totalDurationMs — 最后一条有效 cue 的 end 时间，无 cue 时为 0
  - App.tsx StoredSubtitle 重建时 totalDurationMs 回填，保证持久化记录同样携带时长
affects: [08-timeline-progress-bar]

tech-stack:
  added: []
  patterns:
    - "Derived metadata at parse boundary: totalDurationMs = cues[cues.length-1].end ?? 0"

key-files:
  created: []
  modified:
    - src/types/subtitle.ts
    - src/imports/srtParser.ts
    - src/App.tsx
    - test/unit/srtParser.test.ts

key-decisions:
  - "D-01 Timeline右端为最后一条有效字幕 end 时间, 定位到该时间停在末尾不提供额外空白"
  - "D-07 无有效 cue 时 totalDurationMs=0, 定位保持空闲不创建会话"

patterns-established:
  - "totalDurationMs derived once at parse time, carried via ParsedSubtitle.metadata and StoredSubtitle reconstruction"

requirements-completed: [ENG-03]

coverage:
  - id: D1
    description: "parseSRT 在返回 metadata 中计算 totalDurationMs = lastCue.end, 空文件为 0"
    requirement: ENG-03
    verification:
      - kind: unit
        ref: "test/unit/srtParser.test.ts#totalDurationMs is last cue end / 0 for empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.tsx 从 StoredSubtitle 重建 ParsedSubtitle 时回填 totalDurationMs"
    requirement: ENG-03
    verification:
      - kind: other
        ref: "grep App.tsx totalDurationMs + tsc --noEmit clean"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-31
status: complete
---

# Phase 07 Plan 02: Total Duration Metadata Summary

**SRT 解析在 metadata 中派生 totalDurationMs = lastCue.end（空文件为 0），并贯通 StoredSubtitle 重建路径供 Timeline 使用**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-31T10:35:00Z
- **Completed:** 2026-08-31T11:46:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `src/types/subtitle.ts` 在 `ParsedSubtitle.metadata` 新增 `totalDurationMs: number`
- `src/imports/srtParser.ts` 在解析后计算 `cues.length > 0 ? cues[cues.length-1].end : 0` 并写入 metadata
- `src/App.tsx` 两处 `StoredSubtitle → ParsedSubtitle` 重建点回填 `totalDurationMs`，保证持久化与导入路径一致
- `test/unit/srtParser.test.ts` 补充 totalDurationMs 断言：正常文件等于末 cue end，空/无效文件为 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Update subtitle.ts type** - `98e0b1e` (feat: totalDurationMs field)
2. **Task 2: Update srtParser.ts** - `98e0b1e` (feat: compute totalDurationMs at parse boundary)
3. **Task 3: Update downstream App.tsx + tests** - `98e0b1e` (feat: reconstruction + test mocks)

**Plan metadata:** `98e0b1e` (feat: engine seek with session sync)

## Files Created/Modified

- `src/types/subtitle.ts` - metadata 新增 totalDurationMs 字段
- `src/imports/srtParser.ts` - Step 10 计算 totalDurationMs，Step 11 返回
- `src/App.tsx` - handleSelectSaved 与 boot restore 两处重建时计算 lastCue.end
- `test/unit/srtParser.test.ts` - 补充 totalDurationMs 断言与 mock 更新

## Decisions Made

- D-01：Timeline 右端即最后一条 cue end，不额外扩展空白区
- D-07：零 cue 时 Seek 保持空闲，totalDurationMs=0 避免除零与越界

## Deviations from Plan

None - plan executed exactly as written. App.tsx 的两处重建为计划中 "downstream mocks" 的实际落地点，符合解析结果贯通要求。

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Timeline 可直接读取 `parsedSubtitle.metadata.totalDurationMs` 作为右端与拖拽夹紧上界 `[0, totalDurationMs]`
- 无有效字幕时 Timeline 应禁用拖拽（totalDurationMs=0）
- 已验证 `npm test` 117 passed, `tsc --noEmit` clean

---
*Phase: 07-engine-foundation*
*Completed: 2026-08-31*
