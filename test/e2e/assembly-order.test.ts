import { expect, it } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mainPath } from '../helpers/run-cli.js';

it('keeps registration order and box feedback equal across both demo assemblies', () => {
  const execute = (args: string[]) =>
    spawnSync(process.execPath, [mainPath, ...args], {
      input: 'help\ninit\ncreate box n 1 2 30 20 "标题"\nset n label 新\nundo\ntree\n',
    });
  const a = execute(['--preset', 'demo']),
    b = execute(['--config', path.resolve('plugins.config.json')]);
  expect(a.status).toBe(0);
  expect(b.status).toBe(0);
  expect(a.stderr.length + b.stderr.length).toBe(0);
  expect(a.stdout.toString()).toMatch(/box#n label restored: "标题"/);
  expect(a.stdout.equals(b.stdout)).toBe(true);
});
