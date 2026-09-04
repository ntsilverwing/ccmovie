# Plan 07-02: Total Duration Metadata

## Context
This plan implements ENG-03 from Phase 7 (Engine Foundation).
We need to extract the last cue's end time as `totalDurationMs` during SRT parsing.

**Decisions:**
- D-01: Timeline 的右端是最后一条有效字幕的结束时间；定位到该时间时停在末尾，不提供额外片尾空白区。
- D-07: 没有有效 cue、总时长为零时，定位保持空闲且不创建/保存会话。

## Steps

1. **Update `src/types/subtitle.ts`**
   - Add `totalDurationMs: number` to the `metadata` object within the `ParsedSubtitle` interface.

2. **Update `src/imports/srtParser.ts`**
   - In `parseSRT(content: string)`, after parsing all cues and constructing the `cues` array, compute:
     `const totalDurationMs = cues.length > 0 ? cues[cues.length - 1].end : 0;`
   - Add `totalDurationMs` to the returned `metadata` object.
   - Add/update unit tests in `test/unit/srtParser.test.ts` to assert that `totalDurationMs` is calculated correctly for:
     - Normal valid SRT files
     - Empty/invalid SRT files (where total duration should be 0)

3. **Update Downstream Usage (Mocks & Data)**
   - Update any mock `ParsedSubtitle` objects in test files to include `totalDurationMs: 0` (or appropriate value) to satisfy the TypeScript compiler. (e.g., in `test/unit/srtParser.test.ts`).

## Verification
- Run `npx vitest run test/unit/srtParser.test.ts` to verify parser tests.
- Run `npx tsc --noEmit` to verify type safety across the codebase.
