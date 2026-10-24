import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { sourceDigest } from './source-digest.mjs';
export const runChecks = (name, steps, { profile = 'local', stage = null } = {}) => {
  if (!process.env.npm_execpath) throw new Error('Run this verification through npm run.');
  for (const key of ['FC_SEED', 'FC_PATH', 'FC_REPLAY_PATH', 'FC_TARGET', 'MODEL_REPLAY_FILE'])
    if (process.env[key])
      throw new Error(
        `Full gates cannot use replay override ${key}; use test:property/test:model for diagnostic replay.`,
      );
  const git = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'Cannot inspect Git');
    return r.stdout.trim();
  };
  const root = git(['rev-parse', '--show-toplevel']);
  if (path.resolve(root) !== path.resolve(process.cwd()))
    throw new Error('Run verification at the repository root.');
  const startedAt = new Date().toISOString(),
    id = `${startedAt.replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const directory = `artifacts/verification/runs/${id}`;
  mkdirSync(directory, { recursive: true });
  mkdirSync('artifacts/test-results', { recursive: true });
  const report = {
    name,
    id,
    profile,
    stage,
    startedAt,
    finishedAt: null,
    success: false,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    commitHint: git(['rev-parse', 'HEAD']),
    cleanBefore: git(['status', '--porcelain=v1', '--untracked-files=all']) === '',
    cleanAfter: false,
    sourceSha256: sourceDigest(),
    lockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
    checks: [],
  };
  for (const [index, step] of steps.entries()) {
    if (!/^[a-z0-9:-]+$/i.test(step.id)) throw new Error('Unsafe check identifier');
    console.log(`RUN ${step.id}`);
    const before = Date.now(),
      args = step.npmArgs ?? [
        'run',
        step.script,
        ...(step.args?.length ? ['--', ...step.args] : []),
      ];
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        TEST_PROFILE: profile,
        VERIFY_STARTED_AT: startedAt,
        VERIFY_RUN_DIRECTORY: directory,
        ...(stage ? { VERIFY_STAGE: stage } : {}),
      },
    });
    const log = `${directory}/${String(index + 1).padStart(2, '0')}-${step.id.replaceAll(':', '-')}.log`;
    writeFileSync(
      log,
      `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.stack}` : ''}`,
    );
    const check = {
      id: step.id,
      command: `npm ${args.join(' ')}`,
      exitCode: result.status,
      signal: result.signal,
      elapsedMs: Date.now() - before,
      passed: result.status === 0 && !result.error,
      log,
    };
    report.checks.push(check);
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${step.id} (${check.elapsedMs}ms) ${log}`);
    if (!check.passed)
      console.log(
        (result.stdout ?? '').split(/\r?\n/).slice(-20).join('\n') +
          (result.stderr ?? '').slice(-3000),
      );
    writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n');
  }
  report.cleanAfter = git(['status', '--porcelain=v1', '--untracked-files=all']) === '';
  report.finishedAt = new Date().toISOString();
  report.inputsStable =
    report.sourceSha256 === sourceDigest() &&
    report.lockSha256 ===
      createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  report.success = report.inputsStable && report.checks.every((c) => c.passed);
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(
    `artifacts/verification/latest-${name}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(`${name}: ${report.success ? 'passed' : 'failed'}; ${directory}/report.json`);
  return report;
};
