import { describe, it, expect } from 'vitest'
import { detectAndDecode } from '../../src/imports/encoding'

function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

describe('detectAndDecode', () => {
  it('detects plain UTF-8', () => {
    const buffer = strToBytes('Hello, 世界!')
    const { text, encoding } = detectAndDecode(buffer)
    expect(text).toBe('Hello, 世界!')
    expect(encoding).toBe('UTF-8')
  })

  it('detects and strips UTF-8 BOM', () => {
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const content = strToBytes('Hello')
    const buffer = new Uint8Array([...bom, ...content])
    const { text, encoding } = detectAndDecode(buffer)
    expect(text).toBe('Hello')
    expect(encoding).toBe('UTF-8 (BOM)')
  })

  it('handles empty buffer as UTF-8', () => {
    const { text, encoding } = detectAndDecode(new Uint8Array(0))
    expect(text).toBe('')
    expect(encoding).toBe('UTF-8')
  })
})
