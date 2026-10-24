import { DomainError } from '../errors/DomainError.js';
export class XmlCharacters {
  static isAllowed(cp: number): boolean {
    return (
      cp === 9 ||
      cp === 10 ||
      cp === 13 ||
      (cp >= 0x20 && cp <= 0xd7ff) ||
      (cp >= 0xe000 && cp <= 0xfffd) ||
      (cp >= 0x10000 && cp <= 0x10ffff)
    );
  }
  static validate(value: string): string {
    for (const scalar of value)
      if (!this.isAllowed(scalar.codePointAt(0)!)) throw new DomainError('INVALID_XML_CHARACTER');
    return value;
  }
}
