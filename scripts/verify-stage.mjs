import { spawnSync } from 'node:child_process';
const stage = process.argv[2];
const supported = [
  'M00',
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
  'M07',
  'M08',
  'M09',
  'M10',
  'M11',
  'M12',
  'M13',
];
if (!supported.includes(stage)) throw new Error(`Stage not established: ${stage}`);
const commands =
  stage === 'M00'
    ? [['ls', '--depth=0']]
    : ['typecheck', 'lint', 'format:check', 'check:deps', 'test:unit'].map((name) => ['run', name]);
for (const args of commands) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (stage >= 'M03') {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'test:property'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (stage >= 'M06') {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'run', 'test:integration'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (stage >= 'M11') {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'test:e2e'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (stage >= 'M13') {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'test:model'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`${stage}: established checks passed. Future milestones remain planned.`);
