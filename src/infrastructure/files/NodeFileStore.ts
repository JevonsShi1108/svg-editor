import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import type {
  FileStore,
  FilePath,
  WriteOutcome,
  FileFailure,
} from '../../application/ports/FileStore.js';
import { EditorError } from '../../application/errors/EditorError.js';
import { FileError } from '../../application/ports/FileError.js';
import { XmlCharacters } from '../../domain/values/XmlCharacters.js';
import { NodeFileSystem } from './NodeFileSystem.js';
import type { FileSystemPort, FileHandlePort } from './file-system-port.js';
export class NodeFileStore implements FileStore {
  readonly #cwd: string;
  readonly #fs: FileSystemPort;
  readonly #token: () => string;
  static readonly collisionAttempts = 8;
  static readonly readChunkBytes = 64 * 1024;
  constructor(
    cwd: string,
    filesystem: FileSystemPort = new NodeFileSystem(),
    token: () => string = randomUUID,
  ) {
    if (!path.isAbsolute(cwd)) throw new EditorError('INVALID_PATH');
    this.#cwd = path.resolve(cwd);
    this.#fs = filesystem;
    this.#token = token;
  }
  resolve(value: string): FilePath {
    if (typeof value !== 'string' || !value || value.includes('\0'))
      throw new EditorError('INVALID_PATH');
    return path.resolve(this.#cwd, value) as FilePath;
  }
  async readUtf8(file: FilePath, maxBytes: number): Promise<string> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new EditorError('INVALID_VALUE');
    let handle: FileHandlePort | undefined;
    let failure: unknown;
    let stage = 'validate';
    let failureStage = 'validate';
    let source = '';
    try {
      await this.regular(file, false);
      stage = 'open';
      handle = await this.#fs.open(file, 'r');
      const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
      const pieces: string[] = [];
      const buffer = Buffer.alloc(NodeFileStore.readChunkBytes);
      let total = 0;
      while (true) {
        stage = 'read';
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        total += bytesRead;
        if (total > maxBytes) throw new EditorError('RESOURCE_LIMIT', { field: 'bytes' });
        stage = 'decode';
        pieces.push(decoder.decode(buffer.subarray(0, bytesRead), { stream: true }));
      }
      stage = 'decode';
      pieces.push(decoder.decode());
      source = pieces.join('');
    } catch (error) {
      failure = error;
      failureStage = stage;
    }
    if (handle)
      try {
        await handle.close();
      } catch (error) {
        if (failure === undefined) {
          failure = error;
          failureStage = 'close';
        }
      }
    if (failure) {
      if (failure instanceof EditorError && failure.diagnostic.code === 'RESOURCE_LIMIT')
        throw failure;
      throw new FileError({ operation: 'read', path: file, stage: failureStage, cause: failure });
    }
    return source;
  }
  async replaceUtf8(file: FilePath, source: string): Promise<WriteOutcome> {
    let stage = 'validate';
    let temporary: string | undefined;
    let owned = false;
    let handle: FileHandlePort | undefined;
    let primary: unknown;
    const committed: WriteOutcome = Object.freeze({ status: 'committed' });
    try {
      XmlCharacters.validate(source);
      await this.regular(file, true);
      stage = 'create';
      for (let attempt = 0; attempt < NodeFileStore.collisionAttempts; attempt++) {
        const token = this.#token();
        if (!/^[A-Za-z0-9-]+$/.test(token)) throw new EditorError('INVALID_TEMP_TOKEN');
        temporary = path.join(
          path.dirname(file),
          `.${path.basename(file)}.svg-editor-${token}.tmp`,
        );
        try {
          handle = await this.#fs.open(temporary, 'wx');
          owned = true;
          break;
        } catch (error) {
          if (this.code(error) !== 'EEXIST' || attempt === NodeFileStore.collisionAttempts - 1)
            throw error;
        }
      }
      if (!handle) throw new Error('No temporary handle');
      stage = 'write';
      await handle.writeFile(source, 'utf8');
      stage = 'close';
      await handle.close();
      handle = undefined;
      stage = 'replace';
      await this.#fs.rename(temporary!, file);
      owned = false;
      return committed;
    } catch (error) {
      primary = error;
    }
    let cleanupError: unknown;
    if (handle)
      try {
        await handle.close();
      } catch (error) {
        cleanupError = error;
      }
    if (owned && temporary)
      try {
        await this.#fs.unlink(temporary);
      } catch (error) {
        if (this.code(error) !== 'ENOENT') cleanupError ??= error;
      }
    const knownNoCommit = [
      'EACCES',
      'EPERM',
      'ENOENT',
      'EEXIST',
      'ENOTDIR',
      'EISDIR',
      'ENOTEMPTY',
      'EINVAL',
      'ENAMETOOLONG',
      'ELOOP',
    ];
    const status =
      stage !== 'replace' || knownNoCommit.includes(this.code(primary) ?? '')
        ? 'not-committed'
        : 'indeterminate';
    const error: FileFailure = Object.freeze({
      operation: 'write',
      path: file,
      stage,
      cause: primary,
      ...(cleanupError === undefined ? {} : { cleanupError, temporaryPath: temporary! }),
    });
    return Object.freeze({ status, error });
  }
  private async regular(file: string, allowMissing: boolean): Promise<void> {
    try {
      const stat = await this.#fs.lstat(file);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new EditorError('INVALID_FILE_TYPE');
    } catch (error) {
      if (allowMissing && this.code(error) === 'ENOENT') return;
      throw error;
    }
  }
  private code(error: unknown): string | undefined {
    return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
