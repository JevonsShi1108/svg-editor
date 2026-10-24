export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly details: Readonly<Record<string, string | number>> = {},
  ) {
    super(code);
    this.name = 'DomainError';
    Object.freeze(this.details);
  }
}
