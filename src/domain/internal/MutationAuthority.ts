import type { DocumentId } from '../values/contracts.js';
import { DomainError } from '../errors/DomainError.js';
export class MutationAuthority {
  #valid = true;
  readonly #documentId: DocumentId;
  constructor(documentId: DocumentId) {
    this.#documentId = documentId;
  }
  assert(documentId: DocumentId): void {
    if (!this.#valid || documentId !== this.#documentId)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'authority' });
  }
  revoke(): void {
    this.#valid = false;
  }
}
