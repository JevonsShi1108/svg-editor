import type { ShapeProvider, ShapePlan } from './ShapeProvider.js';
import type { ShapeSchema } from './ShapeSchema.js';
import type { Shape } from './Shape.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { AttributeValue, DocumentId, NumericRule, OwnState } from '../values/contracts.js';

type NativeShape = {
  readonly schema: ShapeSchema;
  new (id: string, owner: DocumentId, rules: ValueRules, state: OwnState): Shape;
};

export class NativeShapeProvider implements ShapeProvider {
  readonly parameters: Readonly<Record<string, NumericRule | 'text'>>;
  readonly schema: ShapeSchema;
  constructor(
    readonly name: string,
    private readonly implementation: NativeShape,
    readonly grouping = false,
  ) {
    this.schema = implementation.schema;
    this.parameters = Object.freeze(
      Object.fromEntries(
        this.schema.creationFields.map(
          (field) => [field, this.schema.geometry[field] ?? 'text'] as const,
        ),
      ),
    );
  }
  get xmlTag() {
    return this.name;
  }
  plan(id: string, fields: Readonly<Record<string, AttributeValue>>): ShapePlan {
    const { text, ...attributes } = fields;
    return {
      type: this.name,
      id,
      state: { attributes, ...(typeof text === 'string' ? { text } : {}) },
    };
  }
  construct(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    return new this.implementation(id, owner, rules, state);
  }
}
