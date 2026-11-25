import { EditorError, type Command } from '@svgframe/api';
import type { DirectoryReader } from './DirectoryReader.js';

export class DirCommand implements Command {
  readonly help = { name: 'dir', syntax: 'dir', description: 'List the working directory' };
  readonly requiresDocument = false;
  readonly arity = [0, 0] as const;
  constructor(
    private readonly reader: DirectoryReader,
    private readonly cwd: string,
  ) {}
  async run() {
    try {
      const entries = await this.reader.list(this.cwd);
      const lines: string[] = [];
      for (const [kind, marker] of [
        ['directory', '[DIR]'],
        ['file', '[FILE]'],
      ] as const) {
        const names = entries
          .filter((e) => e.kind === kind && e.name !== '.' && e.name !== '..')
          .map((e) => e.name)
          .sort();
        for (const name of names) lines.push(marker + '  ' + name);
      }
      return lines.length ? lines : ['(empty directory)'];
    } catch {
      throw new EditorError('PLUGIN_ERROR', { message: 'cannot read directory: ' + this.cwd });
    }
  }
}
