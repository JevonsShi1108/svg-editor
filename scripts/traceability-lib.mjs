import assert from 'node:assert/strict';
export const extractRequirementIds = (source) => [
  ...new Set([...source.matchAll(/^\|\s*([A-Z][A-Z0-9]*-\d{2})\s*\|/gm)].map((m) => m[1])),
];
export const receiptChecks = [
  'exact_sha_clean_checkout',
  'npm_ci',
  'build',
  'verify',
  'coverage',
  'release_properties',
  'release_model',
  'performance_source_match',
  'source_versions',
  'clean_after',
];
export const validateMetadata = (rows, { stage = 'M15', expectedIds = [] } = {}) => {
  const issues = [],
    ids = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) issues.push(`duplicate ID ${row.id}`);
    ids.add(row.id);
    if (!/^M(?:0\d|1[0-5])$/.test(row.required_by)) issues.push(`${row.id}: invalid required_by`);
    if (row.gate_scope === 'optional' && !/^MUT-\d\d$/.test(row.id))
      issues.push(`${row.id}: mandatory item cannot become optional`);
    if (row.gate_scope === 'post_acceptance' && !['DEL-02', 'DEL-03', 'DEL-04'].includes(row.id))
      issues.push(`${row.id}: illegal post-acceptance scope`);
    if (row.gate_scope === 'manual_acceptance' && row.id !== 'E2E-08')
      issues.push(`${row.id}: only E2E-08 may be manual`);
    if (row.gate_scope === 'candidate_verification' && row.id !== 'DEL-08')
      issues.push(`${row.id}: illegal receipt-only scope`);
    if (
      ![
        'local_required',
        'candidate_verification',
        'manual_acceptance',
        'post_acceptance',
        'optional',
      ].includes(row.gate_scope)
    )
      issues.push(`${row.id}: unknown gate_scope`);
    if (row.gate_scope === 'local_required' && row.required_by <= stage) {
      if (!['verified', 'committed'].includes(row.status))
        issues.push(`${row.id}: due ${row.required_by}, status ${row.status}`);
      if (
        !row.tests?.length ||
        !row.evidence?.length ||
        (!row.cases?.length && !row.checks?.length)
      )
        issues.push(`${row.id}: missing actual tests/cases/evidence`);
      for (const c of row.cases ?? [])
        if (!c.file || !c.contains || !Number.isInteger(c.minimum ?? 1) || (c.minimum ?? 1) < 1)
          issues.push(`${row.id}: invalid case selector`);
      if (!row.review?.trim()) issues.push(`${row.id}: missing per-ID assertion review`);
    }
    if (row.gate_scope === 'post_acceptance' && row.status !== 'deferred_post_acceptance')
      issues.push(`${row.id}: post-acceptance must remain explicitly deferred`);
    if (
      row.gate_scope === 'optional' &&
      row.status !== 'not_run_optional' &&
      !['verified', 'committed'].includes(row.status)
    )
      issues.push(`${row.id}: optional status must be explicit`);
    if (
      row.gate_scope === 'manual_acceptance' &&
      (row.status !== 'deferred_manual' ||
        !row.manual?.artifact ||
        !row.manual?.reason ||
        !row.manual?.steps?.length)
    )
      issues.push(`${row.id}: missing manual preview evidence/steps`);
    if (
      row.gate_scope === 'candidate_verification' &&
      (!row.note || receiptChecks.some((check) => !row.receipt_checks?.includes(check)))
    )
      issues.push(`${row.id}: missing receipt closure condition/checks`);
  }
  for (const id of expectedIds) if (!ids.has(id)) issues.push(`missing requirement ${id}`);
  return issues;
};
export const testMetadataGuard = () => {
  const base = {
    id: 'FS-10',
    required_by: 'M11',
    gate_scope: 'local_required',
    status: 'verified',
    tests: ['real.test.ts'],
    evidence: ['actual run'],
    cases: [{ file: 'real.test.ts', contains: 'real link', minimum: 1 }],
    review: 'actual capability required',
  };
  let assertions = 0;
  assert.deepEqual(
    extractRequirementIds('| E2E-08 | preview |\n| FS-10 | file |\n| E2E-08 | duplicate |'),
    ['E2E-08', 'FS-10'],
  );
  assertions++;
  const reject = (row, options) => {
    assert.ok(validateMetadata([row], options).length > 0);
    assertions++;
  };
  const accept = (row, options) => {
    assert.deepEqual(validateMetadata([row], options), []);
    assertions++;
  };
  accept(base);
  for (const status of ['planned', 'active', 'implemented_unverified', 'blocked'])
    reject({ ...base, status });
  reject({ ...base, gate_scope: 'optional', status: 'not_run_optional' });
  reject({ ...base, gate_scope: 'manual_acceptance', status: 'deferred_manual' });
  reject({ ...base, gate_scope: 'candidate_verification' });
  reject({ ...base, gate_scope: 'post_acceptance', status: 'deferred_post_acceptance' });
  reject({ ...base, tests: [] });
  reject({ ...base, cases: [] });
  reject({ ...base, evidence: [] });
  reject({ ...base, review: '' });
  reject({ ...base, cases: [{ file: 'x', contains: '', minimum: 0 }] });
  const future = {
    ...base,
    id: 'DEL-05',
    required_by: 'M15',
    status: 'planned',
    tests: [],
    cases: [],
    evidence: [],
  };
  accept(future, { stage: 'M14' });
  reject(future);
  reject(base, { expectedIds: ['FS-10', 'FS-11'] });
  accept({
    ...base,
    id: 'DEL-02',
    gate_scope: 'post_acceptance',
    status: 'deferred_post_acceptance',
  });
  accept({ ...base, id: 'MUT-01', gate_scope: 'optional', status: 'not_run_optional' });
  accept({
    ...base,
    id: 'DEL-08',
    gate_scope: 'candidate_verification',
    status: 'implemented_unverified',
    note: 'Exact clean SHA receipt closes after commit.',
    receipt_checks: receiptChecks,
  });
  accept({
    ...base,
    id: 'E2E-08',
    gate_scope: 'manual_acceptance',
    status: 'deferred_manual',
    manual: {
      artifact: 'representative.svg',
      reason: 'preview capability unavailable',
      steps: ['Open SVG in browser'],
    },
  });
  assert.ok(validateMetadata([base, base]).some((s) => s.includes('duplicate')));
  assertions++;
  return assertions;
};
