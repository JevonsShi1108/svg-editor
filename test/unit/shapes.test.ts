import { expect, it, describe } from 'vitest';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { shapes, moved, scaled, setFields } from '../fixtures/shapes.js';
import { edit } from '../helpers/edit.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';

const fixture = () => new SvgDocumentBuilder(defaultLimits).build();
describe('CRT-01—08 six real classes and constrained creation', () => {
  for (const creation of shapes)
    for (const inside of [false, true])
      it(`${creation.type} in ${inside ? 'group' : 'root'}`, () => {
        const doc = fixture();
        edit(doc, (tx) => doc.create(tx, { type: 'g', id: 'parent' }));
        const parent = inside ? doc.requireContainer('parent') : doc.root;
        const changes = edit(doc, (tx) => doc.create(tx, creation, parent));
        const node = doc.require(creation.id);
        expect(node.describe().type).toBe(creation.type);
        const attrs = Object.fromEntries(
          Object.entries(creation).filter(([key]) => !['type', 'id', 'text'].includes(key)),
        );
        const text = creation.type === 'text' ? creation.text : undefined;
        expect(
          Object.fromEntries(node.describe().attributes.map((a) => [a.name, a.value])),
        ).toEqual(attrs);
        expect(node.describe().text).toBe(text);
        // The root already holds the fixture's parent group; new shapes append after it.
        expect(doc.placementOf(node)).toEqual({ parent, index: inside ? 0 : 1 });
        expect(changes.size).toBe(1);
        InvariantOracle.check(doc);
        edit(doc, (tx) => changes.replay(tx, 'backward'));
        expect(doc.find(creation.id)).toBeUndefined();
        edit(doc, (tx) => changes.replay(tx, 'forward'));
        expect(doc.require(creation.id)).toBe(node);
      });
  it('CRT-02 optional paint and exact omissions, CRT-06 unsupported type, untrusted API values', () => {
    const doc = fixture();
    for (const shape of shapes.slice(0, 4))
      edit(doc, (tx) =>
        doc.create(tx, {
          ...shape,
          ...(shape.type === 'line' ? { stroke: 'BLUE' } : { fill: 'RED' }),
        } as ShapeCreation),
      );
    expect(doc.require('l').describe().attributes).toContainEqual({
      name: 'stroke',
      value: 'blue',
    });
    expect(
      doc
        .require('l')
        .describe()
        .attributes.some((a) => a.name === 'fill'),
    ).toBe(false);
    for (const shape of [
      { type: 'box', id: 'x' },
      { type: 'hexagon', id: 'x' },
      { type: 'rect', id: 'x', x: '1', y: 2, width: 3, height: 4 },
      { type: 'g', id: 'x', fill: 'red' },
      { type: 'text', id: 'x', x: 0, y: 0, text: 'a', fill: 'red' },
    ])
      expect(() => edit(doc, (tx) => doc.create(tx, shape as unknown as ShapeCreation))).toThrow();
  });
});
describe('GEO-01/02 independent hand calculation — transforms start afresh', () => {
  for (const [index, shape] of shapes.entries()) {
    it(`${shape.type} move`, () => {
      const doc = fixture();
      edit(doc, (tx) => doc.create(tx, shape));
      edit(doc, (tx) => doc.require(shape.id).move(tx, 5, -3));
      expect(
        Object.fromEntries(
          doc
            .require(shape.id)
            .describe()
            .attributes.map((a) => [a.name, a.value]),
        ),
      ).toEqual(moved[index]);
    });
    it(`${shape.type} scale`, () => {
      const doc = fixture();
      edit(doc, (tx) => doc.create(tx, shape));
      edit(doc, (tx) => doc.require(shape.id).scale(tx, 2));
      expect(
        Object.fromEntries(
          doc
            .require(shape.id)
            .describe()
            .attributes.map((a) => [a.name, a.value]),
        ),
      ).toEqual(scaled[index]);
    });
  }
  it('GEO-03/04 recursive mixed group exactly once, protected styles and outside unchanged', () => {
    const builder = new SvgDocumentBuilder(defaultLimits);
    const outer = builder.append('g', 'outer', {
      attributes: { 'stroke-width': 3, 'font-size': 16 },
    });
    const inner = builder.append('g', 'inner', { attributes: {} }, outer.asContainer()!);
    const deep = builder.append('g', 'deep', { attributes: {} }, inner.asContainer()!);
    const leaf = builder.append(
      'rect',
      'r',
      { attributes: { x: 10, y: 20, width: 30, height: 40, 'stroke-width': 3, 'font-size': 16 } },
      deep.asContainer()!,
    );
    const outside = builder.append('circle', 'out', { attributes: { r: 5 } });
    const doc = builder.build();
    const outsideBefore = outside.describe();
    edit(doc, (tx) => outer.scale(tx, 2));
    expect(Object.fromEntries(leaf.describe().attributes.map((a) => [a.name, a.value]))).toEqual({
      ...scaled[0],
      'stroke-width': 3,
      'font-size': 16,
    });
    expect(outside.describe()).toEqual(outsideBefore);
    expect(outer.describe().attributes).toContainEqual({ name: 'font-size', value: 16 });
    InvariantOracle.check(doc);
  });
  it('GEO-05/06 missing position and empty group validate before no-op', () => {
    const b = new SvgDocumentBuilder(defaultLimits);
    const r = b.append('rect', 'r', { attributes: { width: 0, height: 0 } });
    const g = b.append('g', 'g', { attributes: {} });
    const doc = b.build();
    const before = doc.describe();
    expect(
      edit(doc, (tx) => {
        r.move(tx, 0, 0);
        r.scale(tx, 1);
        g.scale(tx, 2);
      }).isEmpty,
    ).toBe(true);
    expect(doc.describe()).toEqual(before);
    for (const f of [0, -1, NaN, Infinity])
      expect(() => edit(doc, (tx) => g.scale(tx, f))).toThrow();
    expect(() => edit(doc, (tx) => g.move(tx, NaN, 0))).toThrow();
    const changes = edit(doc, (tx) => r.set(tx, 'x', 0));
    expect(changes.isEmpty).toBe(false);
    edit(doc, (tx) => changes.replay(tx, 'backward'));
    expect(doc.describe()).toEqual(before);
  });
  it('GEO-07/08/10 later overflow and nonzero underflow restore prior leaves', () => {
    const b = new SvgDocumentBuilder(defaultLimits);
    const g = b.append('g', 'g', { attributes: {} });
    b.append('rect', 'a', { attributes: { x: 0.1, width: 1, height: 1 } }, g.asContainer()!);
    b.append('circle', 'b', { attributes: { cx: 1e308, r: 1 } }, g.asContainer()!);
    const doc = b.build();
    const before = SemanticSnapshot.of(doc.describe());
    expect(() => edit(doc, (tx) => g.scale(tx, 2))).toThrow();
    expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
    expect(() => edit(doc, (tx) => doc.require('b').move(tx, 1e308, 0))).toThrow();
    const under = edit(doc, (tx) => doc.require('a').set(tx, 'x', Number.MIN_VALUE));
    expect(() => edit(doc, (tx) => doc.require('a').scale(tx, 0.5))).toThrow();
    edit(doc, (tx) => under.replay(tx, 'backward'));
    expect(SemanticSnapshot.of(doc.describe())).toEqual(before);
    InvariantOracle.check(doc);
  });
});
describe('SET-01 all 36 legal combinations exact before/after replay', () => {
  for (const [i, shape] of shapes.entries())
    for (const field of ['fill', 'stroke', 'stroke-width', ...setFields[i]!])
      it(`${shape.type}.${field}`, () => {
        const doc = fixture();
        edit(doc, (tx) => doc.create(tx, shape));
        const node = doc.require(shape.id);
        const before = node.describe();
        const value =
          field === 'text'
            ? ' 中文🙂  &<> '
            : field === 'fill'
              ? 'red'
              : field === 'stroke'
                ? 'blue'
                : 99;
        const changes = edit(doc, (tx) => node.set(tx, field, value));
        expect(changes.size).toBe(1);
        const after = node.describe();
        if (field === 'text') expect(after.text).toBe(value);
        else expect(after.attributes).toContainEqual({ name: field, value });
        edit(doc, (tx) => changes.replay(tx, 'backward'));
        expect(node.describe()).toEqual(before);
        edit(doc, (tx) => changes.replay(tx, 'forward'));
        expect(node.describe()).toEqual(after);
        expect(edit(doc, (tx) => node.set(tx, field, value)).isEmpty).toBe(true);
        InvariantOracle.check(doc);
      });
  it('SET-02/03/06/07 readonly fields and cross-type attributes refused; group set only own', () => {
    const doc = fixture();
    for (const shape of shapes) edit(doc, (tx) => doc.create(tx, shape));
    const before = doc.describe();
    for (const shape of shapes)
      for (const name of [
        'id',
        'transform',
        'style',
        'font-size',
        'text-anchor',
        'data-kind',
        'label',
        'constructor',
      ])
        expect(() => edit(doc, (tx) => doc.require(shape.id).set(tx, name, 'x'))).toThrow();
    for (const [id, key, val] of [
      ['c', 'width', 1],
      ['g', 'x', 1],
      ['r', 'width', -1],
      ['r', 'fill', 'url(x)'],
      ['t', 'text', '\0'],
    ] as const)
      expect(() => edit(doc, (tx) => doc.require(id).set(tx, key, val))).toThrow();
    expect(doc.describe()).toEqual(before);
    edit(doc, (tx) => doc.require('g').set(tx, 'fill', 'red'));
    expect(
      doc
        .require('r')
        .describe()
        .attributes.some((a) => a.name === 'fill'),
    ).toBe(false);
  });
});
