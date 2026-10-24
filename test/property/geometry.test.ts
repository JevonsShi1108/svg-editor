import fc from 'fast-check';
import { expect, it } from 'vitest';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { edit } from '../helpers/edit.js';
import { shapes, setFields } from '../fixtures/shapes.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';
const coordinateFields = [
  [['x'], ['y']],
  [['cx'], ['cy']],
  [['cx'], ['cy']],
  [
    ['x1', 'x2'],
    ['y1', 'y2'],
  ],
  [['x'], ['y']],
];
it('PROP-04 mixed Composite geometry equals independent leaf arithmetic once', () =>
  PropertyRunner.sync(
    'PROP-04',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 27 }),
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: 1, max: 5 }),
      (types, dx, dy, factor) => {
        const builder = new SvgDocumentBuilder(defaultLimits);
        const g = builder.append('g', 'g', { attributes: {} });
        const inner = builder.append('g', 'inner', { attributes: {} }, g.asContainer()!);
        const doc = builder.build();
        for (const [i, type] of types.entries())
          edit(doc, (tx) =>
            doc.create(
              tx,
              { ...shapes[type]!, id: `n${i}` } as ShapeCreation,
              inner.asContainer()!,
            ),
          );
        edit(doc, (tx) => g.move(tx, dx, dy));
        edit(doc, (tx) => g.scale(tx, factor));
        for (const [i, type] of types.entries()) {
          const input = shapes[type]! as unknown as Record<string, unknown>;
          const expected: Record<string, number> = {};
          for (const key of setFields[type]!.filter((k) => k !== 'text'))
            expected[key] = input[key] as number;
          for (const key of coordinateFields[type]![0]!) expected[key] = expected[key]! + dx;
          for (const key of coordinateFields[type]![1]!) expected[key] = expected[key]! + dy;
          for (const key of Object.keys(expected)) expected[key] = expected[key]! * factor;
          expect(
            Object.fromEntries(
              doc
                .require(`n${i}`)
                .describe()
                .attributes.map((a) => [a.name, a.value]),
            ),
          ).toEqual(expected);
        }
        InvariantOracle.check(doc);
      },
    ),
  ));
it('PROP-05 valid edit / actual illegal duplicate / exact reverse replay preserve independent invariants', () =>
  PropertyRunner.sync(
    'PROP-05',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 27 }),
      (types) => {
        const doc = new SvgDocumentBuilder(defaultLimits).build();
        for (const [i, type] of types.entries()) {
          const creation = { ...shapes[type]!, id: `n${i}` } as ShapeCreation;
          const changes = edit(doc, (tx) => doc.create(tx, creation));
          const before = doc.describe();
          expect(() => edit(doc, (tx) => doc.create(tx, creation))).toThrow();
          expect(doc.describe()).toEqual(before);
          InvariantOracle.check(doc);
          edit(doc, (tx) => changes.replay(tx, 'backward'));
          InvariantOracle.check(doc);
          edit(doc, (tx) => changes.replay(tx, 'forward'));
          InvariantOracle.check(doc);
        }
      },
    ),
  ));
it('PROP-12 old DTOs remain immutable across later edits', () =>
  PropertyRunner.sync(
    'PROP-12',
    fc.property(fc.integer({ min: -100, max: 100 }), (dx) => {
      const doc = new SvgDocumentBuilder(defaultLimits).build();
      edit(doc, (tx) => doc.create(tx, shapes[0]!));
      const before = doc.describe();
      const copy = structuredClone(before);
      expect(Reflect.set(before.children[0]!.shape, 'id', 'changed')).toBe(false);
      edit(doc, (tx) => doc.require('r').move(tx, dx, 1));
      expect(before).toEqual(copy);
      InvariantOracle.check(doc);
    }),
  ));
