import { Shape } from './Shape.js';
import { ShapeSchema } from './ShapeSchema.js';
import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
export class TextShape extends Shape {
  static readonly schema = new ShapeSchema(
    'text',
    { x: 'coordinate', y: 'coordinate' },
    [],
    'text',
    ['x', 'y', 'text'],
  );
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, TextShape.schema, state);
  }
  override move(tx: EditTransaction, dx: number, dy: number): void {
    this.translate(tx, dx, dy, ['x'], ['y']);
  }
  override scale(tx: EditTransaction, factor: number): void {
    this.multiply(tx, factor);
  }
}
