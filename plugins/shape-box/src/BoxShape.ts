import {
  ContainerShape,
  ShapeSchema,
  type DocumentId,
  type OwnState,
  type ValueRules,
} from '@svgframe/api';

export class BoxShape extends ContainerShape {
  static readonly schema = new ShapeSchema('box', {}, [], 'container', [], undefined, true);
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, BoxShape.schema, state);
  }
  override describe() {
    const own = super.describe();
    return Object.freeze({
      ...own,
      displayFields: Object.freeze(
        own.displayFields.filter((field) => field.label !== 'data-kind'),
      ),
    });
  }
}
