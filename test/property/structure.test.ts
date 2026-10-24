import fc from 'fast-check';
import { it, expect } from 'vitest';
import { buildTree, ids } from '../fixtures/tree.js';
import { edit } from '../helpers/edit.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
it('PROP-06 grouping uses numeric original sibling order, preserves own states and exact reverse tree', () =>
  PropertyRunner.sync(
    'PROP-06',
    fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: 15 }), { minLength: 2, maxLength: 12 }),
      (selection) => {
        const all = Array.from({ length: 16 }, (_, i) => `n${i}`);
        const doc = buildTree(all);
        const before = doc.describe();
        const states = all.map((id) => doc.require(id).captureState());
        const changes = edit(doc, (tx) =>
          doc.group(
            tx,
            doc.planGroup(
              'G',
              selection.map((i) => doc.require(`n${i}`)),
            ),
          ),
        );
        const selected = [...selection].sort((a, b) => a - b);
        const selectedSet = new Set(selected);
        const last = selected[selected.length - 1]!;
        const expected = all.filter((_, i) => !selectedSet.has(i));
        expected.splice(last + 1 - selected.filter((i) => i <= last).length, 0, 'G');
        expect(ids(doc.root)).toEqual(expected);
        expect(ids(doc.requireContainer('G'))).toEqual(selected.map((i) => `n${i}`));
        for (const [i, id] of all.entries()) expect(doc.require(id).captureState()).toBe(states[i]);
        InvariantOracle.check(doc);
        edit(doc, (tx) => changes.replay(tx, 'backward'));
        expect(doc.describe()).toEqual(before);
        InvariantOracle.check(doc);
      },
    ),
  ));
it('PROP-14 repeated front/back/addTo are idempotent content operations', () =>
  PropertyRunner.sync(
    'PROP-14',
    fc.property(fc.integer({ min: 0, max: 7 }), (index) => {
      const doc = buildTree([...Array.from({ length: 8 }, (_, i) => `n${i}`), ['G']]);
      const node = doc.require(`n${index}`);
      for (const operation of [
        (tx: Parameters<Parameters<typeof edit>[1]>[0]) => doc.bringToFront(tx, node),
        (tx: Parameters<Parameters<typeof edit>[1]>[0]) => doc.sendToBack(tx, node),
        (tx: Parameters<Parameters<typeof edit>[1]>[0]) =>
          doc.addTo(tx, node, doc.requireContainer('G')),
      ]) {
        edit(doc, operation);
        const before = doc.describe();
        expect(edit(doc, operation).isEmpty).toBe(true);
        expect(doc.describe()).toEqual(before);
        InvariantOracle.check(doc);
      }
    }),
  ));
it('PROP-15 final active quotas hold and actual over-limit creation never clips or consumes IDs', () =>
  PropertyRunner.sync(
    'PROP-15',
    fc.property(fc.integer({ min: 2, max: 20 }), (limit) => {
      const doc = buildTree([], { ...defaultLimits, maxNodeCount: limit });
      for (let i = 0; i < limit; i++) edit(doc, (tx) => doc.create(tx, { type: 'g', id: `n${i}` }));
      const before = doc.describe();
      expect(() => edit(doc, (tx) => doc.create(tx, { type: 'g', id: 'tooMany' }))).toThrow();
      expect(doc.describe()).toEqual(before);
      expect(doc.find('tooMany')).toBeUndefined();
      edit(doc, (tx) => doc.require('n0').delete(tx));
      edit(doc, (tx) => doc.create(tx, { type: 'g', id: 'tooMany' }));
      expect(doc.nodeCount).toBe(limit);
      InvariantOracle.check(doc);
    }),
  ));
