import { it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { NodeFileStore } from '../../src/infrastructure/files/NodeFileStore.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { ReferenceModel } from '../model/ReferenceModel.js';
import { initialWithFiles } from '../model/fixtures.js';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
import type { TreeNodeDescription } from '../../src/domain/values/contracts.js';
import type { ComparableTree } from '../model/types.js';
it(
  'MODEL-01/08 separate short sequences exercise real Codec + NodeFileStore in actual temporary directories',
  () =>
    PropertyRunner.checkAsync(
      'MODEL-IO',
      fc.asyncProperty(fc.integer({ min: -20, max: 20 }), async (dx) => {
        const temp = await TempDirectory.create();
        try {
          await fs.writeFile(
            path.join(temp.path, 'a.svg'),
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect id="r1" x="10" y="20" width="30" height="40"/></svg>',
          );
          const reference = new ReferenceModel(),
            catalog = new CommandCatalog(defaultLimits);
          let state = initialWithFiles(reference);
          const session = new EditorSession({
            commands: catalog,
            codec: new XmlSvgCodec(),
            files: new NodeFileStore(temp.path),
            limits: defaultLimits,
          });
          const sequence: CommandRequest[] = [
            { command: 'read', path: 'a.svg' },
            { command: 'move', id: 'r1', dx, dy: 2 },
            { command: 'save', path: '中文 空格.svg' },
            { command: 'undo' },
            { command: 'read', path: '中文 空格.svg' },
            { command: 'move', id: 'r1', dx: 1, dy: 0 },
            { command: 'undo' },
            { command: 'save' },
          ];
          for (const request of sequence) {
            const predicted = reference.step(state, { request }),
              actual = await session.execute(request);
            state = predicted.state;
            expect(actual.ok).toBe(predicted.result.ok);
            if (!actual.ok) expect(actual.error.code).toBe(predicted.result.error);
            const status = reference.status(state);
            expect(actual.status).toEqual({
              ...status,
              currentPath: status.currentPath
                ? path.join(temp.path, path.basename(status.currentPath))
                : null,
            });
            const query = await session.execute({ command: 'tree' });
            if (
              !query.ok ||
              query.mode !== 'commit' ||
              query.data.kind !== 'tree' ||
              !query.data.document
            )
              throw new Error('Missing document');
            const tree = (n: TreeNodeDescription): ComparableTree => ({
              id: n.shape.id,
              type: n.shape.type,
              attributes: Object.fromEntries(n.shape.attributes.map((a) => [a.name, a.value])),
              ...(n.shape.text === undefined ? {} : { text: n.shape.text }),
              children: n.children.map(tree),
            });
            expect({
              size: query.data.document.size,
              attributes: Object.fromEntries(
                query.data.document.attributes.map((a) => [a.name, a.value]),
              ),
              children: query.data.document.children.map(tree),
            }).toEqual(reference.describe(state.document!));
          }
          expect((await fs.readdir(temp.path)).sort()).toEqual(['a.svg', '中文 空格.svg'].sort());
          expect(await fs.readFile(path.join(temp.path, '中文 空格.svg'), 'utf8')).toContain(
            `x="${10 + dx}"`,
          );
        } finally {
          await temp.close();
        }
      }),
    ),
  180000,
);
