import { runChecks } from './run-checks.mjs';
const stage = process.argv[2];
if (!/^M(?:0\d|1[0-5])$/.test(stage ?? '')) throw new Error('Expected M00 through M15');
const steps = [];
const add = (script, args = []) => steps.push({ id: script, script, args });
if (stage === 'M00') steps.push({ id: 'dependencies', npmArgs: ['ls', '--depth=0'] });
else {
  for (const script of ['typecheck', 'lint', 'format:check', 'check:deps', 'test:unit'])
    add(script);
  if (stage >= 'M03') add('test:property');
  if (stage >= 'M06') add('test:integration');
  if (stage >= 'M11') add('test:e2e');
  if (stage >= 'M13') add('test:model');
  if (stage >= 'M14') {
    add('test:coverage');
    add('test:performance');
    add('check:traceability', ['--stage', stage]);
  }
}
const result = runChecks('stage-' + stage, steps, { stage });
process.exitCode = result.success ? 0 : 1;
