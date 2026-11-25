import { expect, it } from 'vitest';
import { BuiltinCommands } from '../../src/application/commands/BuiltinCommands.js';
import { CommandRegistry } from '../../src/application/commands/CommandRegistry.js';
import { ShapeFactory } from '../../src/domain/shapes/ShapeFactory.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';

it('builds a restricted registry in supplied order and rejects duplicate bindings', () => {
  const builtins = new BuiltinCommands(defaultLimits, new ShapeFactory()).definitions;
  const [read, save] = builtins;
  const catalog = new CommandRegistry(defaultLimits, [save!, read!]);
  expect(catalog.describe().map((h) => h.name)).toEqual(['save', 'read']);
  expect(() => catalog.bind({ command: 'init' })).toThrow('UNKNOWN_COMMAND');
  expect(() => new CommandRegistry(defaultLimits, [save!, save!])).toThrow(
    'DUPLICATE_REGISTRATION',
  );
});
