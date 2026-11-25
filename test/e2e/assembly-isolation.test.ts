import { expect, it } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

it('starts base and config profiles even if evaluating the separate code assembly would fail', async () => {
  const tmp = await mkdtemp(path.resolve('artifacts/assembly-isolation-'));
  try {
    const dist = path.join(tmp, 'dist');
    await cp(path.resolve('dist'), dist, { recursive: true });
    await writeFile(
      path.join(dist, 'host/code-profile.js'),
      "throw Error('unexpected code preset evaluation');",
    );
    await writeFile(path.join(tmp, 'empty.json'), '{"plugins":[]}');
    for (const args of [[], ['--config', 'empty.json']]) {
      const result = spawnSync(process.execPath, [path.join(dist, 'main.js'), ...args], {
        cwd: tmp,
        input: 'init\ntree\n',
        encoding: 'utf8',
      });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('canvas 800x600 created\nsvg (800x600)\n');
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
