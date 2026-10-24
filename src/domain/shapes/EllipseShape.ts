import { Shape } from './Shape.js';
import { ShapeSchema } from './ShapeSchema.js';
import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
export class EllipseShape extends Shape {
  static readonly schema = new ShapeSchema(
    'ellipse',
    { cx: 'coordinate', cy: 'coordinate', rx: 'nonnegative', ry: 'nonnegative' },
    ['rx', 'ry'],
    'empty',
    ['cx', 'cy', 'rx', 'ry'],
    'fill',
  );
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, EllipseShape.schema, state);
  }
  override move(tx: EditTransaction, dx: number, dy: number): void {
    this.translate(tx, dx, dy, ['cx'], ['cy']);
  }
  override scale(tx: EditTransaction, factor: number): void {
    this.multiply(tx, factor);
  }
}
