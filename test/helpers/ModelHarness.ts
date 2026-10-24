import { expect } from 'vitest';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import type {
  ResourceLimits,
  DocumentDescription,
  TreeNodeDescription,
} from '../../src/domain/values/contracts.js';
import type { SessionExecutor } from '../../src/application/contracts/api.js';
import { ControlledFileStore } from './ControlledFileStore.js';
import { ReferenceModel } from '../model/ReferenceModel.js';
import { initialWithFiles } from '../model/fixtures.js';
import type {
  ModelStep,
  ModelContainer,
  ComparableDocument,
  ComparableTree,
} from '../model/types.js';
import { parseXml10 } from './parse-xml10.js';
export class ModelHarness {
  readonly model: ModelContainer;
  readonly reference: ReferenceModel;
  readonly files = new ControlledFileStore();
  readonly session: SessionExecutor;
  readonly limits: ResourceLimits;
  readonly trace: ModelStep[] = [];
  readonly coverage: Record<string, number> = {};
  failure: unknown = null;
  #previous: { dto: DocumentDescription; copy: DocumentDescription } | null = null;
  constructor(maxNodes = 30) {
    this.limits = {
      maxSvgBytes: 1024 * 1024,
      maxNodeCount: maxNodes,
      maxTreeDepth: 5,
      maxTextLength: 1000,
      maxAttributeLength: 100,
    };
    this.reference = new ReferenceModel(maxNodes, 5);
    this.model = { state: initialWithFiles(this.reference) };
    this.session = new EditorSession({
      commands: new CommandCatalog(this.limits),
      codec: new XmlSvgCodec(),
      files: this.files,
      limits: this.limits,
    });
    const root = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">';
    this.files.files.set(
      '/memory/a.svg',
      `${root}<rect id="r1" x="10" y="20" width="30" height="40"/></svg>`,
    );
    this.files.files.set('/memory/anonymous.svg', `${root}<rect width="30" height="40"/></svg>`);
    this.files.files.set('/memory/bad.svg', 'not-svg');
  }
  count(category: string): void {
    this.coverage[category] = (this.coverage[category] ?? 0) + 1;
  }
  async run(step: ModelStep): Promise<void> {
    this.trace.push(structuredClone(step));
    const prediction = this.reference.step(this.model.state, step),
      before = this.reference.status(this.model.state);
    this.files.outcome = step.outcome ?? 'committed';
    this.files.physicalIndeterminate = step.physical ?? false;
    const writeCount = this.files.writeCalls.length;
    const beforeFiles = step.request.command === 'save' ? new Map(this.files.files) : null;
    const actual = await this.session.execute(step.request, step.options);
    let observed: ComparableDocument | null = null;
    try {
      expect(actual.ok).toBe(prediction.result.ok);
      if (!actual.ok) {
        expect(actual.error.code).toBe(prediction.result.error);
        expect(actual.effect).toBe(prediction.result.effect);
        this.count(`error:${actual.error.code}`);
      } else {
        expect(actual.mode).toBe(prediction.result.mode);
        expect(actual.warnings).toEqual(prediction.result.warnings);
        if (actual.mode === 'commit') {
          expect(actual.contentChanged).toBe(prediction.result.contentChanged);
          expect(actual.sessionChanged).toBe(prediction.result.sessionChanged);
          this.count(actual.contentChanged ? 'change' : 'no-op-or-query');
          if (
            !actual.contentChanged &&
            [
              'create',
              'delete',
              'move',
              'scale',
              'set',
              'group',
              'ungroup',
              'addto',
              'front',
              'back',
            ].includes(step.request.command)
          ) {
            this.count('no-op');
            if (actual.sessionChanged) this.count('no-op:barrier-release');
          }
        } else {
          expect(actual.wouldChange).toBe(prediction.result.wouldChange);
          this.count('dry-run');
        }
      }
      expect(actual.status).toEqual(this.reference.status(prediction.state));
      if (this.#previous) expect(this.#previous.dto).toEqual(this.#previous.copy);
      if (prediction.state.document) {
        const query = await this.session.execute({ command: 'tree' });
        if (
          !query.ok ||
          query.mode !== 'commit' ||
          query.data.kind !== 'tree' ||
          !query.data.document
        )
          throw new Error('No complete public tree');
        observed = this.normalize(query.data.document);
        expect(observed).toEqual(this.reference.describe(prediction.state.document));
        const ids = new Set<string>();
        const visit = (node: ComparableTree, depth: number) => {
          expect(ids.has(node.id)).toBe(false);
          ids.add(node.id);
          expect(depth).toBeLessThanOrEqual(this.limits.maxTreeDepth);
          if (node.type !== 'g') expect(node.children).toEqual([]);
          node.children.forEach((n) => visit(n, depth + 1));
        };
        observed.children.forEach((n) => visit(n, 1));
        expect(ids.size).toBe(Object.keys(prediction.state.document.nodes).length);
        expect(query.status).toEqual(actual.status);
        this.#previous = { dto: query.data.document, copy: structuredClone(query.data.document) };
      }
      if (beforeFiles && !actual.ok && (actual.effect !== 'external-unknown' || !step.physical))
        expect([...this.files.files]).toEqual([...beforeFiles]);
      if (
        (step.request.command === 'save' && actual.ok) ||
        (step.request.command === 'save' &&
          !actual.ok &&
          actual.effect === 'external-unknown' &&
          step.outcome === 'indeterminate' &&
          step.physical)
      ) {
        const target =
          step.request.command === 'save' ? (step.request.path ?? before.currentPath!) : '';
        const path = this.reference.resolve(target),
          file = prediction.state.files[path];
        expect(this.xmlDocument(this.files.files.get(path)!)).toEqual(
          this.reference.describe(file!.document!),
        );
      }
      this.count(`command:${step.request.command}`);
      if (before.history.redoCount) this.count('before:redo');
      if (before.history.barrier) this.count(`before:barrier:${before.history.barrier}`);
      if (step.outcome && this.files.writeCalls.length > writeCount)
        this.count(`save:${step.outcome}:${step.physical ?? false}`);
      if (actual.ok && actual.warnings.length) this.count('read:semantic-repair');
      this.model.state = prediction.state;
    } catch (error) {
      this.failure = {
        step: this.trace.length,
        request: step,
        predicted: prediction.result,
        actual,
        actualDocument: observed,
        modelStatus: this.reference.status(prediction.state),
        expectedDocument: prediction.state.document
          ? this.reference.describe(prediction.state.document)
          : null,
        reason: String(error),
      };
      throw error;
    }
  }
  private normalize(d: DocumentDescription): ComparableDocument {
    const tree = (n: TreeNodeDescription): ComparableTree => ({
      type: n.shape.type,
      id: n.shape.id,
      attributes: Object.fromEntries(n.shape.attributes.map((a) => [a.name, a.value])),
      ...(n.shape.text === undefined ? {} : { text: n.shape.text }),
      children: n.children.map(tree),
    });
    return {
      size: { ...d.size },
      attributes: Object.fromEntries(d.attributes.map((a) => [a.name, a.value])),
      children: d.children.map(tree),
    };
  }
  private xmlDocument(source: string): ComparableDocument {
    const root = parseXml10(source).documentElement!;
    const numeric = new Set([
      'x',
      'y',
      'width',
      'height',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'x1',
      'y1',
      'x2',
      'y2',
      'stroke-width',
      'font-size',
    ]);
    const attrs = (element: typeof root) =>
      Object.fromEntries(
        Array.from(element.attributes)
          .filter(
            (a) =>
              !['xmlns', 'id'].includes(a.name) &&
              (element !== root || !['width', 'height', 'viewBox'].includes(a.name)),
          )
          .map((a) => [a.name, numeric.has(a.name) ? Number(a.value) : a.value]),
      );
    const tree = (element: typeof root): ComparableTree => ({
      type: element.tagName,
      id: element.getAttribute('id')!,
      attributes: attrs(element),
      ...(element.tagName === 'text' ? { text: element.textContent ?? '' } : {}),
      children: Array.from(element.childNodes)
        .filter((n) => n.nodeType === 1)
        .map((n) => tree(n as typeof root)),
    });
    return {
      size: {
        width: Number(root.getAttribute('width')),
        height: Number(root.getAttribute('height')),
      },
      attributes: attrs(root),
      children: Array.from(root.childNodes)
        .filter((n) => n.nodeType === 1)
        .map((n) => tree(n as typeof root)),
    };
  }
}
