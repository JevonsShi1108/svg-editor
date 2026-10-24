import { expect, it } from 'vitest';
import { ValueRules } from '../../src/domain/values/ValueRules.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import type { ResourceLimits } from '../../src/domain/values/contracts.js';
it('REG-LIMITS-01 ResourceLimits has exactly the five mandatory finite integer fields', () => {
  expect(() => new ValueRules({} as ResourceLimits)).toThrow('INVALID_LIMITS');
  for (const missing of Object.keys(defaultLimits)) {
    const partial: Record<string, number> = { ...defaultLimits };
    delete partial[missing];
    expect(() => new ValueRules(partial as unknown as ResourceLimits)).toThrow('INVALID_LIMITS');
  }
  expect(() => new ValueRules({ ...defaultLimits, saveMaxBytes: 100 } as ResourceLimits)).toThrow(
    'INVALID_LIMITS',
  );
});
