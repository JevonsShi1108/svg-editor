import type {
  DocumentId,
  NumericRule,
  OwnState,
  AttributeValue,
  OperationFeedback,
  ShapeDescription,
} from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { Shape } from './Shape.js';
import type { ShapeSchema } from './ShapeSchema.js';

export interface ShapePlan {
  readonly type: string;
  readonly id: string;
  readonly state: OwnState;
  readonly children?: readonly ShapePlan[];
}

export interface ShapeProvider {
  readonly name: string;
  readonly schema: ShapeSchema;
  readonly parameters: Readonly<Record<string, NumericRule | 'text'>>;
  readonly xmlTag: string;
  readonly dataKind?: string;
  readonly grouping?: boolean;
  plan(id: string, fields: Readonly<Record<string, AttributeValue>>): ShapePlan;
  construct(id: string, owner: DocumentId, rules: ValueRules, state: OwnState): Shape;
  feedback?(
    operation: string,
    shape: ShapeDescription,
    details: Readonly<Record<string, AttributeValue>>,
  ): OperationFeedback | undefined;
  requiredChildren?(id: string): readonly { readonly id: string; readonly type: string }[];
}
