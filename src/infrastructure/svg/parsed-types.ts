import type { ContentModel } from '../../domain/values/contracts.js';
export interface ParsedElement {
  readonly type: string;
  readonly content: ContentModel;
  readonly attributes: Record<string, string>;
  readonly children: ParsedElement[];
  readonly textParts: string[];
  textScalars: number;
}
