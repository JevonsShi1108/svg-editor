import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
export class TempDirectory {
  readonly path: string;
  private constructor(directory: string) {
    this.path = directory;
  }
  static async create(): Promise<TempDirectory> {
    return new TempDirectory(await mkdtemp(path.join(tmpdir(), 'svg-editor-')));
  }
  async close(): Promise<void> {
    const absolute = path.resolve(this.path);
    const base = path.resolve(tmpdir());
    if (path.dirname(absolute) !== base || !path.basename(absolute).startsWith('svg-editor-'))
      throw new Error('Refusing cleanup outside owned temp root');
    await rm(absolute, { recursive: true, force: true });
  }
}
