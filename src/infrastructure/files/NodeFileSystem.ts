import * as fs from 'node:fs/promises';
import type { FileSystemPort, FileStat, FileHandlePort } from './file-system-port.js';
export class NodeFileSystem implements FileSystemPort {
  lstat(path: string): Promise<FileStat> {
    return fs.lstat(path);
  }
  open(path: string, flags: 'r' | 'wx'): Promise<FileHandlePort> {
    return fs.open(path, flags);
  }
  rename(from: string, to: string): Promise<void> {
    return fs.rename(from, to);
  }
  unlink(path: string): Promise<void> {
    return fs.unlink(path);
  }
}
