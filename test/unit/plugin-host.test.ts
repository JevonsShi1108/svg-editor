import { expect, it } from 'vitest';
import { PluginHost } from '../../src/host/loader/PluginHost.js';
import { builtinShapes } from '../../src/domain/shapes/builtin-shapes.js';
import type { PluginContext, Command } from '../../src/public.js';

it('compares category/name sets, closes the staging context and rolls back every category together', async () => {
  const host = new PluginHost('/cwd', [], ['help']);
  let escaped: PluginContext | undefined;
  const query: Command = {
    help: { name: 'answer', syntax: 'answer', description: 'answer' },
    arity: [0, 0],
    requiresDocument: false,
    run: () => ['42'],
  };
  const activate = (c: PluginContext) => {
    escaped = c;
    c.registerShape(builtinShapes[0]!);
    c.registerCommand(query);
    c.registerAttribute({ name: 'change', handles: () => false, apply: () => {} });
    c.registerDecorator({ name: 'mark', prepare: () => () => undefined });
  };
  expect(
    await host.activate({ activate }, { name: 'bad', contributes: { commands: ['answer'] } }),
  ).toMatch(/^plugin manifest mismatch:/);
  expect(host.registrations).toEqual({ commands: [], shapes: [], attributes: [], decorators: [] });
  expect(() => escaped!.registerCommand(query)).toThrow('registration closed');
  const manifest = {
    name: 'good',
    contributes: {
      commands: ['answer'],
      attributes: ['change'],
      shapes: ['circle'],
      decorators: ['mark'],
    },
  };
  expect(await host.activate({ activate }, manifest)).toBeUndefined();
  const before = host.registrations;
  expect(
    await host.activate(
      {
        activate: (c) => {
          c.registerDecorator({ name: 'new', prepare: () => () => '' });
          c.registerShape(builtinShapes[0]!);
        },
      },
      { name: 'duplicate' },
    ),
  ).toBe('duplicate registration: shapes/circle');
  expect(host.registrations).toEqual(before);
  expect(
    await host.activate(
      { activate: (c) => c.registerCommand({ ...query, help: { ...query.help, name: 'help' } }) },
      { name: 'override' },
    ),
  ).toBe('duplicate registration: commands/help');
});

it('checks outstanding async activations against plugins published since staging', async () => {
  const host = new PluginHost('/cwd', [], []);
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const mark = { name: 'mark', prepare: () => () => '*' };
  const first = host.activate(
    {
      async activate(c) {
        c.registerDecorator(mark);
        await pending;
      },
    },
    { name: 'slow', contributes: { decorators: ['mark'] } },
  );
  const fast = await host.activate(
    { activate: (c) => c.registerDecorator(mark) },
    { name: 'fast', contributes: { decorators: ['mark'] } },
  );
  expect(fast).toBeUndefined();
  finish();
  expect(await first).toBe('duplicate registration: decorators/mark');
  expect(host.registrations.decorators).toHaveLength(1);
});
