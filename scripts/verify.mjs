import { runChecks } from './run-checks.mjs';
const scripts = [
  'typecheck',
  'lint',
  'format:check',
  'check:deps',
  'test:coverage',
  'test:performance',
  'check:traceability',
];
const result = runChecks(
  'verify',
  scripts.map((script) => ({ id: script, script })),
);
process.exitCode = result.success ? 0 : 1;
