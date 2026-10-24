import { Shape } from './Shape.js';
import { ShapeSchema } from './ShapeSchema.js';
import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
export class LineShape extends Shape {
  static readonly schema = new ShapeSchema(
    'line',
    { x1: 'coordinate', y1: 'coordinate', x2: 'coordinate', y2: 'coordinate' },
    [],
    'empty',
    ['x1', 'y1', 'x2', 'y2'],
    'stroke',
  );
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, LineShape.schema, state);
  }
  override move(tx: EditTransaction, dx: number, dy: number): void {
    this.translate(tx, dx, dy, ['x1', 'x2'], ['y1', 'y2']);
  }
  override scale(tx: EditTransaction, factor: number): void {
    this.multiply(tx, factor);
  }
}
