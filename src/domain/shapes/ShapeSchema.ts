import type { ContentModel, NumericRule, OwnState, AttributeValue } from '../values/contracts.js';
import { ValueRules } from '../values/ValueRules.js';
import { DomainError } from '../errors/DomainError.js';
export class ShapeSchema {
  get allowedAttributes(): readonly string[] {
    return Object.freeze([
      ...Object.keys(this.geometry),
      'fill',
      'stroke',
      'stroke-width',
      'font-size',
      'text-anchor',
      ...(this.allowsMetadata ? ['data-kind'] : []),
    ]);
  }
  readonly geometry: Readonly<Record<string, NumericRule>>;
  readonly required: readonly string[];
  constructor(
    readonly type: string,
    geometry: Readonly<Record<string, NumericRule>>,
    required: readonly string[],
    readonly contentModel: ContentModel,
    readonly creationFields: readonly string[],
    readonly optionalPaint?: 'fill' | 'stroke',
    readonly allowsMetadata = false,
  ) {
    this.geometry = Object.freeze({ ...geometry });
    this.required = Object.freeze([...required]);
    Object.freeze(this.creationFields);
    Object.freeze(this);
  }
  validate(rules: ValueRules, state: OwnState, svg = false): OwnState {
    const attributes: Record<string, AttributeValue> = {};
    for (const [name, value] of Object.entries(state.attributes)) {
      const numericRule = Object.hasOwn(this.geometry, name) ? this.geometry[name] : undefined;
      if (numericRule) attributes[name] = rules.numeric(value, numericRule, name, svg);
      else if (['fill', 'stroke'].includes(name)) attributes[name] = rules.paint(value);
      else if (['stroke-width', 'font-size'].includes(name))
        attributes[name] = rules.numeric(value, 'nonnegative', name, svg);
      else if (name === 'text-anchor' || (name === 'data-kind' && this.allowsMetadata))
        attributes[name] = rules.retained(name, value, svg);
      else throw new DomainError('UNKNOWN_ATTRIBUTE', { attribute: name });
    }
    for (const field of this.required)
      if (!Object.hasOwn(attributes, field)) throw new DomainError('INVALID_VALUE', { field });
    if (this.contentModel !== 'text' && state.text !== undefined)
      throw new DomainError('INVALID_VALUE', { field: 'text' });
    return Object.freeze({
      attributes: Object.freeze(attributes),
      ...(this.contentModel === 'text' ? { text: rules.text(state.text ?? '') } : {}),
    });
  }
  set(rules: ValueRules, state: OwnState, attribute: string, value: unknown): OwnState {
    if (attribute === 'text' && this.contentModel === 'text')
      return Object.freeze({ ...state, text: rules.text(value) });
    let next: AttributeValue;
    if (Object.hasOwn(this.geometry, attribute))
      next = rules.numeric(value, this.geometry[attribute], attribute);
    else if (attribute === 'fill' || attribute === 'stroke') next = rules.paint(value);
    else if (attribute === 'stroke-width') next = rules.numeric(value, 'nonnegative', attribute);
    else throw new DomainError('UNKNOWN_ATTRIBUTE', { attribute });
    return Object.freeze({
      ...state,
      attributes: Object.freeze({ ...state.attributes, [attribute]: next }),
    });
  }
}
