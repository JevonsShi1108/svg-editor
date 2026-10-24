import { expect, it, vi } from 'vitest';
import { sessionFixture, semantic } from '../helpers/session.js';
import { ResultFactory } from '../../src/application/internal/ResultFactory.js';
import { DomainError } from '../../src/domain/errors/DomainError.js';
it('REG-CANDIDATE-01 init candidate invariant failure cannot poison the untouched published document', async () => {
  const { session } = sessionFixture();
  await session.execute({ command: 'init' });
  await session.execute({ command: 'create', shape: { type: 'g', id: 'kept' } });
  const before = await semantic(session);
  const status = (await session.execute({ command: 'tree' })).status;
  const spy = vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(() => {
    throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'candidate preparation' });
  });
  const result = await session.execute({ command: 'init' });
  spy.mockRestore();
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.effect).toBe('unchanged');
  expect(result.status).toEqual(status);
  expect(await semantic(session)).toEqual(before);
});
