import type { CanvasSize, OwnState, ResourceLimits } from '../values/contracts.js';
import type { Shape } from '../shapes/Shape.js';
import type { ContainerRef } from '../internal/protocols.js';
import { SvgDocument } from './SvgDocument.js';
import { accessBuilder } from '../internal/storage.js';
export class SvgDocumentBuilder {
  readonly #document: SvgDocument;
  constructor(
    limits: ResourceLimits,
    size: CanvasSize = { width: 800, height: 600 },
    attributes: OwnState['attributes'] = {},
  ) {
    this.#document = new SvgDocument(limits, size, attributes);
  }
  get root(): ContainerRef {
    return this.#document.root;
  }
  append(type: string, id: string, state: OwnState, parent: ContainerRef = this.root): Shape {
    return accessBuilder(this.#document).append(type, id, state, parent);
  }
  build(): SvgDocument {
    accessBuilder(this.#document).finish();
    return this.#document;
  }
}
