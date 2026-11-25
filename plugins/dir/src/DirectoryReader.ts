export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file' | 'other';
}
export interface DirectoryReader {
  list(path: string): Promise<readonly DirectoryEntry[]>;
}
