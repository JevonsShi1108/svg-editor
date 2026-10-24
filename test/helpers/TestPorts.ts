import type { SvgCodec, DecodeResult } from '../../src/application/ports/SvgCodec.js';
import type { FileStore, FilePath, WriteOutcome } from '../../src/application/ports/FileStore.js';
import type { DocumentDescription, ResourceLimits } from '../../src/domain/values/contracts.js';
import { EditorError } from '../../src/application/errors/EditorError.js';
// Test-only dependencies for the M06 slice; never composed into a production entry point.
export class TestPorts implements SvgCodec, FileStore {
  readonly calls: string[] = [];
  readonly files = new Map<string, string>();
  decode(_source: string, _limits: ResourceLimits): DecodeResult {
    this.calls.push('decode');
    throw new Error('No codec in M06 test slice');
  }
  encode(_description: DocumentDescription): string {
    this.calls.push('encode');
    throw new Error('No codec in M06 test slice');
  }
  resolve(path: string): FilePath {
    this.calls.push('resolve');
    return `/test/${path}` as FilePath;
  }
  async readUtf8(path: FilePath, _maxBytes: number): Promise<string> {
    this.calls.push('read');
    const text = this.files.get(path);
    if (text === undefined) throw new EditorError('FILE_IO_ERROR', { operation: 'read', path });
    return text;
  }
  async replaceUtf8(path: FilePath, source: string): Promise<WriteOutcome> {
    this.calls.push('replace');
    this.files.set(path, source);
    return { status: 'committed' };
  }
}
