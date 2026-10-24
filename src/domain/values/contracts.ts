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
export type StateTargetDescription =
  | { readonly kind: 'canvas' }
  | { readonly kind: 'shape'; readonly type: string; readonly id: string };
export interface PlacementDescription {
  readonly parent: string | null;
  readonly index: number;
}
export type ChangeDescription =
  | {
      readonly kind: 'state';
      readonly target: StateTargetDescription;
      readonly before: OwnStateDescription;
      readonly after: OwnStateDescription;
    }
  | {
      readonly kind: 'placement';
      readonly id: string;
      readonly shape: ShapeDescription;
      readonly from: PlacementDescription | null;
      readonly to: PlacementDescription | null;
    };
export type ChangePreview = readonly ChangeDescription[];
export type ShapeCreation =
  | {
      readonly type: 'circle';
      readonly id: string;
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly fill?: string;
    }
  | {
      readonly type: 'ellipse';
      readonly id: string;
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
      readonly fill?: string;
    }
  | {
      readonly type: 'line';
      readonly id: string;
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly stroke?: string;
    }
  | {
      readonly type: 'text';
      readonly id: string;
      readonly x: number;
      readonly y: number;
      readonly text: string;
    }
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
