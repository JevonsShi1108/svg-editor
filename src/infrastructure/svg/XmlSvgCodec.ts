import type { SvgCodec, DecodeResult } from '../../application/ports/SvgCodec.js';
import type { DocumentDescription, ResourceLimits } from '../../domain/values/contracts.js';
import { XmlSvgDecoder } from './XmlSvgDecoder.js';
import { XmlSvgEncoder } from './XmlSvgEncoder.js';
export class XmlSvgCodec implements SvgCodec {
  readonly #encoder = new XmlSvgEncoder();
  readonly #decoder = new XmlSvgDecoder();
  encode(description: DocumentDescription): string {
    return this.#encoder.encode(description);
  }
  decode(source: string, limits: ResourceLimits): DecodeResult {
    return this.#decoder.decode(source, limits);
  }
}
