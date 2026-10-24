import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { mainPath } from '../helpers/run-cli.js';
it('CLI-14/IO-08 actual stdout pipe failure after successful save preserves committed file and stops subsequent commands', async () => {
  const temp = await TempDirectory.create();
  const child = spawn(process.execPath, [mainPath], {
    cwd: temp.path,
    shell: false,
    stdio: 'pipe',
  });
  const closed = once(child, 'close');
  const timer = setTimeout(() => child.kill(), 15000);
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (s) => {
    stderr += s;
  });
  child.stdin.on('error', () => {
    /* process may close input after fatal output */
  });
  try {
    await new Promise<void>((resolve, reject) => {
      let received = '';
      child.stdout.setEncoding('utf8').on('data', (s) => {
        received += s;
        if (received.includes('rect#r created')) resolve();
      });
      child.once('error', reject);
      child.once('exit', () => reject(new Error('CLI exited before handshake')));
      child.stdin.write('init\ncreate rect r 1 2 3 4\n');
    });
    child.stdout.destroy();
    await once(child.stdout, 'close');
    child.stdin.end('save committed.svg\ncreate g late\nsave late.svg\n');
    const [code] = await closed;
    expect(code).toBe(1);
    expect(stderr).toBe('error: terminal failure\n');
    expect(await fs.readFile(path.join(temp.path, 'committed.svg'), 'utf8')).toContain('id="r"');
    expect(await fs.readdir(temp.path)).toEqual(['committed.svg']);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill();
    await closed;
    await temp.close();
  }
});
