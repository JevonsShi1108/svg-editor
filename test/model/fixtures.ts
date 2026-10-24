import { ReferenceModel } from './ReferenceModel.js';
import type { ModelState } from './types.js';
export const initialWithFiles = (model: ReferenceModel): ModelState => {
  const state = model.initial();
  const sample = (anonymous = false) => {
    const temporary = model.initial(),
      doc = model.emptyDocument(400, 300);
    const rect = model.create(temporary, doc, {
      type: 'rect',
      id: anonymous ? 'rect1' : 'r1',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
    if (anonymous) {
      delete rect.attributes.x;
      delete rect.attributes.y;
    }
    return doc;
  };
  state.files['/memory/a.svg'] = { document: sample(), repair: false };
  state.files['/memory/anonymous.svg'] = { document: sample(true), repair: true };
  state.files['/memory/bad.svg'] = { document: null, repair: false };
  return state;
};
