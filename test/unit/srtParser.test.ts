import { describe, it, expect } from 'vitest'
import { parseSRT } from '../../src/imports/srtParser'
import type { Cue } from '../../src/types/subtitle'

const SAMPLE_SRT = `1
00:00:25,270 --> 00:00:26,610
A face.

2
00:00:29,330 --> 00:00:30,670
A fleet.

3
00:00:33,230 --> 00:00:34,590
A war.
`

describe('parseSRT', () => {
  it('parses a valid SRT file correctly', () => {
    const result = parseSRT(SAMPLE_SRT)
    expect(result.cues).toHaveLength(3)
    expect(result.cues[0]).toEqual({
      id: 1,
      start: 25270,
      end: 26610,
      text: 'A face.',
    })
    expect(result.cues[2]).toEqual({
      id: 3,
      start: 33230,
      end: 34590,
      text: 'A war.',
    })
  })

  it('handles CR and CRLF line endings', () => {
    const crlf = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\n'
    const result = parseSRT(crlf)
    expect(result.cues).toHaveLength(2)
    expect(result.cues[0].text).toBe('Hello')
    expect(result.cues[1].text).toBe('World')
  })

  it('strips BOM character', () => {
    const withBOM = '\uFEFF1\n00:00:01,000 --> 00:00:02,000\nHello'
    const result = parseSRT(withBOM)
    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].text).toBe('Hello')
  })

  it('accepts dot timecode separator (European format)', () => {
    const srt = '1\n00:00:01.500 --> 00:00:02.500\nHello'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].start).toBe(1500)
    expect(result.cues[0].end).toBe(2500)
  })

  it('preserves multi-line text', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two'
    const result = parseSRT(srt)
    expect(result.cues[0].text).toBe('Line one\nLine two')
  })

  it('parses timecodes with more than 2 digit hours', () => {
    const srt = '1\n100:00:01,000 --> 100:00:02,000\nLong movie'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].start).toBe(360001000)
    expect(result.cues[0].end).toBe(360002000)
  })

  it('drops cues where end <= start with error', () => {
    const srt = '1\n00:00:05,000 --> 00:00:03,000\nBad times\n\n2\n00:00:01,000 --> 00:00:01,000\nZero duration'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].type).toBe('invalid_timecode')
  })

  it('detects overlapping cues', () => {
    const srt = '1\n00:00:01,000 --> 00:00:05,000\nFirst\n\n2\n00:00:04,000 --> 00:00:06,000\nOverlaps'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].type).toBe('overlap')
  })

  it('reports blocks with no timecode', () => {
    const srt = '1\nnot a timecode\nHello'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(0)
    expect(result.errors[0].type).toBe('invalid_timecode')
  })

  it('reports empty text', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n   '
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(0)
    expect(result.errors[0].type).toBe('empty_text')
  })

  it('parses missing sequence numbers using line position', () => {
    const srt = '00:00:01,000 --> 00:00:02,000\nNo number'
    const result = parseSRT(srt)
    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].id).toBe(1)
  })

  it('returns correct metadata', () => {
    const result = parseSRT(SAMPLE_SRT)
    expect(result.metadata.cueCount).toBe(3)
    expect(typeof result.metadata.parsedAt).toBe('number')
  })
})
