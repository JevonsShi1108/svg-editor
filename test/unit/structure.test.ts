import { describe, it, expect, vi } from 'vitest';
import { buildTree, ids, type TreeInput } from '../fixtures/tree.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { edit } from '../helpers/edit.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { accessDocument } from '../../src/domain/internal/storage.js';
import { EditLease } from '../../src/domain/transactions/EditLease.js';

const leafPreview = (id: string) => ({
  type: 'rect',
  id,
  attributes: [
    { name: 'x', value: 1 },
    { name: 'y', value: 2 },
    { name: 'width', value: 3 },
    { name: 'height', value: 4 },
  ],
  displayFields: [
    { label: 'x', value: 1 },
    { label: 'y', value: 2 },
    { label: 'width', value: 3 },
    { label: 'height', value: 4 },
  ],
});
const groupPreview = (id: string) => ({ type: 'g', id, attributes: [], displayFields: [] });
describe('STR-01—07 / REG-GROUP / TX-12 independent final-tree fixtures', () => {
  const cases: {
    id: string;
    tree: readonly TreeInput[];
    selection: string[];
    parent: string | null;
    expected: string[];
    remaining: Record<string, string[]>;
  }[] = [
    {
      id: 'STR-01',
      tree: ['A', 'B', 'C', 'D'],
      selection: ['D', 'B'],
      parent: null,
      expected: ['A', 'C', 'G'],
      remaining: {},
    },
    {
      id: 'STR-02',
      tree: ['A', ['P', 'B', 'C'], 'D', 'Z'],
      selection: ['D', 'B'],
      parent: null,
      expected: ['A', 'P', 'G', 'Z'],
      remaining: { P: ['C'] },
    },
    {
      id: 'STR-03',
      tree: [['P', 'a', 'b'], ['Q', 'c', 'd'], 'Z'],
      selection: ['c', 'b'],
      parent: null,
      expected: ['P', 'Q', 'G', 'Z'],
      remaining: { P: ['a'], Q: ['d'] },
    },
    {
      id: 'STR-04',
      tree: [['P', ['Q', 'a', 'b'], 'c', 'd'], 'Z'],
      selection: ['c', 'b'],
      parent: 'P',
      expected: ['Q', 'G', 'd'],
      remaining: { Q: ['a'] },
    },
  ];
  for (const c of cases)
    it(c.id, () => {
      const doc = buildTree(c.tree);
      const before = SemanticSnapshot.of(doc.describe());
      const own = c.selection.map((id) => doc.require(id).captureState());
      let group: ReturnType<typeof doc.group>;
      const changes = edit(doc, (tx) => {
        group = doc.group(
          tx,
          doc.planGroup(
            'G',
            c.selection.map((id) => doc.require(id)),
          ),
        );
      });
      expect(ids(c.parent ? doc.requireContainer(c.parent) : doc.root)).toEqual(c.expected);
      const ordered = c.id === 'STR-01' || c.id === 'STR-02' ? ['B', 'D'] : ['b', 'c'];
      expect(ids(group!.asContainer())).toEqual(ordered);
      for (const [parent, children] of Object.entries(c.remaining))
        expect(ids(doc.requireContainer(parent))).toEqual(children);
      for (const [i, id] of c.selection.entries())
        expect(doc.require(id).captureState()).toBe(own[i]);
      if (c.id === 'STR-02')
        expect(changes.describe('forward')).toEqual([
          {
            kind: 'placement',
            id: 'G',
            shape: groupPreview('G'),
            from: null,
            to: { parent: null, index: 3 },
          },
          {
            kind: 'placement',
            id: 'B',
            shape: leafPreview('B'),
            from: { parent: 'P', index: 0 },
            to: { parent: 'G', index: 0 },
          },
          {
            kind: 'placement',
            id: 'D',
            shape: leafPreview('D'),
            from: { parent: null, index: 2 },
            to: { parent: 'G', index: 1 },
          },
        ]);
      InvariantOracle.check(doc);
      edit(doc, (tx) => changes.replay(tx, 'backward'));
      expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
      InvariantOracle.check(doc);
      edit(doc, (tx) => changes.replay(tx, 'forward'));
      expect(doc.require('G')).toBe(group!);
      InvariantOracle.check(doc);
    });
  it('rejects duplicates, ancestor/descendant, absent targets and duplicate new ID without leftovers', () => {
    const doc = buildTree([['P', 'a', 'b'], 'z']);
    const before = doc.describe();
    for (const selection of [[], ['a'], ['a', 'a'], ['P', 'a'], ['a', 'P']])
      expect(() =>
        edit(doc, (tx) =>
          doc.group(
            tx,
            doc.planGroup(
              'G',
              selection.map((id) => doc.require(id)),
            ),
          ),
        ),
      ).toThrow();
    expect(() => doc.planGroup('P', [doc.require('a'), doc.require('z')])).toThrow();
    expect(() => doc.planGroup('G', [doc.require('missing'), doc.require('z')])).toThrow();
    expect(doc.describe()).toEqual(before);
    edit(doc, (tx) => doc.group(tx, doc.planGroup('G', [doc.require('z'), doc.require('P')])));
    expect(ids(doc.requireContainer('G'))).toEqual(['P', 'z']);
    InvariantOracle.check(doc);
  });
  it('plan cannot cross documents, writes or usage windows', () => {
    const doc = buildTree(['a', 'b']);
    const other = buildTree(['a', 'b']);
    const plan = doc.planGroup('G', [doc.require('a'), doc.require('b')]);
    expect(() => edit(other, (tx) => other.group(tx, plan))).toThrow();
    edit(doc, (tx) => doc.require('a').move(tx, 1, 0));
    expect(() => edit(doc, (tx) => doc.group(tx, plan))).toThrow();
    const current = doc.planGroup('G', [doc.require('a'), doc.require('b')]);
    edit(doc, (tx) => doc.group(tx, current));
    expect(() => edit(doc, (tx) => doc.group(tx, current))).toThrow();
    InvariantOracle.check(doc);
  });
  it('STR-07/LIM-02/06 group checks final count/depth before any insertion', () => {
    for (const doc of [
      buildTree(['a', 'b'], { ...defaultLimits, maxNodeCount: 2 }),
      buildTree(['a', 'b'], { ...defaultLimits, maxTreeDepth: 1 }),
    ]) {
      const before = doc.describe();
      expect(() =>
        edit(doc, (tx) => doc.group(tx, doc.planGroup('G', [doc.require('a'), doc.require('b')]))),
      ).toThrow();
      expect(doc.describe()).toEqual(before);
      expect(doc.find('G')).toBeUndefined();
      InvariantOracle.check(doc);
    }
  });
});
describe('STR-08—17 structural placements', () => {
  it('STR-14 reparent preserves explicit absence; inherited appearance may change', () => {
    const doc = buildTree([['red', 'a', 'explicit'], ['blue']]);
    edit(doc, (tx) => {
      doc.require('red').set(tx, 'fill', 'red');
      doc.require('blue').set(tx, 'fill', 'blue');
      doc.require('explicit').set(tx, 'fill', 'black');
    });
    const a = doc.require('a').captureState();
    const explicit = doc.require('explicit').captureState();
    edit(doc, (tx) => {
      doc.addTo(tx, doc.require('a'), doc.requireContainer('blue'));
      doc.addTo(tx, doc.require('explicit'), doc.requireContainer('blue'));
    });
    expect(doc.require('a').captureState()).toBe(a);
    expect(doc.require('explicit').captureState()).toBe(explicit);
    expect(
      doc
        .require('a')
        .describe()
        .attributes.some((x) => x.name === 'fill'),
    ).toBe(false);
    InvariantOracle.check(doc);
  });
  it('nested ungroup promotes in place; exact intermediate indices and original Group restored', () => {
    const doc = buildTree([['P', 'L', ['G', 'u', 'v'], 'R']]);
    const g = doc.require('G');
    const before = doc.describe();
    const changes = edit(doc, (tx) => doc.ungroup(tx, g));
    expect(ids(doc.requireContainer('P'))).toEqual(['L', 'u', 'v', 'R']);
    expect(doc.find('G')).toBeUndefined();
    expect(changes.describe('forward')).toEqual([
      {
        kind: 'placement',
        id: 'u',
        shape: leafPreview('u'),
        from: { parent: 'G', index: 0 },
        to: { parent: 'P', index: 1 },
      },
      {
        kind: 'placement',
        id: 'v',
        shape: leafPreview('v'),
        from: { parent: 'G', index: 0 },
        to: { parent: 'P', index: 2 },
      },
      {
        kind: 'placement',
        id: 'G',
        shape: groupPreview('G'),
        from: { parent: 'P', index: 3 },
        to: null,
      },
    ]);
    edit(doc, (tx) => changes.replay(tx, 'backward'));
    expect(doc.require('G')).toBe(g);
    expect(doc.describe()).toEqual(before);
    InvariantOracle.check(doc);
  });
  it('top-level even empty refuses; nested empty and single-child are real deletions', () => {
    const doc = buildTree([['top'], ['P', ['empty'], ['single', 'u']]]);
    expect(() => edit(doc, (tx) => doc.ungroup(tx, doc.require('top')))).toThrow();
    expect(() => edit(doc, (tx) => doc.ungroup(tx, doc.require('u')))).toThrow();
    const changes = edit(doc, (tx) => doc.ungroup(tx, doc.require('empty')));
    expect(changes.size).toBe(1);
    edit(doc, (tx) => doc.ungroup(tx, doc.require('single')));
    expect(ids(doc.requireContainer('P'))).toEqual(['u']);
    InvariantOracle.check(doc);
  });
  it('addTo same parent appends, boundary repeats no-op; front/back same-level order', () => {
    const doc = buildTree(['A', 'B', 'C', 'D', ['P', 'p']]);
    edit(doc, (tx) => doc.bringToFront(tx, doc.require('B')));
    expect(ids(doc.root)).toEqual(['A', 'C', 'D', 'P', 'B']);
    expect(edit(doc, (tx) => doc.bringToFront(tx, doc.require('B'))).isEmpty).toBe(true);
    edit(doc, (tx) => doc.sendToBack(tx, doc.require('B')));
    expect(ids(doc.root)).toEqual(['B', 'A', 'C', 'D', 'P']);
    expect(edit(doc, (tx) => doc.sendToBack(tx, doc.require('B'))).isEmpty).toBe(true);
    edit(doc, (tx) => doc.addTo(tx, doc.require('B'), doc.requireContainer('P')));
    expect(ids(doc.requireContainer('P'))).toEqual(['p', 'B']);
    expect(
      edit(doc, (tx) => doc.addTo(tx, doc.require('B'), doc.requireContainer('P'))).isEmpty,
    ).toBe(true);
    edit(doc, (tx) => doc.addTo(tx, doc.require('p'), doc.requireContainer('P')));
    expect(ids(doc.requireContainer('P'))).toEqual(['B', 'p']);
    InvariantOracle.check(doc);
  });
  it('addTo cycle and tall subtree depth fail atomically; deleted subtree frees activity quota', () => {
    const doc = buildTree([['P', ['Q', 'a']], ['R']], {
      ...defaultLimits,
      maxNodeCount: 4,
      maxTreeDepth: 3,
    });
    const before = doc.describe();
    expect(() =>
      edit(doc, (tx) => doc.addTo(tx, doc.require('P'), doc.requireContainer('Q'))),
    ).toThrow();
    expect(() =>
      edit(doc, (tx) => doc.addTo(tx, doc.require('R'), doc.requireContainer('Q'))),
    ).not.toThrow();
    const deeper = buildTree(
      [
        ['P', ['Q', ['T']]],
        ['G', 'a'],
      ],
      { ...defaultLimits, maxTreeDepth: 3 },
    );
    const beforeDeep = deeper.describe();
    expect(() =>
      edit(deeper, (tx) => deeper.addTo(tx, deeper.require('G'), deeper.requireContainer('Q'))),
    ).toThrow();
    expect(deeper.describe()).toEqual(beforeDeep);
    expect(before.children.length).toBe(2);
    const subtree = doc.require('P');
    const removed = [subtree, doc.require('Q'), doc.require('a'), doc.require('R')];
    const changes = edit(doc, (tx) => subtree.delete(tx));
    InvariantOracle.check(doc, removed);
    edit(doc, (tx) => doc.create(tx, { type: 'g', id: 'new' }));
    expect(() => edit(doc, (tx) => changes.replay(tx, 'backward'))).toThrow();
    InvariantOracle.check(doc);
  });
});
describe('FAIL-03 group / ungroup prewrite abort and prepared rollback', () => {
  for (const stop of ['G', 'B', 'D'])
    it(`group before ${stop} move compensates`, () => {
      const doc = buildTree(['A', ['P', 'B', 'C'], 'D', 'Z']);
      const before = doc.describe();
      const access = accessDocument(doc);
      const validate = access.validatePlacement;
      const spy = vi.spyOn(access, 'validatePlacement').mockImplementation((node, from, to) => {
        if (node.id === stop && (stop === 'G' ? to !== null : to?.parent.ownerShape?.id === 'G'))
          throw new Error('controlled stop');
        validate(node, from, to);
      });
      expect(() =>
        edit(doc, (tx) => doc.group(tx, doc.planGroup('G', [doc.require('B'), doc.require('D')]))),
      ).toThrow('controlled stop');
      spy.mockRestore();
      expect(doc.describe()).toEqual(before);
      InvariantOracle.check(doc);
      doc.beginEdit().rollback();
    });
  for (const stop of ['u', 'v', 'G'])
    it(`ungroup abort at ${stop}`, () => {
      const doc = buildTree([['P', 'L', ['G', 'u', 'v'], 'R']]);
      const before = doc.describe();
      const access = accessDocument(doc);
      const validate = access.validatePlacement;
      const spy = vi.spyOn(access, 'validatePlacement').mockImplementation((node, from, to) => {
        if (node.id === stop && (stop === 'G' ? to === null : to?.parent.ownerShape?.id === 'P'))
          throw new Error('controlled stop');
        validate(node, from, to);
      });
      expect(() => edit(doc, (tx) => doc.ungroup(tx, doc.require('G')))).toThrow('controlled stop');
      spy.mockRestore();
      expect(doc.describe()).toEqual(before);
      InvariantOracle.check(doc);
    });
  it.each(['group', 'ungroup'])('prepare after %s permits rollback', (kind) => {
    const doc = buildTree([['P', 'L', ['G', 'u', 'v'], 'R']]);
    const before = doc.describe();
    const original = EditLease.prototype.prepare;
    const spy = vi.spyOn(EditLease.prototype, 'prepare').mockImplementation(function (
      this: EditLease,
    ) {
      original.call(this);
      throw new Error('after prepare');
    });
    expect(() =>
      edit(doc, (tx) =>
        kind === 'group'
          ? doc.group(tx, doc.planGroup('new', [doc.require('L'), doc.require('R')]))
          : doc.ungroup(tx, doc.require('G')),
      ),
    ).toThrow('after prepare');
    spy.mockRestore();
    expect(doc.describe()).toEqual(before);
    InvariantOracle.check(doc);
  });
});
