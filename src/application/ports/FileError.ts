import type { FileFailure } from './FileStore.js';
export class FileError extends Error {
  readonly failure: FileFailure;
  constructor(failure: FileFailure) {
    super('FILE_IO_ERROR', { cause: failure.cause });
    this.name = 'FileError';
    this.failure = Object.freeze({ ...failure });
  }
}
