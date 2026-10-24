export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly details: Readonly<Record<string, string | number>> = {},
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'DomainError';
    Object.freeze(this.details);
  }
}
