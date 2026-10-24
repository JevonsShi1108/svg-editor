import { expect, it } from 'vitest';
import { sessionFixture } from '../helpers/session.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
it('REG-REQUEST-SHAPE-01 missing/non-string shape type produces scalar diagnostic values and no state change', async () => {
  const { session } = sessionFixture();
  for (const type of [undefined, null, false, 17, {}, []]) {
    const result = await session.execute({
      command: 'create',
      shape: { type, id: 'x' },
    } as unknown as CommandRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('invalid request accepted');
    expect(result.status.state).toBe('empty');
    expect(
      Object.values(result.error.parameters).every(
        (value) => typeof value === 'string' || typeof value === 'number',
      ),
    ).toBe(true);
  }
});
