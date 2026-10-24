import { spawnSync } from 'node:child_process';
const stage = process.argv[2];
const supported = ['M00'];
if (!supported.includes(stage)) throw new Error(`Stage not established: ${stage}`);
const commands = stage === 'M00' ? [['ls', '--depth=0']] : [];
for (const args of commands) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  `${stage}: toolchain checked; no functional tests at bootstrap. M01-M15 remain planned.`,
);
