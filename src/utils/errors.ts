/**
 * Error thrown during subtitle file import (file type, size, empty result).
 */
export class ImportError extends Error {
  /** Error code for programmatic handling */
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}
