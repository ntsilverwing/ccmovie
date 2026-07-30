import { describe, it, expect } from 'vitest'
import { ImportError } from '../../src/utils/errors'

describe('ImportError', () => {
  it('has correct name and code', () => {
    const err = new ImportError('INVALID_TYPE', 'Bad file type')
    expect(err.name).toBe('ImportError')
    expect(err.code).toBe('INVALID_TYPE')
    expect(err.message).toBe('Bad file type')
  })

  it('instanceof Error', () => {
    const err = new ImportError('X', 'msg')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ImportError)
  })
})
