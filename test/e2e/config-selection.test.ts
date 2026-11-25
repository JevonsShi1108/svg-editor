import { expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { runCli } from '../helpers/run-cli.js';

it('supports each command on its own and lists the starting directory across outside reads and saves', async () => {
  const temp = await TempDirectory.create();
  try {
    const config = path.join(temp.path, 'plugins.json');
    const configure = (...dirs: string[]) =>
      writeFile(
        config,
        JSON.stringify({ plugins: dirs.map((d) => ({ module: path.resolve('plugins', d) })) }),
      );
    const svg = path.join(temp.path, 'outside.svg');
    await writeFile(svg, await readFile('test/fixtures/svg/other.svg'));
    for (const name of ['first', 'second']) {
      const cwd = path.join(temp.path, name);
      await mkdir(cwd);
      await writeFile(path.join(cwd, 'same.txt'), '');
      await mkdir(path.join(cwd, name));
      await configure('dir');
      const result = await runCli(
        cwd,
        'dir\nstats\nread ../outside.svg\nsave ../result.svg\ndir\n',
        ['--config', config],
      );
      const lines = '[DIR]  ' + name + '\n[FILE]  same.txt\n';
      expect(result.stdout.startsWith(lines)).toBe(true);
      expect(result.stdout.endsWith(lines)).toBe(true);
      expect(result.stderr).toContain('error: unknown command: stats\n');
      expect(result.code).toBe(0);
    }
    await configure('stats');
    const s = await runCli(temp.path, 'init\nhelp\ndir\nstats\n', ['--config', config]);
    expect(s.stderr).toBe('error: unknown command: dir\n');
    expect(s.stdout).toMatch(/stats — Count leaves and containers\n\(total 0, containers 0\)\n$/);
    await configure('shape-box', 'tree-star', 'box-label');
    const reversed = await runCli(temp.path, 'init\ncreate box n 0 0 2 2 t\ntree n\n', [
      '--config',
      config,
    ]);
    expect(reversed.stderr).toBe('');
    expect(reversed.stdout).toContain('g#n * (box)\n');
  } finally {
    await temp.close();
  }
});
