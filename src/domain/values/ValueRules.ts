import { DomainError } from '../errors/DomainError.js';
import type { CanvasSize, NumericRule, ResourceLimits } from './contracts.js';
import { Paint } from './Paint.js';
import { XmlCharacters } from './XmlCharacters.js';

export class ValueRules {
  readonly #limits: ResourceLimits;
  constructor(limits: ResourceLimits) {
    const keys = [
      'maxSvgBytes',
      'maxNodeCount',
      'maxTreeDepth',
      'maxTextLength',
      'maxAttributeLength',
    ];
    if (
      !limits ||
      typeof limits !== 'object' ||
      Object.keys(limits).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(limits, key))
    )
      throw new DomainError('INVALID_LIMITS');
    for (const value of Object.values(limits)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new DomainError('INVALID_LIMITS');
    }
    this.#limits = Object.freeze({ ...limits });
  }
  get limits(): ResourceLimits {
    return this.#limits;
  }
  static trim(value: string): string {
    return value.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, '');
  }
  number(value: unknown, rule: NumericRule = 'coordinate', field = 'number'): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (rule === 'positive' && value <= 0) ||
      (rule === 'nonnegative' && value < 0)
    ) {
      throw new DomainError(field === 'factor' ? 'INVALID_SCALE' : 'INVALID_VALUE', { field });
    }
    return value === 0 ? 0 : value;
  }
  numeric(value: unknown, rule: NumericRule = 'coordinate', field = 'number', px = false): number {
    if (typeof value === 'number') return this.number(value, rule, field);
    this.attribute(value);
    let token = ValueRules.trim(value as string);
    if (px && token.endsWith('px')) token = token.slice(0, -2);
    if (!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(token)) {
      throw new DomainError('INVALID_VALUE', { field });
    }
    const parsed = Number(token);
    if (parsed === 0 && /[1-9]/.test(token.split(/[eE]/)[0]!))
      throw new DomainError('NUMERIC_UNDERFLOW', { field });
    return this.number(parsed, rule, field);
  }
  product(value: number, factor: number, rule: NumericRule = 'coordinate'): number {
    this.number(factor, 'positive', 'factor');
    const result = value * factor;
    if (value !== 0 && result === 0) throw new DomainError('NUMERIC_UNDERFLOW');
    return this.number(result, rule);
  }
  size(size: CanvasSize): CanvasSize {
    if (size === null || typeof size !== 'object')
      throw new DomainError('INVALID_VALUE', { field: 'size' });
    return Object.freeze({
      width: this.number(size.width, 'positive', 'width'),
      height: this.number(size.height, 'positive', 'height'),
    });
  }
  attribute(value: unknown): string {
    return this.string(value, this.#limits.maxAttributeLength, 'attribute');
  }
  text(value: unknown): string {
    return this.string(value, this.#limits.maxTextLength, 'text');
  }
  id(value: unknown): string {
    const id = this.attribute(value);
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id))
      throw new DomainError('INVALID_VALUE', { field: 'id' });
    return id;
  }
  paint(value: unknown): string {
    return Paint.parse(this.attribute(value));
  }
  retained(name: string, value: unknown, px = false): string | number {
    this.attribute(value);
    if (name === 'fill' || name === 'stroke') return this.paint(value);
    if (name === 'stroke-width' || name === 'font-size')
      return this.numeric(value, 'nonnegative', name, px);
    if (name === 'text-anchor') {
      const token = ValueRules.trim(value as string);
      if (!['start', 'middle', 'end'].includes(token))
        throw new DomainError('INVALID_VALUE', { field: name });
      return token;
    }
    if (name === 'data-kind') return this.id(value);
    throw new DomainError('UNKNOWN_ATTRIBUTE', { attribute: name });
  }
  private string(value: unknown, max: number, field: string): string {
    if (typeof value !== 'string') throw new DomainError('INVALID_VALUE', { field });
    let count = 0;
    for (const scalar of value) {
      const cp = scalar.codePointAt(0)!;
      if (!XmlCharacters.isAllowed(cp)) {
        throw new DomainError('INVALID_XML_CHARACTER', { field });
      }
      if (++count > max) throw new DomainError('RESOURCE_LIMIT', { field });
    }
    return value;
  }
}
