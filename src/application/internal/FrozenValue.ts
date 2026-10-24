export class FrozenValue {
  static freeze<T>(value: T, seen = new WeakSet<object>()): T {
    if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value);
      for (const child of Object.values(value)) this.freeze(child, seen);
      if (!Object.isFrozen(value)) Object.freeze(value);
    }
    return value;
  }
  static copy<T>(value: T): T {
    return this.freeze(structuredClone(value));
  }
}
