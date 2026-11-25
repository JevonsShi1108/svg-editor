import { expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { runCli } from '../helpers/run-cli.js';

it('loads relative packages and import-only exports, isolates failed batches and continues in order', async () => {
  const tmp = await TempDirectory.create();
  try {
    const configDir = path.join(tmp.path, 'configuration with spaces');
    const create = async (dir: string, name: string, commands: string[], source: string) => {
      const base = path.join(configDir, dir);
      await fs.mkdir(path.join(base, 'dist'), { recursive: true });
      await fs.writeFile(
        path.join(base, 'package.json'),
        JSON.stringify({
          name,
          type: 'module',
          main: 'dist/index.js',
          exports: { import: './dist/index.js' },
          contributes: { commands },
        }),
      );
      await fs.writeFile(path.join(base, 'dist/index.js'), source);
    };
    const plugin = (body: string) =>
      `export default {activate(c,o){ const add = name=> c.registerCommand({help:{name,syntax:name,description:name},arity:[0,0],requiresDocument:false,run(){return [o.message ?? name]}}); ${body} }}`;
    await create('good', 'good', ['first'], plugin("add('first')"));
    await create('none', 'none', [], 'export const x=1;');
    await create('wrong', 'wrong', ['other'], plugin("add('leaked')"));
    await create('throws', 'throws', [], plugin("add('temporary'); throw Error('midway')"));
    await create('duplicate', 'duplicate', ['late', 'first'], plugin("add('late');add('first')"));
    await create('missing-dep', 'missing-dep', [], "import './absent.js';");
    await create('node_modules/@fixture/last', '@fixture/last', ['last'], plugin("add('last')"));
    const config = path.join(configDir, 'config.json');
    await fs.writeFile(
      config,
      JSON.stringify({
        plugins: [
          { module: './good', options: { message: 'configured' } },
          { module: './disabled', enabled: false },
          ...[
            './missing',
            './none',
            './wrong',
            './throws',
            './duplicate',
            './missing-dep',
            '@fixture/last',
          ].map((module) => ({ module })),
        ],
      }),
    );
    const result = await runCli(tmp.path, 'first\nlast\nleaked\ntemporary\nlate\nhelp\n', [
      '--config',
      config,
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^configured\nlast\n/);
    expect(result.stdout).toMatch(/first — first\nlast — last\n$/);
    const errors = result.stderr.trimEnd().split('\n');
    expect(errors.slice(0, 5)).toEqual([
      'error: plugin not found: ./missing',
      'error: plugin has no default export: ./none',
      'error: plugin manifest mismatch: wrong (declared: commands/other, registered: commands/leaked)',
      'error: plugin failed to activate: throws (midway)',
      'error: duplicate registration: commands/first',
    ]);
    expect(errors[5]).toMatch(/^error: plugin failed to activate: missing-dep \(.*absent.js/);
    expect(errors.slice(6)).toEqual(
      ['leaked', 'temporary', 'late'].map((n) => 'error: unknown command: ' + n),
    );
    for (const text of [
      '{',
      '{"plugins":[{"module":"./good"},{"module":42}]}',
      '{"plugins":[{"module":"./good","enabled":"yes"}]}',
    ]) {
      await fs.writeFile(config, text);
      const invalid = await runCli(tmp.path, 'first\ninit\n', ['--config', config]);
      expect(invalid).toEqual({
        code: 0,
        stdout: 'canvas 800x600 created\n',
        stderr: 'error: invalid plugin config\nerror: unknown command: first\n',
      });
    }
  } finally {
    await tmp.close();
  }
});
