import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TempDirectory } from '../helpers/TempDirectory.js';
const main = fileURLToPath(new URL('../../dist/main.js', import.meta.url));
it('M11 E2E-05/06/07 compiled production CLI uses actual Codec and NodeFileStore, awaits EOF save', async () => {
  const temp = await TempDirectory.create();
  try {
    const output = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(process.execPath, [main], {
          cwd: temp.path,
          shell: false,
          stdio: 'pipe',
        });
        let stdout = '',
          stderr = '';
        child.stdout.setEncoding('utf8').on('data', (data) => {
          stdout += data;
        });
        child.stderr.setEncoding('utf8').on('data', (data) => {
          stderr += data;
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
        child.stdin.end(
          'init 400 300\ncreate rect r 10 20 30 40 red\nsave "actual 文件.svg"\nread "actual 文件.svg"\ntree\n',
        );
      },
    );
    expect(output.code).toBe(0);
    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('rect#r');
    expect(output.stdout).toContain('svg (400x300)');
    expect(output.stdout).not.toMatch(/(?:^|\n)svg> /);
    const source = await fs.readFile(path.join(temp.path, 'actual 文件.svg'), 'utf8');
    expect(source).toContain('id="r"');
    expect(source).toContain('viewBox="0 0 400 300"');
    expect((await fs.readdir(temp.path)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  } finally {
    await temp.close();
  }
});
