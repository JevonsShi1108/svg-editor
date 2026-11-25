import type { ShapeDescription, AttributeValue } from '../../domain/values/contracts.js';

export interface AttributeEdit {
  feedback(messages: import('../../domain/values/contracts.js').OperationFeedback): void;
  describe(id: string): ShapeDescription;
  set(id: string, attribute: string, value: AttributeValue): void;
}

export interface AttributeHandler {
  readonly name: string;
  handles(target: ShapeDescription, attribute: string): boolean;
  apply(
    target: ShapeDescription,
    attribute: string,
    value: AttributeValue,
    edit: AttributeEdit,
  ): void;
}
