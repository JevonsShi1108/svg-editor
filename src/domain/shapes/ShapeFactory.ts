import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ShapeCreation } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { Shape } from './Shape.js';
import type { ShapeSchema } from './ShapeSchema.js';
import { RectShape } from './RectShape.js';
import { CircleShape } from './CircleShape.js';
import { EllipseShape } from './EllipseShape.js';
import { LineShape } from './LineShape.js';
import { TextShape } from './TextShape.js';
import { GroupShape } from './GroupShape.js';
import { DomainError } from '../errors/DomainError.js';
type Definition = {
  readonly schema: ShapeSchema;
  readonly construct: (id: string, owner: DocumentId, rules: ValueRules, state: OwnState) => Shape;
};
export class ShapeFactory {
  readonly #definitions = new Map<string, Definition>([
    ['circle', { schema: CircleShape.schema, construct: (...args) => new CircleShape(...args) }],
    ['ellipse', { schema: EllipseShape.schema, construct: (...args) => new EllipseShape(...args) }],
    ['line', { schema: LineShape.schema, construct: (...args) => new LineShape(...args) }],
    ['text', { schema: TextShape.schema, construct: (...args) => new TextShape(...args) }],
    ['rect', { schema: RectShape.schema, construct: (...args) => new RectShape(...args) }],
    ['g', { schema: GroupShape.schema, construct: (...args) => new GroupShape(...args) }],
  ]);
  definition(type: string): Definition {
    if (typeof type !== 'string') throw new DomainError('INVALID_VALUE', { field: 'type' });
    const definition = this.#definitions.get(type);
    if (!definition) throw new DomainError('UNKNOWN_SHAPE_TYPE', { type });
    return Object.freeze(definition);
  }
  create(type: string, id: string, owner: DocumentId, rules: ValueRules, state: OwnState): Shape {
    return this.definition(type).construct(id, owner, rules, state);
  }
  validateCreation(creation: ShapeCreation, rules: ValueRules): ShapeCreation {
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
    return Object.freeze({
      type: creation.type,
      id: rules.id(creation.id),
      ...attributes,
      ...(schema.contentModel === 'text' ? { text: rules.text(raw.text) } : {}),
    }) as ShapeCreation;
  }
  fromCreation(creation: ShapeCreation, owner: DocumentId, rules: ValueRules): Shape {
    const value = this.validateCreation(creation, rules);
    const attributes = Object.fromEntries(
      Object.entries(value).filter(([key]) => !['type', 'id', 'text'].includes(key)),
    );
    return this.create(value.type, value.id, owner, rules, {
      attributes,
      ...(this.definition(value.type).schema.contentModel === 'text'
        ? { text: (value as { text: string }).text }
        : {}),
    });
  }
}
