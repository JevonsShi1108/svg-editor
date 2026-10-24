declare const documentBrand: unique symbol;
export type DocumentId = symbol & { readonly [documentBrand]: true };
export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}
export interface ResourceLimits {
  readonly maxSvgBytes: number;
  readonly maxNodeCount: number;
  readonly maxTreeDepth: number;
  readonly maxTextLength: number;
  readonly maxAttributeLength: number;
}
export type AttributeValue = string | number;
export interface AttributeDescription {
  readonly name: string;
  readonly value: AttributeValue;
}
export interface DisplayField {
  readonly label: string;
  readonly value: AttributeValue;
}
export interface OwnStateDescription {
  readonly attributes: readonly AttributeDescription[];
  readonly text?: string;
}
export interface ShapeDescription extends OwnStateDescription {
  readonly type: string;
  readonly id: string;
  readonly displayFields: readonly DisplayField[];
}
export interface TreeNodeDescription {
  readonly shape: ShapeDescription;
  readonly children: readonly TreeNodeDescription[];
}
export interface DocumentDescription extends OwnStateDescription {
  readonly size: CanvasSize;
  readonly children: readonly TreeNodeDescription[];
}
export interface OwnState {
  readonly attributes: Readonly<Record<string, AttributeValue>>;
  readonly text?: string;
}
export type NumericRule = 'coordinate' | 'nonnegative' | 'positive';
export type ContentModel = 'empty' | 'text' | 'container';
export type Direction = 'forward' | 'backward';
export type ShapeCreation =
  | {
      readonly type: 'rect';
      readonly id: string;
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly fill?: string;
    }
  | { readonly type: 'g'; readonly id: string };
