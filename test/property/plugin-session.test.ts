import { expect, it } from 'vitest';
import fc from 'fast-check';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import { BoxProvider } from '../../plugins/shape-box/src/BoxProvider.js';
import { BoxAttributes } from '../../plugins/shape-box/src/BoxAttributes.js';
import { ModifiedStar } from '../../plugins/tree-star/src/ModifiedStar.js';
import { BoxTypeLabel } from '../../plugins/box-label/src/BoxTypeLabel.js';
import { StatsCommand } from '../../plugins/stats/src/StatsCommand.js';
import { ShapeRegistry } from '../../src/domain/shapes/ShapeRegistry.js';
import { builtinShapes } from '../../src/domain/shapes/builtin-shapes.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { AttributeDispatch } from '../../src/application/commands/AttributeDispatch.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { PluginCommandBinding } from '../../src/application/commands/PluginCommandBinding.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { ControlledFileStore } from '../helpers/ControlledFileStore.js';
it('P2-PROP-01 box values, history, saved content and failing commands match an independent snapshot model', async () => {
  const steps = fc.array(
    fc.constantFrom(
      'A',
      'B',
      'red',
      'blue',
      'undo',
      'redo',
      'save',
      'fail-save',
      'protected',
      'stats',
    ),
    { minLength: 3, maxLength: 24 },
  );
  await PropertyRunner.checkAsync(
    'P2-PROP-01',
    fc.asyncProperty(steps, async (actions) => {
      const shapes = new ShapeRegistry([...builtinShapes, new BoxProvider()]);
      const commands = new CommandCatalog(
        defaultLimits,
        shapes,
        [new PluginCommandBinding(new StatsCommand(), shapes)],
        new AttributeDispatch([new BoxAttributes()]),
      );
      const files = new ControlledFileStore(),
        session = new EditorSession({
          files,
          commands,
          shapes,
          codec: new XmlSvgCodec(shapes),
          limits: defaultLimits,
          decorators: [new BoxTypeLabel(), new ModifiedStar()],
        });
      const parser = new CliParser(commands),
        presenter = new TextPresenter(),
        run = (s: string) => session.execute(parser.parse(s)!);
      for (const s of ['init', 'create box n 0 0 10 20 A', 'save n.svg'])
        expect((await run(s)).ok).toBe(true);
      let current = { label: 'A', fill: '#4a90d9' },
        saved = current;
      const past: (typeof current)[] = [],
        future: (typeof current)[] = [];
      for (const step of actions) {
        let line: string,
          success = true;
        if (['A', 'B', 'red', 'blue'].includes(step)) {
          const isLabel = step === 'A' || step === 'B',
            key = isLabel ? 'label' : 'fill';
          line = 'set n ' + key + ' ' + step;
          const next = { ...current, [key]: step };
          if (current[key] !== step) {
            past.push(current);
            current = next;
            future.length = 0;
          }
        } else if (step === 'save' || step === 'fail-save') {
          line = 'save';
          success = step === 'save';
          files.outcome = success ? 'committed' : 'not-committed';
          if (success) {
            past.length = 0;
            future.length = 0;
            saved = current;
          }
        } else if (step === 'undo' || step === 'redo') {
          line = step;
          const from = step === 'undo' ? past : future,
            to = step === 'undo' ? future : past;
          const previous = from.pop();
          success = previous !== undefined;
          if (previous) {
            to.push(current);
            current = previous;
          }
        } else if (step === 'protected') {
          line = 'delete n-label';
          success = false;
        } else line = 'stats';
        const result = await run(line);
        expect(result.ok).toBe(success);
        if (line === 'stats')
          expect(presenter.render(result).stdout).toBe(
            'rect: 1  text: 1  (total 2, containers 1)\n',
          );
        expect(result.status.history.undoCount).toBe(past.length);
        expect(result.status.history.redoCount).toBe(future.length);
        const tree = presenter
          .render(await run('tree n'))
          .stdout.trimEnd()
          .split('\n');
        const fillDirty = current.fill !== saved.fill,
          labelDirty = current.label !== saved.label;
        expect(tree[0]).toBe('g#n (box)' + (fillDirty || labelDirty ? ' *' : ''));
        expect(tree[1]).toContain('fill=' + current.fill + (fillDirty ? ' *' : ''));
        expect(tree[1]?.endsWith(' *')).toBe(fillDirty);
        expect(tree[2]).toContain(JSON.stringify(current.label));
        expect(tree[2]?.endsWith(' *')).toBe(labelDirty);
      }
    }),
  );
}, 120000);
