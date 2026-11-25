import type { SvgCodec, DecodeResult } from '../../application/ports/SvgCodec.js';
import type { DocumentDescription, ResourceLimits } from '../../domain/values/contracts.js';
import { XmlSvgDecoder } from './XmlSvgDecoder.js';
import { XmlSvgEncoder } from './XmlSvgEncoder.js';
import { ShapeFactory } from '../../domain/shapes/ShapeFactory.js';
import type { ShapeRegistry } from '../../domain/shapes/ShapeRegistry.js';
export class XmlSvgCodec implements SvgCodec {
  readonly #encoder: XmlSvgEncoder;
  readonly #decoder: XmlSvgDecoder;
  constructor(shapes: ShapeRegistry = new ShapeFactory()) {
    this.#encoder = new XmlSvgEncoder(shapes);
    this.#decoder = new XmlSvgDecoder(shapes);
  }
  encode(description: DocumentDescription): string {
    return this.#encoder.encode(description);
  }
  decode(source: string, limits: ResourceLimits): DecodeResult {
    return this.#decoder.decode(source, limits);
  }
}
