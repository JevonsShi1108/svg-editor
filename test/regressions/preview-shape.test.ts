import { it, expect, vi } from 'vitest';
import { sessionFixture, committed, semantic } from '../helpers/session.js';
import { shapes } from '../fixtures/shapes.js';
import type { ShapeDescription } from '../../src/domain/values/contracts.js';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { edit } from '../helpers/edit.js';
import { buildTree, ids } from '../fixtures/tree.js';
it.each(shapes)(
  'REG-PREVIEW-SHAPE-01 CRT-09 dry create $type keeps an immutable complete shape summary after rollback',
  async (shape) => {
    const { session } = sessionFixture();
    const initialized = committed(await session.execute({ command: 'init' }));
    const request = { command: 'create' as const, shape },
      dry = await session.execute(request, { mode: 'dry-run' });
    expect(dry.ok && dry.mode === 'dry-run').toBe(true);
    if (!dry.ok || dry.mode !== 'dry-run') throw new Error('Expected dry-run');
    expect(dry.status).toEqual(initialized.status);
    expect((await semantic(session)).children).toEqual([]);
    expect(dry.preview[0]).toHaveProperty('shape');
    const summary = (dry.preview[0] as unknown as { shape: ShapeDescription }).shape;
    expect(summary.type).toBe(shape.type);
    expect(summary.id).toBe(shape.id);
    for (const [key, value] of Object.entries(shape).filter(
      ([key]) => !['type', 'id'].includes(key),
    ))
      if (key === 'text') expect(summary.text).toBe(value);
      else expect(summary.attributes).toContainEqual({ name: key, value });
    const held = structuredClone(summary);
    expect(Reflect.set(summary, 'id', 'bad')).toBe(false);
    const created = committed(await session.execute(request));
    if (created.data.kind !== 'edit') throw new Error('Expected edit');
    expect(created.data.facts.shapes[0]).toEqual(summary);
    committed(
      await session.execute({ command: 'set', id: shape.id, attribute: 'fill', value: 'red' }),
    );
    expect(summary).toEqual(held);
  },
);
it('REG-PREVIEW-SHAPE-01 historical placement description interprets captured own state rather than future live state', () => {
  const doc = new SvgDocumentBuilder(defaultLimits).build();
  const created = edit(doc, (tx) =>
    doc.create(tx, { type: 'rect', id: 'r', x: 10, y: 20, width: 30, height: 40 }),
  );
  const before = created.describe('forward');
  expect(before[0]).toHaveProperty('shape');
  edit(doc, (tx) => doc.require('r').set(tx, 'x', 999));
  expect(created.describe('forward')).toEqual(before);
  expect((before[0] as unknown as { shape: ShapeDescription }).shape.attributes).toContainEqual({
    name: 'x',
    value: 10,
  });
});
it('REG-PREVIEW-SHAPE-01 failed middle placement-summary preparation compensates preceding placements', () => {
  const doc = buildTree(['a', 'b']),
    before = doc.describe();
  const snapshot = vi.spyOn(doc.require('b'), 'describe').mockImplementationOnce(() => {
    throw new Error('summary allocation failure');
  });
  expect(() =>
    edit(doc, (tx) => doc.group(tx, doc.planGroup('G', [doc.require('a'), doc.require('b')]))),
  ).toThrow('summary allocation failure');
  snapshot.mockRestore();
  expect(doc.describe()).toEqual(before);
  expect(ids(doc.root)).toEqual(['a', 'b']);
  expect(doc.find('G')).toBeUndefined();
  edit(doc, (tx) => doc.group(tx, doc.planGroup('G', [doc.require('a'), doc.require('b')])));
  expect(ids(doc.requireContainer('G'))).toEqual(['a', 'b']);
});
