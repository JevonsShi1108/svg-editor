import { runChecks } from './run-checks.mjs';
const stage = process.argv[2];
if (!/^P2-(?:0[0-9]|1[0-5])$/.test(stage ?? '')) throw Error('Expected P2-00 through P2-15');
const n = Number(stage.slice(3));
const steps = [
  { id: 'typecheck', script: 'typecheck' },
  { id: 'build', script: 'build' },
];
if (n >= 1) steps.push({ id: 'test:vscode:host', script: 'test:vscode:host' });
if (n >= 5)
  for (const script of ['check:deps', 'test:unit', 'test:integration', 'test:e2e'])
    steps.push({ id: script, script });
if (n >= 8) steps.push({ id: 'metrics:p2', script: 'metrics:p2', args: ['--check'] });
if (n >= 14) steps.push({ id: 'verify', script: 'verify' });
if (n === 15) steps.push({ id: 'candidate:verify', script: 'candidate:verify' });
process.exitCode = runChecks('stage-' + stage, steps, { stage }).success ? 0 : 1;
