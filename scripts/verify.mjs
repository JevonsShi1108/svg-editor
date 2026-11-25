import { runChecks } from './run-checks.mjs';
const scripts = [
  'typecheck',
  'lint',
  'format:check',
  'check:deps',
  'test:coverage',
  'test:performance',
  'check:traceability',
  'test:vscode:host',
  'test:p2:assemblies',
  'check:p2:diffs',
  'check:p2:metrics',
  'check:p2:evidence',
];
const result = runChecks(
  'verify',
  scripts.map((script) => ({ id: script, script })),
);
process.exitCode = result.success ? 0 : 1;
