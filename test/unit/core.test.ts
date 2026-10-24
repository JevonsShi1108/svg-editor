import { describe, expect, it, vi } from 'vitest';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { NodeMemento } from '../../src/domain/values/NodeMemento.js';
import { NodeStateChange } from '../../src/domain/changes/NodeStateChange.js';
import { accessDocument } from '../../src/domain/internal/storage.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
import { edit } from '../helpers/edit.js';
import type { Shape } from '../../src/domain/shapes/Shape.js';

const rect = (id: string) => ({ type: 'rect' as const, id, x: 0.1, y: 20, width: 30, height: 40 });
const fixture = () => {
  const builder = new SvgDocumentBuilder(defaultLimits);
  const g = builder.append('g', 'g', { attributes: { fill: 'red' } });
  const a = builder.append(
    'rect',
    'a',
    { attributes: { width: 30, height: 40 } },
    g.asContainer()!,
  );
  const b = builder.append(
    'rect',
    'b',
    { attributes: { x: 2, y: 3, width: 4, height: 5 } },
    g.asContainer()!,
  );
  const doc = builder.build();
  return { builder, doc, g, a, b };
};
describe('M02 TX / CRT / INV minimum real transactional core', () => {
  it('INV oracle negative fixtures detect repeated parent, cycles, ghost index/count', () => {
    const { doc, g, a } = fixture();
    const make = (children: readonly Shape[], count = doc.nodeCount, lookup = doc.find.bind(doc)) =>
      ({
        documentId: doc.documentId,
        nodeCount: count,
        root: {
          ownerDocumentId: doc.documentId,
          childCount: children.length,
          childrenSnapshot: () => children,
          childAt: (i: number) => children[i],
        },
        find: lookup,
        isAttached: doc.isAttached.bind(doc),
        placementOf: doc.placementOf.bind(doc),
      }) as unknown as import('../../src/domain/document/SvgDocument.js').SvgDocument;
    expect(() => InvariantOracle.check(make([g, g]))).toThrow();
    expect(() => InvariantOracle.check(make([a, g]))).toThrow();
    expect(() => InvariantOracle.check(make([g], doc.nodeCount + 1))).toThrow();
    expect(() => InvariantOracle.check(make([g], doc.nodeCount, () => undefined))).toThrow();
  });
  it('local limits and malformed direct mementos cannot bypass validation', () => {
    const builder = new SvgDocumentBuilder({ ...defaultLimits, maxNodeCount: 2, maxTreeDepth: 2 });
    const g = builder.append('g', 'g', { attributes: {} });
    const doc = builder.build();
    const changes = edit(doc, (tx) => doc.create(tx, rect('a'), g.asContainer()!));
    expect(() => edit(doc, (tx) => doc.create(tx, rect('b'), doc.root))).toThrow();
    edit(doc, (tx) => changes.replay(tx, 'backward'));
    edit(doc, (tx) => doc.create(tx, { type: 'g', id: 'h' }, g.asContainer()!));
    expect(() =>
      edit(doc, (tx) => doc.create(tx, rect('deep'), doc.requireContainer('h'))),
    ).toThrow();
    expect(() =>
      edit(doc, (tx) => tx.changeState(g, new NodeMemento(g, { attributes: { bogus: 1 } }))),
    ).toThrow();
    expect(() => edit(doc, (tx) => g.set(tx, 'constructor', 1))).toThrow();
    expect(() => edit(doc, (tx) => g.set(tx, '__proto__', 1))).toThrow();
    InvariantOracle.check(doc);
  });
  it('TX-01/03/04 prepared and terminal authority lifetime', () => {
    const { doc, a } = fixture();
    const lease = doc.beginEdit();
    expect(() => doc.beginEdit()).toThrow();
    a.move(lease.tx, 5, -3);
    const changes = lease.prepare();
    expect(changes.size).toBe(1);
    expect(() => a.move(lease.tx, 1, 1)).toThrow();
    expect(() => lease.prepare()).toThrow();
    lease.commitPrepared();
    expect(lease.tx.phase).toBe('committed');
    expect(() => a.move(lease.tx, 0, 0)).toThrow();
    expect(() => lease.tx.place(a, null)).toThrow();
    expect(() => lease.rollback()).toThrow();
    doc.beginEdit().rollback();
    InvariantOracle.check(doc);
  });
  it.each([false, true])(
    'TX-02 prepared=%s rollback restores state, presence, placement/index/count and original identity',
    (prepare) => {
      const { doc, a, g } = fixture();
      const snapshot = SemanticSnapshot.of(doc.describe());
      const lease = doc.beginEdit();
      a.move(lease.tx, 5, -3);
      a.set(lease.tx, 'fill', 'black');
      const temporary = doc.create(lease.tx, rect('temp'), doc.root);
      g.delete(lease.tx);
      if (prepare) lease.prepare();
      lease.rollback();
      expect(SemanticSnapshot.of(doc.describe())).toEqual(snapshot);
      expect(doc.require('a')).toBe(a);
      expect(doc.find('temp')).toBeUndefined();
      expect(doc.isAttached(temporary)).toBe(false);
      expect(a.describe().attributes.some(({ name }) => name === 'x')).toBe(false);
      expect(() => a.move(lease.tx, 1, 1)).toThrow();
      InvariantOracle.check(doc, [temporary]);
      doc.beginEdit().rollback();
    },
  );
  it('TX-05/06/07/09 builder revoked, cross-doc/memento/stale replay blocked; edit facade has no control/raw setter', () => {
    const { builder, doc, a, b } = fixture();
    const other = fixture();
    expect(() => builder.append('g', 'later', { attributes: {} })).toThrow();
    expect(() => builder.build()).toThrow();
    const lease = doc.beginEdit();
    expect(() => other.a.move(lease.tx, 1, 1)).toThrow();
    expect(() => lease.tx.place(a, { parent: other.doc.root, index: 0 })).toThrow();
    expect(() => lease.tx.changeState(a, b.captureState())).toThrow();
    expect(Object.keys(lease.tx)).toEqual([]);
    expect('commitPrepared' in lease.tx).toBe(false);
    expect('rollback' in lease.tx).toBe(false);
    expect('authority' in lease.tx).toBe(false);
    expect('installState' in a).toBe(false);
    const change = new NodeStateChange(
      a,
      a.captureState(),
      new NodeMemento(a, { attributes: { x: 1, width: 30, height: 40 } }),
    );
    a.move(lease.tx, 2, 0);
    expect(() => lease.tx.applyRecorded(change, 'forward')).toThrow();
    lease.rollback();
    InvariantOracle.check(doc);
    InvariantOracle.check(other.doc);
  });
  it('CRT-01/03/04/05/07 STR-16/17: root distinct from id svg, container lookup, subtree active membership', () => {
    const { doc, g, a, b } = fixture();
    edit(doc, (tx) => {
      doc.create(tx, rect('svg'), doc.root);
      doc.create(tx, rect('A'), g.asContainer()!);
    });
    expect(doc.require('svg')).not.toBe(doc.root);
    expect(doc.require('A')).not.toBe(a);
    const before = SemanticSnapshot.of(doc.describe());
    expect(() => edit(doc, (tx) => doc.create(tx, rect('a'), doc.root))).toThrow();
    expect(() => doc.requireContainer('missing')).toThrow();
    expect(() => doc.requireContainer('a')).toThrow();
    expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
    const changes = edit(doc, (tx) => g.delete(tx));
    expect(changes.size).toBe(1);
    for (const n of [g, a, b]) expect(doc.isAttached(n)).toBe(false);
    expect(doc.placementOf(a)?.parent).toBe(g);
    edit(doc, (tx) => changes.replay(tx, 'backward'));
    expect(doc.require('a')).toBe(a);
    InvariantOracle.check(doc);
    edit(doc, (tx) => changes.replay(tx, 'forward'));
    InvariantOracle.check(doc, [g, a, b]);
  });
  it('TX-08 / INV-12 immutable descriptions and history state do not change with later edits', () => {
    const { doc, a } = fixture();
    const before = a.captureState();
    const description = a.describe();
    const changes = edit(doc, (tx) => {
      a.set(tx, 'fill', 'RED');
      a.move(tx, 5, 0);
    });
    const preview = structuredClone(changes.describe('forward'));
    edit(doc, (tx) => a.move(tx, 2, 0));
    expect(changes.describe('forward')).toEqual(preview);
    expect(a.describeState(before)).toEqual({
      attributes: [
        { name: 'width', value: 30 },
        { name: 'height', value: 40 },
      ],
    });
    expect(description.attributes.some(({ name }) => name === 'fill')).toBe(false);
    expect(Reflect.set(description, 'id', 'oops')).toBe(false);
    expect(a.id).toBe('a');
    expect(() => Array.prototype.push.call(doc.root.childrenSnapshot(), a)).toThrow();
    InvariantOracle.check(doc);
  });
  it('placement destination bounds / cycle / foreign ownership validated before writes', () => {
    const { doc, g, a } = fixture();
    const before = SemanticSnapshot.of(doc.describe());
    for (const destination of [
      { parent: g.asContainer()!, index: 9 },
      { parent: g.asContainer()!, index: -1 },
      { parent: g.asContainer()!, index: 0.5 },
    ])
      expect(() => edit(doc, (tx) => tx.place(a, destination))).toThrow();
    expect(() => edit(doc, (tx) => tx.place(g, { parent: g.asContainer()!, index: 0 }))).toThrow();
    expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
    InvariantOracle.check(doc);
  });
  it('FAIL-02/03 write-before failure compensates prior primitives and releases active marker', () => {
    const { doc, a, b } = fixture();
    const before = SemanticSnapshot.of(doc.describe());
    const access = accessDocument(doc);
    const original = access.validateState;
    vi.spyOn(access, 'validateState').mockImplementation((target, expected, next) => {
      if (target === b) throw new Error('controlled prewrite failure');
      original(target, expected, next);
    });
    expect(() =>
      edit(doc, (tx) => {
        a.move(tx, 3, 0);
        b.move(tx, 3, 0);
      }),
    ).toThrow('controlled');
    vi.restoreAllMocks();
    expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
    InvariantOracle.check(doc);
    edit(doc, (tx) => a.move(tx, 1, 0));
  });
  it('GEO-09 exact Memento replay does not use inverse floating arithmetic and preserves same node', () => {
    const { doc } = fixture();
    let node: Shape;
    edit(doc, (tx) => {
      node = doc.create(tx, rect('precise'), doc.root);
    });
    const changes = edit(doc, (tx) => node.scale(tx, 3));
    expect(node!.describe().attributes.find((a) => a.name === 'x')?.value).toBe(0.1 * 3);
    edit(doc, (tx) => changes.replay(tx, 'backward'));
    expect(node!.describe().attributes.find((a) => a.name === 'x')?.value).toBe(0.1);
    edit(doc, (tx) => changes.replay(tx, 'forward'));
    expect(doc.require('precise')).toBe(node!);
    expect(node!.describe().attributes.find((a) => a.name === 'x')?.value).toBe(0.1 * 3);
  });
});
