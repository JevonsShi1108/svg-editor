import { runChecks } from './run-checks.mjs';
const profile = process.argv[2];
if (!['local', 'ci', 'release'].includes(profile)) throw new Error('Expected local, ci or release');
const result = runChecks(
  `random-${profile}`,
  ['test:property', 'test:model'].map((script) => ({ id: script, script })),
  { profile },
);
process.exitCode = result.success ? 0 : 1;
