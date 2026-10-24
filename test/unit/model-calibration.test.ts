import { it, expect } from 'vitest';
import { ReferenceModel } from '../model/ReferenceModel.js';
import { initialWithFiles } from '../model/fixtures.js';
import type { ModelState } from '../model/types.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
const setup = (entries: readonly (readonly [string, string | null])[]) => {
  const model = new ReferenceModel(40, 5);
  let state = model.step(model.initial(), { request: { command: 'init' } }).state;
  for (const [id, parent] of entries) {
    const next = model.step(state, {
      request: {
        command: 'create',
        shape: { type: 'g', id },
        ...(parent === null ? {} : { parentId: parent }),
      },
    });
    expect(next.result.ok).toBe(true);
    state = next.state;
  }
  return { model, state };
};
const children = (m: ReferenceModel, s: ModelState, id?: string) =>
  m
    .children(s.document!, id === undefined ? null : m.node(s.document!, id).uid)
    .map((uid) => s.document!.nodes[uid]!.id);
it('REG-MODEL-ORACLE-01 SPEC §6.1 empty dirty=false and CFG-04 create normalizes negative zero', () => {
  const model = new ReferenceModel();
  const empty = model.initial();
  expect(model.status(empty).dirty).toBe(false);
  const initialized = model.step(empty, { request: { command: 'init' } }).state;
  const created = model.step(initialized, {
    request: {
      command: 'create',
      shape: { type: 'rect', id: 'r', x: 0, y: -0, width: 1, height: 1 },
    },
  }).state;
  expect(Object.is(model.node(created.document!, 'r').attributes.y, -0)).toBe(false);
});
const cases = [
  {
    id: 'STR-01',
    entries: [
      ['A', null],
      ['B', null],
      ['C', null],
      ['D', null],
    ],
    selected: ['D', 'B'],
    root: ['A', 'C', 'G'],
    group: ['B', 'D'],
    parents: {},
  },
  {
    id: 'STR-02',
    entries: [
      ['A', null],
      ['P', null],
      ['B', 'P'],
      ['C', 'P'],
      ['D', null],
      ['Z', null],
    ],
    selected: ['D', 'B'],
    root: ['A', 'P', 'G', 'Z'],
    group: ['B', 'D'],
    parents: { P: ['C'] },
  },
  {
    id: 'STR-03',
    entries: [
      ['P', null],
      ['a', 'P'],
      ['b', 'P'],
      ['Q', null],
      ['c', 'Q'],
      ['d', 'Q'],
      ['Z', null],
    ],
    selected: ['c', 'b'],
    root: ['P', 'Q', 'G', 'Z'],
    group: ['b', 'c'],
    parents: { P: ['a'], Q: ['d'] },
  },
  {
    id: 'STR-04',
    entries: [
      ['P', null],
      ['A', 'P'],
      ['B', 'P'],
      ['C', 'P'],
      ['D', 'P'],
    ],
    selected: ['D', 'B'],
    root: ['P'],
    group: ['B', 'D'],
    parents: { P: ['A', 'C', 'G'] },
  },
] as const;
it.each(cases)(
  'MODEL-01/03 independent group calibrated against hand tree $id',
  ({ entries, selected, root, group, parents }) => {
    const { model, state } = setup(entries);
    const result = model.step(state, { request: { command: 'group', newId: 'G', ids: selected } });
    expect(result.result).toMatchObject({ ok: true, contentChanged: true });
    expect(children(model, result.state)).toEqual(root);
    expect(children(model, result.state, 'G')).toEqual(group);
    for (const [id, expected] of Object.entries(parents))
      expect(children(model, result.state, id)).toEqual(expected);
    expect(children(model, state)).toEqual(entries.filter(([, p]) => p === null).map(([id]) => id));
  },
);
it('MODEL-03 width 12 reverse selection indices 10/2 compares numeric path components', () => {
  const { model, state } = setup(Array.from({ length: 12 }, (_, i) => [`N${i}`, null] as const));
  const after = model.step(state, {
    request: { command: 'group', newId: 'G', ids: ['N10', 'N2'] },
  }).state;
  expect(children(model, after, 'G')).toEqual(['N2', 'N10']);
  expect(children(model, after)).toEqual([
    'N0',
    'N1',
    'N3',
    'N4',
    'N5',
    'N6',
    'N7',
    'N8',
    'N9',
    'G',
    'N11',
  ]);
});
it('MODEL-01/06 REG-STATE full hand-derived token/dirty/revision trajectory calibrates snapshot model', () => {
  const model = new ReferenceModel();
  let state = initialWithFiles(model);
  const requests: CommandRequest[] = [
    { command: 'read', path: 'a.svg' },
    { command: 'move', id: 'r1', dx: 1, dy: 0 },
    { command: 'undo' },
    { command: 'move', id: 'r1', dx: 0, dy: 0 },
    { command: 'scale', id: 'r1', factor: 0 },
    { command: 'move', id: 'r1', dx: 2, dy: 0 },
    { command: 'redo' },
    { command: 'save', path: 'b.svg' },
    { command: 'canvas', size: { width: 400, height: 300 } },
    { command: 'move', id: 'r1', dx: 0, dy: 0 },
    { command: 'undo' },
    { command: 'move', id: 'r1', dx: 1, dy: 0 },
    { command: 'move', id: 'r1', dx: -1, dy: 0 },
    { command: 'undo' },
    { command: 'undo' },
  ];
  const revisions = [1, 2, 3, 3, 3, 3, 4, 5, 5, 6, 6, 7, 8, 9, 10];
  const dirty = [
    false,
    true,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    true,
    true,
    true,
    false,
  ];
  const stacks = [
    [0, 0],
    [1, 0],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [1, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
    [0, 2],
  ];
  for (const [i, request] of requests.entries()) {
    const transition = model.step(state, {
      request,
      ...(i === 5 ? { options: { mode: 'dry-run' as const } } : {}),
    });
    state = transition.state;
    expect(transition.result.ok).toBe(![4, 10].includes(i));
    const status = model.status(state);
    expect(status.revision).toBe(revisions[i]);
    expect(status.dirty).toBe(dirty[i]);
    expect([status.history.undoCount, status.history.redoCount]).toEqual(stacks[i]);
    expect(status.currentPath).toBe(i < 7 ? '/memory/a.svg' : '/memory/b.svg');
  }
});
it('MODEL-07 snapshots preserve old/new testUid across same public ID reuse and undo/redo', () => {
  const model = new ReferenceModel();
  let state = model.step(initialWithFiles(model), {
    request: { command: 'read', path: 'a.svg' },
  }).state;
  const old = model.node(state.document!, 'r1').uid;
  for (const request of [
    { command: 'delete', id: 'r1' },
    { command: 'create', shape: { type: 'circle', id: 'r1', cx: 1, cy: 2, r: 3 } },
  ] as CommandRequest[])
    state = model.step(state, { request }).state;
  const next = model.node(state.document!, 'r1').uid;
  expect(next).not.toBe(old);
  state = model.step(model.step(state, { request: { command: 'undo' } }).state, {
    request: { command: 'undo' },
  }).state;
  expect(model.node(state.document!, 'r1').uid).toBe(old);
  state = model.step(model.step(state, { request: { command: 'redo' } }).state, {
    request: { command: 'redo' },
  }).state;
  expect(model.node(state.document!, 'r1').uid).toBe(next);
});
