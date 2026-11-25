import type { AttributeValue, DocumentId, OwnState, ShapeCreation } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { ShapeProvider } from './ShapeProvider.js';
import { DomainError } from '../errors/DomainError.js';

export class ShapeRegistry {
  readonly #types = new Map<string, ShapeProvider>();
  readonly #tags = new Map<string, ShapeProvider>();
  readonly #markedTags = new Map<string, ShapeProvider>();
  readonly grouping: ShapeProvider | undefined;

  constructor(providers: readonly ShapeProvider[]) {
    for (const p of providers) {
      const tags = p.dataKind === undefined ? this.#tags : this.#markedTags;
      const key = p.dataKind === undefined ? p.xmlTag : p.xmlTag + '/' + p.dataKind;
      if (this.#types.has(p.name) || tags.has(key) || (p.grouping && this.grouping))
        throw new DomainError('DUPLICATE_REGISTRATION', { category: 'shapes', name: p.name });
      if (p.name !== p.schema.type || !/^[A-Za-z_][\w.-]*$/.test(p.xmlTag))
        throw new DomainError('INVALID_VALUE', { field: 'shape provider' });
      this.#types.set(p.name, p);
      tags.set(key, p);
      if (p.grouping) this.grouping = p;
    }
  }

  definition(type: string): ShapeProvider {
    if (typeof type !== 'string') throw new DomainError('INVALID_VALUE', { field: 'type' });
    const provider = this.#types.get(type);
    if (!provider) throw new DomainError('UNKNOWN_SHAPE_TYPE', { type });
    return provider;
  }

  fromTag(tag: string, kind?: string): ShapeProvider {
    const provider =
      (kind === undefined ? undefined : this.#markedTags.get(tag + '/' + kind)) ??
      this.#tags.get(tag);
    if (!provider) throw new DomainError('UNSUPPORTED_SVG');
    return provider;
  }

  create(type: string, id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    const provider = this.definition(type);
    const shape = provider.construct(id, owner, rules, state);
    if (shape.id !== id || shape.ownerDocumentId !== owner || shape.schema !== provider.schema)
      throw new DomainError('INVALID_VALUE', { field: 'shape provider result' });
    return shape;
  }

  validateCreation(value: unknown, rules: ValueRules): ShapeCreation {
    if (!value || typeof value !== 'object') throw new DomainError('INVALID_VALUE');
    const raw = value as Record<string, unknown>;
    const provider = this.definition(raw.type as string);
    const paint = provider.schema.optionalPaint;
    const allowed = new Set([
      'id',
      'type',
      ...Object.keys(provider.parameters),
      ...(paint ? [paint] : []),
    ]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) throw new DomainError('INVALID_VALUE');
    const fields: Record<string, AttributeValue> = {};
    for (const [name, rule] of Object.entries(provider.parameters)) {
      fields[name] = rule === 'text' ? rules.text(raw[name]) : rules.number(raw[name], rule, name);
    }
    if (paint && raw[paint] !== undefined) fields[paint] = rules.paint(raw[paint]);
    return Object.freeze({ type: provider.name, id: rules.id(raw.id), ...fields }) as ShapeCreation;
  }

  plan(creation: ShapeCreation, rules: ValueRules) {
    const { type, id, ...fields } = this.validateCreation(creation, rules);
    const plan = this.definition(type).plan(id, Object.freeze(fields));
    if (plan.type !== type || plan.id !== id)
      throw new DomainError('INVALID_VALUE', { field: 'creation plan' });
    return plan;
  }
}
