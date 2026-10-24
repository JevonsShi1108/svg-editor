import { DomainError } from '../../domain/errors/DomainError.js';
import type { Diagnostic } from '../contracts/api.js';
export class EditorError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(code: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(code);
    this.diagnostic = Object.freeze({ code, parameters: Object.freeze({ ...parameters }) });
  }
  static from(error: unknown): EditorError {
    if (error instanceof EditorError) return error;
    if (error instanceof DomainError) return new EditorError(error.code, error.details);
    return new EditorError('INTERNAL_EXECUTION_ERROR');
  }
}
