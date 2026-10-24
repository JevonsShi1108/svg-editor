import type {
  FileSystemPort,
  FileHandlePort,
  FileStat,
} from '../../src/infrastructure/files/file-system-port.js';
import { NodeFileSystem } from '../../src/infrastructure/files/NodeFileSystem.js';
import { Deferred } from './Deferred.js';
export class FaultFileSystem implements FileSystemPort {
  readonly real = new NodeFileSystem();
  readonly events: string[] = [];
  failCreate = false;
  failWrite = false;
  failClose = false;
  failUnlink = false;
  renameError: string | null = null;
  renameActuallyMoves = false;
  readonly writeStarted = new Deferred<void>();
  readonly closeStarted = new Deferred<void>();
  writeGate: Deferred<void> | null = null;
  closeGate: Deferred<void> | null = null;
  async lstat(file: string): Promise<FileStat> {
    this.events.push('lstat');
    const stat = await this.real.lstat(file);
    const observed: FileStat & { readonly size: number } = {
      isFile: () => stat.isFile(),
      isSymbolicLink: () => stat.isSymbolicLink(),
      get size(): number {
        throw new Error('stat size must not control byte admission');
      },
    };
    return observed;
  }
  async open(file: string, flags: 'r' | 'wx'): Promise<FileHandlePort> {
    this.events.push(`open:${flags}:${file}`);
    if (flags === 'wx' && this.failCreate)
      throw Object.assign(new Error('create blocked'), { code: 'EACCES' });
    const handle = await this.real.open(file, flags);
    return {
      read: (...args) => handle.read(...args),
      writeFile: async (source, encoding) => {
        this.events.push('write:start');
        this.writeStarted.resolve(undefined);
        if (this.writeGate) await this.writeGate.promise;
        if (this.failWrite) {
          await handle.writeFile(source.slice(0, 2), encoding);
          throw new Error('partial write');
        }
        await handle.writeFile(source, encoding);
        this.events.push('write:done');
      },
      close: async () => {
        this.events.push('close:start');
        this.closeStarted.resolve(undefined);
        if (this.closeGate) await this.closeGate.promise;
        await handle.close();
        this.events.push('close:done');
        if (this.failClose) throw new Error('close result lost');
      },
    };
  }
  async rename(from: string, to: string): Promise<void> {
    this.events.push('rename');
    if (this.renameActuallyMoves || !this.renameError) await this.real.rename(from, to);
    if (this.renameError)
      throw Object.assign(new Error('rename failure'), { code: this.renameError });
  }
  async unlink(file: string): Promise<void> {
    this.events.push(`unlink:${file}`);
    if (this.failUnlink) throw new Error('cleanup failed');
    return this.real.unlink(file);
  }
}
