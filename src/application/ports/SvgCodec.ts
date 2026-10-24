import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { DocumentDescription, ResourceLimits } from '../../domain/values/contracts.js';
import type { Diagnostic } from '../contracts/api.js';
export interface DecodeResult {
  readonly document: SvgDocument;
  readonly warnings: readonly Diagnostic[];
  readonly semanticRepair: boolean;
}
export interface SvgCodec {
  decode(source: string, limits: ResourceLimits): DecodeResult;
  encode(description: DocumentDescription): string;
}
