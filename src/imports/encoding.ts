import chardet from 'chardet'

/**
 * Detect encoding from raw bytes and decode to a UTF-8 string.
 *
 * Pipeline:
 * 1. Check UTF-8 BOM (bytes 0xEF, 0xBB, 0xBF) → decode rest as UTF-8
 * 2. Try UTF-8 fast path with fatal: true → if succeeds, it's valid UTF-8
 * 3. Fall back to chardet.analyse on raw bytes to detect CJK encoding
 * 4. Decode with detected encoding (fatal: false for resilience)
 *
 * @param buffer - raw file bytes (Uint8Array), NOT a decoded string
 * @returns decoded text and detected encoding name
 */
export function detectAndDecode(buffer: Uint8Array): { text: string; encoding: string } {
  // Stage 1: Check for UTF-8 BOM (0xEF 0xBB 0xBF)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return {
      text: new TextDecoder('utf-8').decode(buffer.slice(3)),
      encoding: 'UTF-8 (BOM)',
    }
  }

  // Stage 2: Try UTF-8 fast path with fatal: true (throws on invalid sequences)
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return { text, encoding: 'UTF-8' }
  } catch {
    // Not valid UTF-8, proceed to chardet detection
  }

  // Stage 3: Use chardet to detect encoding from raw bytes
  const detected = chardet.analyse(buffer)

  // Filter to known CJK encodings relevant to our use case
  const cjkEncodings = ['GB18030', 'GBK', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR']
  const cjkMatch = detected.find((d) => cjkEncodings.includes(d.name))
  const encoding = cjkMatch?.name || detected[0]?.name || 'utf-8'

  // Stage 4: Decode with detected encoding (fatal: false for resilience)
  try {
    const text = new TextDecoder(encoding, { fatal: false }).decode(buffer)
    return { text, encoding }
  } catch {
    // Unsupported encoding (e.g., exotic ISO variant) — fall back to UTF-8 with replacement
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return { text, encoding: 'UTF-8 (fallback)' }
  }
}
