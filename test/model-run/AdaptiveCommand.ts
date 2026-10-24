import type { AsyncCommand } from 'fast-check';
import type { CommandRequest } from '../../src/application/contracts/api.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';
import type { ModelContainer, ModelStep } from '../model/types.js';
import type { ModelHarness } from '../helpers/ModelHarness.js';
export interface Selection {
  kind: number;
  a: number;
  b: number;
  value: number;
  shape: number;
}
export class AdaptiveCommand implements AsyncCommand<ModelContainer, ModelHarness> {
  constructor(readonly selection: Selection) {}
  check(_model: Readonly<ModelContainer>): boolean {
    return true;
  }
  async run(model: ModelContainer, real: ModelHarness): Promise<void> {
    if (this.selection.kind === 16) real.count('deliberate-invalid:executed');
    await real.run(this.resolve(model, real.reference.maxNodes));
  }
  resolve(model: ModelContainer, maxNodes: number): ModelStep {
    const { kind, a, b, value, shape } = this.selection,
      s = model.state,
      d = s.document;
    const nodes = d ? Object.values(d.nodes) : [],
      pick = nodes[a % nodes.length],
      other = nodes[b % nodes.length],
      groups = nodes.filter((n) => n.type === 'g'),
      parent = groups[b % groups.length];
    const id = pick?.id ?? 'missing';
    let request: CommandRequest;
    const newId = `n${a % maxNodes}`;
    const creations: ShapeCreation[] = [
      { type: 'rect', id: newId, x: value, y: -value, width: 3, height: 4 },
      { type: 'circle', id: newId, cx: value, cy: 2, r: 3 },
      { type: 'ellipse', id: newId, cx: value, cy: 2, rx: 3, ry: 4 },
      { type: 'line', id: newId, x1: value, y1: 2, x2: 3, y2: 4, stroke: 'black' },
      {
        type: 'text',
        id: newId,
        x: value,
        y: 2,
        text: ['', ' a  in # 中文🙂 ', '<&>\r\n\t'][b % 3]!,
      },
      { type: 'g', id: newId },
    ];
    switch (kind) {
      case 0:
      case 1:
        request = {
          command: 'create',
          shape: creations[shape % 6]!,
          ...(parent && b % 2 ? { parentId: parent.id } : {}),
        };
        break;
      case 2:
      case 3:
        request = { command: 'move', id, dx: value, dy: -value };
        break;
      case 4:
        request = { command: 'scale', id, factor: [0.5, 1, 2, 0, -1][b % 5]! };
        break;
      case 5:
      case 6: {
        const fields: Record<string, string[]> = {
          rect: ['x', 'y', 'width', 'height'],
          circle: ['cx', 'cy', 'r'],
          ellipse: ['cx', 'cy', 'rx', 'ry'],
          line: ['x1', 'y1', 'x2', 'y2'],
          text: ['x', 'y', 'text'],
          g: [],
        };
        const choices = [...(fields[pick?.type ?? 'g'] ?? []), 'fill', 'stroke', 'stroke-width'],
          attribute = choices[b % choices.length]!;
        request = {
          command: 'set',
          id,
          attribute,
          value:
            attribute === 'text'
              ? ' a  in # 🙂 '
              : ['fill', 'stroke'].includes(attribute)
                ? ['RED', '#AbC', 'none'][shape % 3]!
                : Math.abs(value),
        };
        break;
      }
      case 7:
        request = { command: 'group', newId: `G${a % maxNodes}`, ids: [other?.id ?? 'absent', id] };
        break;
      case 8:
        request = { command: 'ungroup', id };
        break;
      case 9:
        request = { command: 'addto', id, containerId: parent?.id ?? other?.id ?? 'absent' };
        break;
      case 10:
        request = { command: 'front', id };
        break;
      case 11:
        request = { command: 'back', id };
        break;
      case 12:
        request = { command: 'delete', id };
        break;
      case 13:
        request = { command: 'undo' };
        break;
      case 14:
        request = { command: 'redo' };
        break;
      case 15:
        request = { command: 'move', id, dx: 0, dy: 0 };
        break;
      case 16:
        request = { command: 'scale', id, factor: 0 };
        break; // Deliberately invalid, check never filters it.
      case 17:
        request = { command: 'save', ...(a % 3 === 0 ? {} : { path: 'out.svg' }) };
        return {
          request,
          outcome: ['committed', 'not-committed', 'indeterminate'][b % 3] as ModelStep['outcome'] &
            string,
          physical: shape % 2 === 0,
        };
      case 18:
        request = {
          command: 'read',
          path: ['a.svg', 'anonymous.svg', 'bad.svg', 'absent.svg', 'out.svg'][a % 5]!,
        };
        break;
      case 19:
        request = {
          command: 'canvas',
          size:
            a % 3 === 0
              ? { width: d?.width ?? 800, height: d?.height ?? 600 }
              : { width: a % 3 === 1 ? 0 : 400 + Math.abs(value), height: 300 },
        };
        break;
      case 20:
        request = { command: 'init', ...(a % 2 ? { size: { width: 400, height: 300 } } : {}) };
        break;
      case 21:
        request = { command: 'tree', ...(a % 2 ? { id } : {}) };
        break;
      case 22:
        request = { command: 'show', id };
        break;
      case 23:
        request = { command: 'help' };
        break;
      default:
        request = { command: 'set', id, attribute: 'bogus', value: 1 };
    }
    const edit = [
      'create',
      'move',
      'scale',
      'set',
      'group',
      'ungroup',
      'addto',
      'front',
      'back',
      'delete',
    ].includes(request.command);
    return { request, ...(edit && a % 5 === 0 ? { options: { mode: 'dry-run' as const } } : {}) };
  }
  toString(): string {
    return JSON.stringify(this.selection);
  }
}
