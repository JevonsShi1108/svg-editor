import { expect, it } from 'vitest';
import { BoxTypeLabel } from '../../plugins/box-label/src/BoxTypeLabel.js';
it('labels only the runtime box type, leaving the plain group fallback and root unlabeled', () => {
  const label = new BoxTypeLabel().prepare();
  const row = (type: string) => ({
    shape: { type, id: 'n', attributes: [{ name: 'data-kind', value: 'box' }], displayFields: [] },
    children: [],
  });
  expect(label(row('box'))).toBe('(box)');
  expect(label(row('g'))).toBeUndefined();
  expect(label(null)).toBeUndefined();
});
