import { expect, it } from 'vitest';
import type {
  AttributeEdit,
  AttributeHandler,
} from '../../src/application/contracts/AttributeHandler.js';
import { AttributeDispatch } from '../../src/application/commands/AttributeDispatch.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TestPorts } from '../helpers/TestPorts.js';
import { committed, semantic } from '../helpers/session.js';

async function fixture(handlers: AttributeHandler[]) {
  const ports = new TestPorts();
  const commands = new CommandCatalog(
    defaultLimits,
    undefined,
    [],
    new AttributeDispatch(handlers),
  );
  const session = new EditorSession({
    commands,
    files: ports,
    codec: ports,
    limits: defaultLimits,
  });
  const parser = new CliParser(commands);
  const run = (line: string) => session.execute(parser.parse(line)!);
  for (const line of [
    'init',
    'create g pair',
    'create rect a 0 0 2 3 in pair',
    'create rect b 0 0 1 2 in pair',
    'move a 3 0',
    'undo',
  ])
    committed(await run(line));
  return { session, run, parser };
}
it('rolls back a second-part failure with a live redo branch and revokes the edit facade', async () => {
  let escaped: AttributeEdit | undefined;
  const handler: AttributeHandler = {
    name: 'pair',
    handles: (shape, attr) => shape.id === 'pair' && attr === 'paint',
    apply(_target, _attr, value, edit) {
      escaped = edit;
      edit.set('a', 'fill', value);
      edit.set('b', 'fill', value === 'red' ? 'invalid-color' : value);
    },
  };
  const { run, session, parser } = await fixture([handler]);
  const before = await semantic(session);
  const status = (await run('tree')).status;
  expect(await run('set pair paint red')).toMatchObject({ ok: false, status });
  expect(await semantic(session)).toEqual(before);
  expect(() => escaped!.set('a', 'fill', 'blue')).toThrow('ATTRIBUTE_EDIT_CLOSED');
  committed(await run('redo'));
  committed(await run('undo'));
  const request = parser.parse('set pair paint blue')!;
  expect(await session.execute(request, { mode: 'dry-run' })).toMatchObject({
    ok: true,
    mode: 'dry-run',
    wouldChange: true,
  });
  expect(await semantic(session)).toEqual(before);
  committed(await session.execute(request));
  const after = await semantic(session);
  for (const child of after.children[0]!.children)
    expect(child.shape.attributes).toContainEqual({ name: 'fill', value: 'blue' });
  committed(await run('undo'));
  expect(await semantic(session)).toEqual(before);
  committed(await run('redo'));
  expect(await semantic(session)).toEqual(after);
});
it('rejects multiple matches before applying either, while unmatched attributes retain the original rules', async () => {
  let calls = 0;
  const h: AttributeHandler = {
    name: 'first',
    handles: (_s, a) => a === 'label',
    apply: () => {
      calls++;
    },
  };
  const { run } = await fixture([h, { ...h, name: 'second' }]);
  expect(await run('set a label x')).toMatchObject({
    ok: false,
    error: { code: 'ATTRIBUTE_CONFLICT', parameters: { handlers: 'first, second' } },
  });
  expect(calls).toBe(0);
  committed(await run('set a fill red'));
  expect(await run('set a missing x')).toMatchObject({
    ok: false,
    error: { code: 'UNKNOWN_ATTRIBUTE' },
  });
});
