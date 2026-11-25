import { readdir } from 'node:fs/promises';
import type { DirectoryReader, DirectoryEntry } from './DirectoryReader.js';

export class NodeDirectoryReader implements DirectoryReader {
  async list(path: string): Promise<readonly DirectoryEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    }));
  }
}
