import { expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DirCommand } from '../../plugins/dir/src/DirCommand.js';
import { NodeDirectoryReader } from '../../plugins/dir/src/NodeDirectoryReader.js';
import type { DirectoryEntry } from '../../plugins/dir/src/DirectoryReader.js';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { TestPorts } from '../helpers/TestPorts.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { PluginCommandBinding } from '../../src/application/commands/PluginCommandBinding.js';
import { ShapeFactory } from '../../src/domain/shapes/ShapeFactory.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { semantic } from '../helpers/session.js';

it('uses injected names, skips special entries and orders hidden/direct names deterministically', async () => {
  const entries: DirectoryEntry[] = [
    { name: 'b', kind: 'file' },
    { name: '.dot', kind: 'file' },
    { name: 'docs', kind: 'directory' },
    { name: '.', kind: 'directory' },
    { name: '..', kind: 'directory' },
    { name: '.a', kind: 'directory' },
    { name: 'link', kind: 'other' },
  ];
  const cmd = new DirCommand(
    {
      list: async (cwd) => {
        expect(cwd).toBe('/starting');
        return entries;
      },
    },
    '/starting',
  );
  const expected = ['[DIR]  .a', '[DIR]  docs', '[FILE]  .dot', '[FILE]  b'];
  expect(await cmd.run()).toEqual(expected);
  entries.reverse();
  expect(await cmd.run()).toEqual(expected);
  entries.length = 0;
  expect(await cmd.run()).toEqual(['(empty directory)']);
});
it('adapts real Dirents without recursing or following links, and maps a real read failure', async () => {
  const tmp = await TempDirectory.create();
  try {
    await fs.mkdir(path.join(tmp.path, 'folder'));
    await fs.writeFile(path.join(tmp.path, 'folder', 'inside'), 'x');
    await fs.writeFile(path.join(tmp.path, '.hidden'), 'x');
    await fs.symlink(path.join(tmp.path, '.hidden'), path.join(tmp.path, 'link'), 'file');
    const adapter = new NodeDirectoryReader();
    expect(await new DirCommand(adapter, tmp.path).run()).toEqual([
      '[DIR]  folder',
      '[FILE]  .hidden',
    ]);
    const absent = path.join(tmp.path, 'absent');
    await expect(new DirCommand(adapter, absent).run()).rejects.toMatchObject({
      diagnostic: { parameters: { message: 'cannot read directory: ' + absent } },
    });
  } finally {
    await tmp.close();
  }
});
it('executes before init and preserves document, redo and save barrier after success or failure', async () => {
  let fail = false;
  const cmd = new DirCommand(
    {
      list: async () => {
        if (fail) throw Error('failed');
        return [];
      },
    },
    '/cwd',
  );
  const shapes = new ShapeFactory(),
    ports = new TestPorts();
  const catalog = new CommandCatalog(defaultLimits, shapes, [
    new PluginCommandBinding(cmd, shapes),
  ]);
  const session = new EditorSession({
    commands: catalog,
    shapes,
    files: ports,
    codec: { encode: () => '<svg/>', decode: ports.decode.bind(ports) },
    limits: defaultLimits,
  });
  const parser = new CliParser(catalog),
    run = (line: string) => session.execute(parser.parse(line)!);
  expect(() => parser.parse('dir extra')).toThrow('SYNTAX_ERROR');
  expect((await run('dir')).ok).toBe(true);
  for (const line of ['init', 'create g keep', 'save elsewhere.svg'])
    expect((await run(line)).ok).toBe(true);
  const saved = (await run('dir')).status;
  expect(await run('undo')).toMatchObject({
    ok: false,
    status: saved,
    error: { code: 'HISTORY_BLOCKED' },
  });
  for (const line of ['create g later', 'undo']) expect((await run(line)).ok).toBe(true);
  const before = await semantic(session),
    status = (await run('tree')).status;
  expect(await run('dir')).toMatchObject({ ok: true, status });
  fail = true;
  const error = await run('dir');
  expect(error.status).toEqual(status);
  expect(new TextPresenter().render(error).stderr).toBe('error: cannot read directory: /cwd\n');
  expect(await semantic(session)).toEqual(before);
  expect((await run('redo')).ok).toBe(true);
});
