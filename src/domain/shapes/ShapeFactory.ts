import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ShapeCreation } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { Shape } from './Shape.js';
import type { ShapeSchema } from './ShapeSchema.js';
import { RectShape } from './RectShape.js';
import { GroupShape } from './GroupShape.js';
import { DomainError } from '../errors/DomainError.js';
type Definition = {
  readonly schema: ShapeSchema;
  readonly construct: (id: string, owner: DocumentId, rules: ValueRules, state: OwnState) => Shape;
};
export class ShapeFactory {
  readonly #definitions = new Map<string, Definition>([
    ['rect', { schema: RectShape.schema, construct: (...args) => new RectShape(...args) }],
    ['g', { schema: GroupShape.schema, construct: (...args) => new GroupShape(...args) }],
  ]);
  definition(type: string): Definition {
    const definition = this.#definitions.get(type);
    if (!definition) throw new DomainError('UNKNOWN_SHAPE_TYPE', { type });
    return definition;
  }
  create(type: string, id: string, owner: DocumentId, rules: ValueRules, state: OwnState): Shape {
    return this.definition(type).construct(id, owner, rules, state);
  }
  fromCreation(creation: ShapeCreation, owner: DocumentId, rules: ValueRules): Shape {
    if (!creation || typeof creation !== 'object') throw new DomainError('INVALID_VALUE');
    const schema = this.definition(creation.type).schema;
    const raw = creation as unknown as Record<string, unknown>;
    const allowed = new Set([
      'type',
      'id',
      ...schema.creationFields,
      ...(schema.optionalPaint ? [schema.optionalPaint] : []),
    ]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) throw new DomainError('INVALID_VALUE');
    const attributes: Record<string, string | number> = {};
    for (const field of schema.creationFields) {
      if (field === 'text') continue;
      attributes[field] = rules.number(raw[field], schema.geometry[field], field);
    }
    if (schema.optionalPaint && raw[schema.optionalPaint] !== undefined)
      attributes[schema.optionalPaint] = rules.paint(raw[schema.optionalPaint]);
    return this.create(creation.type, rules.id(creation.id), owner, rules, {
      attributes,
      ...(schema.contentModel === 'text' ? { text: rules.text(raw.text) } : {}),
    });
  }
}
