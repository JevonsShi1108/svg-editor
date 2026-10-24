import type { FileStore, FilePath, WriteOutcome } from '../../src/application/ports/FileStore.js';
import { EditorError } from '../../src/application/errors/EditorError.js';
import { Deferred } from './Deferred.js';
export class ControlledFileStore implements FileStore {
  readonly files = new Map<string, string>();
  readonly readCalls: { path: FilePath; maxBytes: number }[] = [];
  readonly writeCalls: { path: FilePath; source: string }[] = [];
  readonly resolveCalls: string[] = [];
  readonly readStarted = new Deferred<void>();
  readonly writeStarted = new Deferred<void>();
  readGate: Deferred<void> | null = null;
  writeGate: Deferred<void> | null = null;
  outcome: WriteOutcome['status'] = 'committed';
  physicalIndeterminate = false;
  throwAfterWrite = false;
  resolve(path: string): FilePath {
    this.resolveCalls.push(path);
    if (!path || path.includes('\0')) throw new Error('invalid path');
    return (path.startsWith('/') ? path : `/memory/${path}`) as FilePath;
  }
  async readUtf8(path: FilePath, maxBytes: number): Promise<string> {
    this.readCalls.push({ path, maxBytes });
    this.readStarted.resolve(undefined);
    if (this.readGate) await this.readGate.promise;
    const source = this.files.get(path);
    if (source === undefined) throw new Error('not found');
    if (Buffer.byteLength(source) > maxBytes)
      throw new EditorError('RESOURCE_LIMIT', { field: 'bytes' });
    return source;
  }
  async replaceUtf8(path: FilePath, source: string): Promise<WriteOutcome> {
    this.writeCalls.push({ path, source });
    this.writeStarted.resolve(undefined);
    if (this.writeGate) await this.writeGate.promise;
    if (
      this.outcome === 'committed' ||
      (this.outcome === 'indeterminate' && this.physicalIndeterminate)
    )
      this.files.set(path, source);
    if (this.throwAfterWrite) throw new Error('replacement result lost');
    return this.outcome === 'committed'
      ? { status: 'committed' }
      : { status: this.outcome, error: { operation: 'write', path, stage: 'replace' } };
  }
}
