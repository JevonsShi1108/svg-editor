import { expect, it, vi } from 'vitest';
import { parseXml10 } from '../helpers/parse-xml10.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { CliRepl } from '../../src/cli/CliRepl.js';
import { ioFixture, anonymousSvg } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import { protocolCases, invalidLines } from '../fixtures/cli-protocol.js';
import { shapes, setFields } from '../fixtures/shapes.js';
const fixture = async () => {
  const h = ioFixture();
  const parser = new CliParser(h.catalog);
  const run = async (line: string) => h.session.execute(parser.parse(line)!);
  for (const line of [
    'init',
    'create g scene',
    'create g g1 in scene',
    'create rect start 0 0 1 1 in g1',
    'create rect r1 0 0 1 1',
  ])
    committed(await run(line));
  return { ...h, parser, run, presenter: new TextPresenter() };
};
const errors = [
  ['ERR-01', 'create g r1', 'error: id already exists: r1'],
  ['ERR-02', 'move r9 1 2', 'error: no such shape: r9'],
  ['ERR-03', 'create g x in node9', 'error: no such container: node9'],
  ['ERR-04', 'create g x in start', 'error: not a container: start'],
  ['ERR-05', 'create hexagon x', 'error: unknown shape type: hexagon (is the plugin loaded?)'],
  ['ERR-06', 'group bad start g1', 'error: cannot group a container into its own descendant: g1'],
  ['ERR-07', 'ungroup scene', 'error: cannot ungroup top-level container: scene'],
  ['ERR-08', 'scale start 0', 'error: scale factor must be positive'],
  ['ERR-09', 'read a.svg-missing', 'error: cannot read file: a.svg-missing'],
  ['ERR-12', 'set r1 bogus 1', 'error: unknown attribute: bogus'],
] as const;
it('CLI-01 empty lines and comments do not execute in empty, barrier or Redo state', async () => {
  const { session, catalog } = ioFixture();
  for (const setup of [
    null,
    { command: 'init' } as const,
    { command: 'create', shape: { type: 'g', id: 'g' } } as const,
  ]) {
    if (setup) committed(await session.execute(setup));
    if (setup?.command === 'create') committed(await session.execute({ command: 'undo' }));
    const before = (await session.execute({ command: 'help' })).status;
    const execute = vi.spyOn(session, 'execute');
    async function* lines() {
      yield '';
      yield '  ';
      yield '\t # comment';
    }
    await new CliRepl(session, new CliParser(catalog)).run(lines(), {
      interactive: false,
      stdout: async () => {},
      stderr: async () => {},
    });
    expect(execute).not.toHaveBeenCalled();
    execute.mockRestore();
    expect((await session.execute({ command: 'help' })).status).toEqual(before);
  }
});
it.each(errors)(
  '%s exact single-line error and CLI-13 next request still runs',
  async (_id, line, expected) => {
    const { session, parser, presenter, run } = await fixture();
    const before = await semantic(session);
    const status = (await session.execute({ command: 'tree' })).status;
    const chunks = { stdout: '', stderr: '' };
    async function* lines() {
      yield line;
      yield 'show r1';
      yield 'move r1 1 0';
    }
    await new CliRepl(session, parser, presenter).run(lines(), {
      interactive: false,
      stdout: async (s) => {
        chunks.stdout += s;
      },
      stderr: async (s) => {
        chunks.stderr += s;
      },
    });
    expect(chunks.stderr).toBe(`${expected}\n`);
    expect(chunks.stdout).toContain('rect#r1  parent=svg');
    expect(chunks.stdout).toContain('x=1');
    committed(await run('undo'));
    expect(await semantic(session)).toEqual(before);
    expect((await run('tree')).status.revision).toBe(status.revision + 2);
  },
);
it('ERR-10/13/14 confirmed write failure, IO barrier and assigned ID wording from actual results', async () => {
  const { files, run, presenter } = await fixture();
  files.outcome = 'not-committed';
  expect(presenter.render(await run('save a.svg')).stderr).toBe(
    'error: cannot write file: a.svg\n',
  );
  files.outcome = 'committed';
  committed(await run('save a.svg'));
  expect(presenter.render(await run('undo')).stderr).toBe(
    'error: undo not allowed after io command\n',
  );
  files.files.set('/memory/n.svg', anonymousSvg);
  expect(presenter.render(await run('read n.svg')).stderr).toBe(
    'warning: assigned id rect1 to unnamed <rect>\n',
  );
});
it('CLI-11/ERR-11 all document-dependent commands reject uniformly and help remains available', async () => {
  const { session } = ioFixture();
  const presenter = new TextPresenter();
  for (const [, request] of protocolCases.filter(
    ([, r]) => !['help', 'read', 'init'].includes(r.command),
  )) {
    expect(presenter.render(await session.execute(request)).stderr).toBe(
      "error: no document. use 'init' or 'read' first\n",
    );
  }
  expect((await session.execute({ command: 'help' })).ok).toBe(true);
});
it('CLI-05/08/13 all malformed lines diagnose once each, keep Redo, and do not discard next line', async () => {
  const { session, parser, run } = await fixture();
  await run('move r1 2 0');
  await run('undo');
  const before = (await run('tree')).status;
  const chunks = { out: '', err: '' };
  async function* lines() {
    for (const line of invalidLines) {
      yield line;
      yield 'canvas';
    }
  }
  await new CliRepl(session, parser).run(lines(), {
    interactive: false,
    stdout: async (s) => {
      chunks.out += s;
    },
    stderr: async (s) => {
      chunks.err += s;
    },
  });
  expect(chunks.err.trimEnd().split('\n')).toHaveLength(invalidLines.length);
  expect(chunks.out.match(/canvas 800x600/g)).toHaveLength(invalidLines.length);
  expect((await run('tree')).status).toEqual(before);
  committed(await run('redo'));
});
it('CLI-09/API rejects missing fields, numeric strings, extra fields, unknown types/attributes and non-finite numbers atomically', async () => {
  const { session } = await fixture();
  const before = (await session.execute({ command: 'tree' })).status;
  const requests: unknown[] = [
    null,
    {},
    { command: 'move', id: 'r1', dx: '1', dy: 0 },
    { command: 'move', id: 'r1', dx: NaN, dy: 0 },
    { command: 'scale', id: 'r1', factor: Infinity },
    { command: 'move', id: 'r1' },
    { command: 'help', extra: true },
    { command: 'create', shape: { type: 'box', id: 'x' } },
    { command: 'create', shape: { type: 'rect', id: 'x', x: 0, y: 0, width: 1 } },
    { command: 'set', id: 'r1', attribute: 'bogus', value: 1 },
    { command: 'set', id: 'r1', attribute: 'x', value: {} },
    { command: 'group', newId: 'G', ids: 'r1' },
  ];
  for (const request of requests) {
    const result = await session.execute(request as CommandRequest);
    expect(result.ok).toBe(false);
    expect(result.status).toEqual(before);
  }
});
it('QRY-01/02/03/05/06 summaries and undo/redo use restored geometry, own attrs and exact text', async () => {
  const { session, run, presenter } = await fixture();
  const created = presenter.render(await run('create text t 1 2 " a  in # 中文🙂 " in g1')).stdout;
  expect(created).toContain('text#t created');
  expect(created).toContain('parentId="g1"');
  expect(created).toContain('" a  in # 中文🙂 "');
  expect(presenter.render(await run('move r1 10 20')).stdout).toContain('x=10 y=20');
  expect(presenter.render(await run('undo')).stdout).toContain('x=0 y=0');
  expect(presenter.render(await run('redo')).stdout).toContain('x=10 y=20');
  const dry = await session.execute(
    { command: 'move', id: 'r1', dx: 1, dy: 0 },
    { mode: 'dry-run' },
  );
  expect(dry.ok && dry.mode === 'dry-run' && dry.preview[0]).toMatchObject({
    kind: 'state',
    target: { kind: 'shape', type: 'rect', id: 'r1' },
  });
  const tree = presenter.render(await run('tree g1')).stdout;
  expect(tree).toContain('g#g1');
  expect(tree).not.toContain('g#scene');
  expect(tree).toContain('rect#start  x=0 y=0');
  expect(presenter.render(await run('show t')).stdout).toBe(
    'text#t  parent=g#g1\n  x=1\n  y=2\n  text=" a  in # 中文🙂 "\n',
  );
});
it('SPEC §15 terminal escaping contains all C0/DEL/C1 controls, keeps XML text unchanged', async () => {
  const { session, files, presenter } = await fixture();
  const text = 'a\t\n\r\u0085\u009bZ';
  committed(
    await session.execute({
      command: 'create',
      shape: { type: 'text', id: 't', x: 1, y: 2, text },
    }),
  );
  const source = await session.execute({ command: 'save', path: 'controls.svg' });
  committed(source);
  const document = parseXml10(files.files.get('/memory/controls.svg')!);
  expect(document.getElementsByTagName('text')[0]!.textContent).toBe(text);
  const rendered = presenter.render(await session.execute({ command: 'show', id: 't' })).stdout;
  expect(rendered).toContain('a\\t\\n\\r\\u0085\\u009bZ');
  expect(
    [...rendered]
      .filter((c) => c !== '\n')
      .every((c) => c.charCodeAt(0) >= 32 && (c.charCodeAt(0) < 127 || c.charCodeAt(0) > 159)),
  ).toBe(true);
  expect(
    presenter.diagnostic({
      code: 'FILE_IO_ERROR',
      parameters: { operation: 'read', path: 'a\n\u001b[2J\u009bZ' },
    }),
  ).toBe('error: cannot read file: a\\n\\u001b[2J\\u009bZ\n');
});
it('SET-01—06 CLI independently exercises all 36 allowed combinations on the six types', async () => {
  const { session, catalog } = ioFixture();
  const parser = new CliParser(catalog);
  committed(await session.execute({ command: 'init' }));
  let combinations = 0;
  for (const [i, shape] of shapes.entries()) {
    committed(await session.execute({ command: 'create', shape }));
    for (const attribute of [...setFields[i]!, 'fill', 'stroke', 'stroke-width']) {
      const expected =
        attribute === 'text'
          ? ' in # 中文🙂 '
          : attribute === 'fill' || attribute === 'stroke'
            ? '#abc'
            : 17;
      const argument = typeof expected === 'string' ? `"${expected}"` : String(expected);
      committed(await session.execute(parser.parse(`set ${shape.id} ${attribute} ${argument}`)!));
      const shown = committed(await session.execute({ command: 'show', id: shape.id }));
      if (shown.data.kind !== 'show') throw new Error('Expected show');
      if (attribute === 'text') expect(shown.data.shape.text).toBe(expected);
      else expect(shown.data.shape.attributes).toContainEqual({ name: attribute, value: expected });
      combinations++;
    }
  }
  expect(combinations).toBe(36);
});
