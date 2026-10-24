import { it, expect, vi } from 'vitest';
import { ioFixture } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
const source =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" fill="blue" font-size="16"><g id="G" fill="red" data-kind="box"><rect id="r" x="1" y="2" width="3" height="4"/><circle id="c" cx="5" cy="6" r="7"/><ellipse id="e" cx="8" cy="9" rx="10" ry="11"/><line id="l" x1="1" y1="2" x2="3" y2="4" stroke="black"/><text id="t" x="12" y="13" text-anchor="middle"> a  中文🙂 </text></g></svg>';
it('CRT-05 case-sensitive IDs edit/delete/replay independently across different types', async () => {
  const { session } = ioFixture();
  committed(await session.execute({ command: 'read', path: 'a.svg' }));
  committed(
    await session.execute({
      command: 'create',
      shape: { type: 'circle', id: 'R1', cx: 2, cy: 3, r: 4 },
    }),
  );
  committed(await session.execute({ command: 'move', id: 'R1', dx: 5, dy: 0 }));
  const lower = committed(await session.execute({ command: 'show', id: 'r1' }));
  expect(lower.data.kind === 'show' && lower.data.shape.attributes).toContainEqual({
    name: 'x',
    value: 10,
  });
  committed(await session.execute({ command: 'delete', id: 'r1' }));
  expect((await session.execute({ command: 'show', id: 'r1' })).ok).toBe(false);
  const upper = committed(await session.execute({ command: 'show', id: 'R1' }));
  expect(upper.data.kind === 'show' && upper.data.shape.attributes).toContainEqual({
    name: 'cx',
    value: 7,
  });
  committed(await session.execute({ command: 'undo' }));
  expect((await session.execute({ command: 'show', id: 'r1' })).ok).toBe(true);
  committed(await session.execute({ command: 'redo' }));
  expect((await session.execute({ command: 'show', id: 'r1' })).ok).toBe(false);
  expect((await session.execute({ command: 'show', id: 'R1' })).ok).toBe(true);
});
it('SET-03 nonempty Group set changes only its own three style fields, preserving inherited absence and explicit child styles through undo/redo', async () => {
  const { session, files } = ioFixture();
  files.files.set(
    '/memory/styles.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><g id="G" fill="red" stroke-width="3"><rect id="inherited" width="10" height="20"/><circle id="explicit" r="2" fill="blue" stroke="none" stroke-width="1"/></g></svg>',
  );
  committed(await session.execute({ command: 'read', path: 'styles.svg' }));
  const before = await semantic(session),
    children = before.children[0]!.children;
  for (const [attribute, value] of [
    ['fill', 'green'],
    ['stroke', 'black'],
    ['stroke-width', 7],
  ] as const) {
    const result = committed(await session.execute({ command: 'set', id: 'G', attribute, value }));
    expect(result.contentChanged).toBe(true);
    expect((await semantic(session)).children[0]!.children).toEqual(children);
  }
  const after = await semantic(session);
  expect(after.children[0]!.shape.attributes).toEqual([
    { name: 'fill', value: 'green' },
    { name: 'stroke-width', value: 7 },
    { name: 'stroke', value: 'black' },
  ]);
  for (let i = 0; i < 3; i++) committed(await session.execute({ command: 'undo' }));
  expect(await semantic(session)).toEqual(before);
  for (let i = 0; i < 3; i++) committed(await session.execute({ command: 'redo' }));
  expect(await semantic(session)).toEqual(after);
});
it('DOC-03/07 six-type read publishes new document identities, exact readonly/presence/text and repaired saved-state', async () => {
  const { session, files, codec } = ioFixture();
  files.files.set('/memory/six.svg', source);
  const documents: SvgDocument[] = [];
  const decode = codec.decode.bind(codec);
  const spy = vi.spyOn(codec, 'decode').mockImplementation((s, l) => {
    const result = decode(s, l);
    documents.push(result.document);
    return result;
  });
  try {
    for (let i = 0; i < 2; i++) {
      const result = committed(await session.execute({ command: 'read', path: 'six.svg' }));
      expect(result.status.revision).toBe(i + 1);
      expect(result.status.dirty).toBe(false);
      expect(result.status.history).toEqual({ undoCount: 0, redoCount: 0, barrier: 'read' });
      expect(result.data).toMatchObject({ kind: 'document', nodeCount: 6 });
      expect(result.warnings).toEqual([]);
    }
    expect(documents[0]).not.toBe(documents[1]);
    expect(documents[0]!.documentId).not.toBe(documents[1]!.documentId);
    const doc = await semantic(session);
    expect(doc.attributes).toEqual([
      { name: 'fill', value: 'blue' },
      { name: 'font-size', value: 16 },
    ]);
    expect(doc.children[0]!.children.map((n) => [n.shape.type, n.shape.id])).toEqual([
      ['rect', 'r'],
      ['circle', 'c'],
      ['ellipse', 'e'],
      ['line', 'l'],
      ['text', 't'],
    ]);
    expect(doc.children[0]!.children[0]!.shape.attributes.some((a) => a.name === 'fill')).toBe(
      false,
    );
    expect(doc.children[0]!.shape.attributes).toContainEqual({ name: 'data-kind', value: 'box' });
    expect(doc.children[0]!.children[4]!.shape.text).toBe(' a  中文🙂 ');
    files.files.set('/memory/repair.svg', source.replace(' id="r"', ''));
    const repaired = committed(await session.execute({ command: 'read', path: 'repair.svg' }));
    expect(repaired.status.dirty).toBe(true);
    expect(repaired.warnings).toEqual([
      { code: 'ASSIGNED_ID', parameters: { type: 'rect', id: 'rect1' } },
    ]);
    expect(committed(await session.execute({ command: 'save' })).status.dirty).toBe(false);
  } finally {
    spy.mockRestore();
  }
});
it('QRY-01—05 empty tree and every type parent/own attrs, all queries preserve read barrier and saved Redo', async () => {
  const { session, files, codec } = ioFixture(),
    presenter = new TextPresenter();
  committed(await session.execute({ command: 'init' }));
  expect(presenter.render(await session.execute({ command: 'tree' })).stdout).toBe(
    'svg (800x600)\n',
  );
  files.files.set('/memory/six.svg', source);
  committed(await session.execute({ command: 'read', path: 'six.svg' }));
  const encode = vi.spyOn(codec, 'encode');
  try {
    for (const redo of [false, true]) {
      if (redo) {
        committed(await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 }));
        committed(await session.execute({ command: 'undo' }));
      }
      const before = (await session.execute({ command: 'tree' })).status;
      const requests: CommandRequest[] = [
        { command: 'help' },
        { command: 'tree' },
        { command: 'tree', id: 'G' },
        { command: 'canvas' },
        ...['G', 'r', 'c', 'e', 'l', 't'].map((id) => ({ command: 'show' as const, id })),
      ];
      for (const request of requests) {
        const result = committed(await session.execute(request));
        expect(result.status).toEqual(before);
        expect(result.contentChanged).toBe(false);
        expect(result.sessionChanged).toBe(false);
        if (result.data.kind === 'show') {
          expect(result.data.parent).toEqual(
            request.command === 'show' && request.id === 'G'
              ? { kind: 'root' }
              : { kind: 'group', id: 'G' },
          );
          if (result.data.shape.type !== 'g')
            expect(result.data.shape.attributes.some((a) => a.name === 'fill')).toBe(false);
        }
      }
      const tree = presenter.render(await session.execute({ command: 'tree' })).stdout;
      for (const value of [
        'rect#r  x=1 y=2 width=3 height=4',
        'circle#c  cx=5 cy=6 r=7',
        'ellipse#e  cx=8 cy=9 rx=10 ry=11',
        'line#l  x1=1 y1=2 x2=3 y2=4',
        'text#t  x=12 y=13',
        '" a  中文🙂 "',
      ])
        expect(tree).toContain(value);
    }
    expect(encode).not.toHaveBeenCalled();
    expect(files.writeCalls).toEqual([]);
  } finally {
    encode.mockRestore();
  }
});
it('DOC-09 CLI canvas invalid values preserve saved path, viewBox, Redo and revision', async () => {
  const { session, catalog, codec } = ioFixture();
  await session.execute({ command: 'read', path: 'a.svg' });
  await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
  await session.execute({ command: 'undo' });
  const before = await semantic(session),
    status = (await session.execute({ command: 'tree' })).status;
  for (const token of ['0', '-1', 'NaN', 'Infinity', '10oops']) {
    const parser = new CliParser(catalog);
    let request: CommandRequest | null = null;
    try {
      request = parser.parse(`canvas ${token} 300`);
    } catch {
      /* lexical failure is also unchanged */
    }
    if (request) expect((await session.execute(request)).ok).toBe(false);
    expect((await session.execute({ command: 'tree' })).status).toEqual(status);
    expect(await semantic(session)).toEqual(before);
    expect(codec.encode(await semantic(session))).toContain('viewBox="0 0 400 300"');
  }
  committed(await session.execute({ command: 'redo' }));
});
it('LIM-09 Session and catalog own immutable limits; caller/environment changes cannot expand quotas or alter replay', async () => {
  const limits = { ...defaultLimits, maxNodeCount: 2, maxTextLength: 3 },
    h = ioFixture();
  const session = new EditorSession({
    commands: new CommandCatalog(limits),
    codec: h.codec,
    files: h.files,
    limits,
  });
  const previous = process.env.SVG_EDITOR_TEST_MAX_NODES;
  try {
    limits.maxNodeCount = 999;
    limits.maxTextLength = 999;
    process.env.SVG_EDITOR_TEST_MAX_NODES = '999';
    committed(await session.execute({ command: 'init' }));
    committed(await session.execute({ command: 'create', shape: { type: 'g', id: 'A' } }));
    committed(await session.execute({ command: 'create', shape: { type: 'g', id: 'B' } }));
    const status = (await session.execute({ command: 'tree' })).status;
    const rejected = await session.execute({ command: 'create', shape: { type: 'g', id: 'C' } });
    expect(rejected.ok).toBe(false);
    expect(rejected.status).toEqual(status);
    committed(await session.execute({ command: 'undo' }));
    const redo = (await session.execute({ command: 'tree' })).status;
    expect(
      (
        await session.execute({
          command: 'create',
          shape: { type: 'text', id: 't', x: 0, y: 0, text: 'a🙂bc' },
        })
      ).status,
    ).toEqual(redo);
    committed(await session.execute({ command: 'redo' }));
    expect((await semantic(session)).children.map((n) => n.shape.id)).toEqual(['A', 'B']);
  } finally {
    if (previous === undefined) delete process.env.SVG_EDITOR_TEST_MAX_NODES;
    else process.env.SVG_EDITOR_TEST_MAX_NODES = previous;
  }
});
it('FAIL-02 snapshot preparation fails after first Composite leaf; all fields/history restore and next edit works', async () => {
  const h = ioFixture();
  await h.session.execute({ command: 'read', path: 'a.svg' });
  const original = SvgDocument.prototype.beginEdit;
  const captured: { document?: SvgDocument } = {};
  const capture = vi.spyOn(SvgDocument.prototype, 'beginEdit').mockImplementation(function (
    this: SvgDocument,
  ) {
    captured.document = this;
    return original.call(this);
  });
  committed(
    await h.session.execute({
      command: 'create',
      shape: { type: 'rect', id: 'b', x: 1, y: 2, width: 3, height: 4 },
    }),
  );
  capture.mockRestore();
  committed(await h.session.execute({ command: 'group', newId: 'G', ids: ['r1', 'b'] }));
  const before = await semantic(h.session),
    status = (await h.session.execute({ command: 'tree' })).status;
  const snapshot = vi
    .spyOn(captured.document!.require('b'), 'captureState')
    .mockImplementationOnce(() => {
      throw new Error('snapshot allocation failed');
    });
  const rejected = await h.session.execute({ command: 'move', id: 'G', dx: 1, dy: 0 });
  snapshot.mockRestore();
  expect(rejected.ok).toBe(false);
  expect(rejected.status).toEqual(status);
  expect(await semantic(h.session)).toEqual(before);
  committed(await h.session.execute({ command: 'move', id: 'G', dx: 1, dy: 0 }));
});
