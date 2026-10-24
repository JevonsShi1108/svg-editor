export interface FileStat {
  isFile(): boolean;
  isSymbolicLink(): boolean;
}
export interface FileHandlePort {
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null,
  ): Promise<{ bytesRead: number }>;
  writeFile(source: string, encoding: 'utf8'): Promise<void>;
  close(): Promise<void>;
}
export interface FileSystemPort {
  lstat(path: string): Promise<FileStat>;
  open(path: string, flags: 'r' | 'wx'): Promise<FileHandlePort>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}
