import { it, expect } from 'vitest';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { ioFixture } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import type { ExecutionResult } from '../../src/application/contracts/api.js';
const prepare = async () => {
  const h = ioFixture(),
    limits = { ...defaultLimits, maxTextLength: 3, maxAttributeLength: 40 },
    catalog = new CommandCatalog(limits);
  const session = new EditorSession({ commands: catalog, codec: h.codec, files: h.files, limits });
  committed(await session.execute({ command: 'read', path: 'a.svg' }));
  committed(
    await session.execute({
      command: 'create',
      shape: { type: 'text', id: 't', x: 0, y: 0, text: 'a' },
    }),
  );
  committed(await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 }));
  committed(await session.execute({ command: 'undo' }));
  return { ...h, session, parser: new CliParser(catalog) };
};
it.each([
  ['a🙂', true],
  ['a🙂b', true],
  ['a🙂bc', false],
] as const)(
  'LIM-07 Unicode scalar L-1/L/L+1 crosses create/set/read entry paths %s',
  async (text, valid) => {
    for (const entry of ['API create', 'API set', 'CLI create', 'CLI set', 'read'] as const) {
      const h = await prepare(),
        before = await semantic(h.session),
        status = (await h.session.execute({ command: 'tree' })).status;
      let result: ExecutionResult | null = null;
      if (entry === 'API create')
        result = await h.session.execute({
          command: 'create',
          shape: { type: 'text', id: 'newText', x: 0, y: 0, text },
        });
      else if (entry === 'API set')
        result = await h.session.execute({
          command: 'set',
          id: 't',
          attribute: 'text',
          value: text,
        });
      else if (entry === 'CLI create' || entry === 'CLI set') {
        let request;
        try {
          request = h.parser.parse(
            entry === 'CLI create' ? `create text newText 0 0 "${text}"` : `set t text "${text}"`,
          );
        } catch {
          /* invalid create can fail at binding before execute */
        }
        if (request) result = await h.session.execute(request);
      } else {
        h.files.files.set(
          '/memory/limit.svg',
          `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><text id="newText">${text}</text></svg>`,
        );
        result = await h.session.execute({ command: 'read', path: 'limit.svg' });
      }
      expect(result?.ok ?? false, entry).toBe(valid);
      if (valid) {
        const shown = committed(
          await h.session.execute({ command: 'show', id: entry.endsWith('set') ? 't' : 'newText' }),
        );
        expect(shown.data.kind === 'show' && shown.data.shape.text).toBe(text);
      } else {
        expect((await h.session.execute({ command: 'tree' })).status).toEqual(status);
        expect(await semantic(h.session)).toEqual(before);
        committed(await h.session.execute({ command: 'redo' }));
      }
    }
  },
);
it.each([39, 40, 41])(
  'LIM-08 raw attribute L-1/L/L+1 before trim across ID/paint/readonly paths %i',
  async (length) => {
    const valid = length <= 40;
    for (const entry of [
      'API ID',
      'CLI ID',
      'read ID',
      'API paint',
      'CLI paint',
      'read readonly',
    ] as const) {
      const h = await prepare(),
        before = await semantic(h.session),
        status = (await h.session.execute({ command: 'tree' })).status;
      const id = 'n'.repeat(length),
        paint = ' '.repeat(length - 3) + 'RED';
      let result: ExecutionResult | null = null;
      if (entry === 'API ID')
        result = await h.session.execute({ command: 'create', shape: { type: 'g', id } });
      else if (entry === 'CLI ID') {
        try {
          result = await h.session.execute(h.parser.parse(`create g ${id}`)!);
        } catch {
          /* overlong lexical value rejects before execute */
        }
      } else if (entry === 'API paint')
        result = await h.session.execute({
          command: 'set',
          id: 'r1',
          attribute: 'fill',
          value: paint,
        });
      else if (entry === 'CLI paint') {
        try {
          result = await h.session.execute(h.parser.parse(`set r1 fill "${paint}"`)!);
        } catch {
          /* lexer/binder limit */
        }
      } else {
        const element =
          entry === 'read ID'
            ? `<g id="${id}"/>`
            : `<g id="g" font-size="${' '.repeat(length - 2)}16"/>`;
        h.files.files.set(
          '/memory/limit.svg',
          `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">${element}</svg>`,
        );
        result = await h.session.execute({ command: 'read', path: 'limit.svg' });
      }
      expect(result?.ok ?? false, entry).toBe(valid);
      if (!valid) {
        expect((await h.session.execute({ command: 'tree' })).status).toEqual(status);
        expect(await semantic(h.session)).toEqual(before);
        committed(await h.session.execute({ command: 'redo' }));
      } else if (entry.includes('paint')) {
        const shown = committed(await h.session.execute({ command: 'show', id: 'r1' }));
        expect(shown.data.kind === 'show' && shown.data.shape.attributes).toContainEqual({
          name: 'fill',
          value: 'red',
        });
      }
    }
  },
);
