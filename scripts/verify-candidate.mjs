import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runChecks } from './run-checks.mjs';
import { sourceDigest } from './source-digest.mjs';
import { receiptChecks } from './traceability-lib.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const candidate = git(['rev-parse', 'HEAD']);
const expected = process.argv[2] ?? candidate;
if (!/^[a-f0-9]{40}$/.test(expected) || expected !== candidate)
  throw new Error('Candidate must be the exact full SHA checked out at HEAD.');
if (git(['status', '--porcelain=v1', '--untracked-files=all']) !== '')
  throw new Error('Candidate verification requires an initially clean checkout.');
const directory = 'artifacts/acceptance';
mkdirSync(directory, { recursive: true });
const receiptPath = `${directory}/${candidate}.json`;
if (existsSync(receiptPath)) {
  const old = read(receiptPath);
  const archive = `${directory}/history`;
  mkdirSync(archive, { recursive: true });
  writeFileSync(`${archive}/${candidate}-${Date.now()}.json`, JSON.stringify(old, null, 2) + '\n');
}
const sourceFiles = [
  'doc/spec/phase_cli_1.md',
  'doc/spec/SVG_Editor_Phase1_Implementation_Spec.md',
  'doc/spec/SVG_Editor_Phase1_Test_Plan.md',
  'doc/spec/SVG_Editor_Phase1_Codex_Execution_Plan.md',
];
const baseline = git(['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0];
const sourceVersions = sourceFiles.map((file) => ({
  file,
  sha256: hash(file),
  blob: git(['rev-parse', `HEAD:${file}`]),
  originalBlob: git(['rev-parse', `${baseline}:${file}`]),
}));
const startedAt = new Date().toISOString();
// Written before any checks so an interrupted run cannot leave a false READY receipt.
const receipt = {
  status: 'VERIFYING',
  candidate_commit: candidate,
  candidate_tree: git(['rev-parse', 'HEAD^{tree}']),
  report_blob: git(['rev-parse', 'HEAD:doc/TEST_REPORT.md']),
  course_report_blob: git(['rev-parse', 'HEAD:doc/README.md']),
  repository: git(['rev-parse', '--show-toplevel']),
  branch: git(['branch', '--show-current']) || '(detached exact candidate)',
  startedAt,
  finishedAt: null,
  source_versions: sourceVersions,
  input_profile_version: 'EXEC-P1 v1.0',
  input_profile_sha256: hash('doc/INPUT_PROFILE.md'),
  production_source_sha256: sourceDigest(),
  environment: {
    OS: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      version: os.version(),
    },
    node: process.version,
    packageManager: `npm ${execFileSync(process.execPath, [process.env.npm_execpath, '--version'], { encoding: 'utf8' }).trim()}`,
    dependencyLock: { path: 'package-lock.json', sha256: hash('package-lock.json') },
  },
  clean_checkout_before_checks: true,
  tracked_files_unchanged_after_checks: false,
  pending_user_acceptance: true,
  remote_write_performed: false,
  final_tag_created_or_moved: false,
};
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
const execution = runChecks('candidate', [
  { id: 'npm-ci', npmArgs: ['ci'] },
  { id: 'build', script: 'build' },
  { id: 'verify', script: 'verify' },
  { id: 'random-release', script: 'random:release' },
]);
const issues = [];
const loadEvidence = (file) => {
  try {
    if (statSync(file).mtimeMs < Date.parse(startedAt))
      issues.push(`Stale final evidence: ${file}`);
    return read(file);
  } catch (error) {
    issues.push(`${file}: ${error.message}`);
    return null;
  }
};
const verify = loadEvidence('artifacts/verification/latest-verify.json');
const release = loadEvidence('artifacts/verification/latest-random-release.json');
const suite = loadEvidence('artifacts/test-results/coverage.json');
const performance = loadEvidence('artifacts/performance/report.json');
const traceability = loadEvidence('artifacts/traceability/report.json');
let coverage = null;
let randomFiles = [];
try {
  // Candidate bootstrap itself requires only Node built-ins; npm ci installs these check dependencies.
  const { checkCoverage, checkRandom } = await import('./quality-evidence.mjs');
  coverage = checkCoverage(issues, startedAt);
  randomFiles = checkRandom(issues, startedAt, 'release') ?? [];
} catch (error) {
  issues.push(`Final coverage/random evidence could not be validated: ${error.message}`);
}
const randomProfiles = randomFiles.map((file) => ({ file, sha256: hash(file), data: read(file) }));
const failedCases = (suite?.testResults ?? []).flatMap((file) =>
  file.assertionResults
    .filter((a) => a.status !== 'passed')
    .map((a) => ({
      file: file.name,
      name: a.fullName,
      status: a.status,
      errors: a.failureMessages,
    })),
);
const cleanAfter = git(['status', '--porcelain=v1', '--untracked-files=all']) === '';
const conditions = {
  exact_sha_clean_checkout: execution.cleanBefore && candidate === git(['rev-parse', 'HEAD']),
  npm_ci: execution.checks.find((c) => c.id === 'npm-ci')?.passed === true,
  build: execution.checks.find((c) => c.id === 'build')?.passed === true,
  verify: verify?.success === true && traceability?.passed === true,
  coverage:
    suite?.success === true &&
    suite.numTotalTests > 0 &&
    suite.numFailedTests === 0 &&
    suite.numPendingTests === 0 &&
    suite.numTodoTests === 0 &&
    !issues.some((i) => i.includes('coverage')),
  release_properties:
    release?.checks.find((c) => c.id === 'test:property')?.passed === true &&
    !issues.some((i) => i.startsWith('PROP-') || i.includes('random')),
  release_model:
    release?.checks.find((c) => c.id === 'test:model')?.passed === true &&
    !issues.some((i) => i.startsWith('MODEL-') || i.includes('random')),
  performance_source_match:
    performance?.sourceSha256 === sourceDigest() &&
    verify?.checks.find((c) => c.id === 'test:performance')?.passed === true,
  source_versions:
    sourceVersions.every((v) => v.blob === v.originalBlob) &&
    sourceDigest() === receipt.production_source_sha256 &&
    hash('package-lock.json') === receipt.environment.dependencyLock.sha256,
  clean_after: cleanAfter && execution.cleanAfter && execution.inputsStable,
};
const rows = read('doc/traceability.json');
Object.assign(receipt, {
  status:
    execution.success && issues.length === 0 && receiptChecks.every((c) => conditions[c])
      ? 'READY_FOR_USER_REVIEW'
      : 'BLOCKED',
  finishedAt: new Date().toISOString(),
  tracked_files_unchanged_after_checks: cleanAfter,
  checks: execution.checks,
  verification: verify,
  test_summary: suite && {
    total: suite.numTotalTests,
    passed: suite.numPassedTests,
    failed: suite.numFailedTests,
    skipped: suite.numPendingTests,
    todo: suite.numTodoTests,
    failedCases,
  },
  coverage,
  performance: {
    file: 'artifacts/performance/report.json',
    sha256: existsSync('artifacts/performance/report.json')
      ? hash('artifacts/performance/report.json')
      : null,
    sourceMatches: conditions.performance_source_match,
  },
  traceability,
  candidate_verification: Object.fromEntries(
    receiptChecks.map((c) => [c, { closed: conditions[c] === true }]),
  ),
  random_profiles: randomProfiles,
  issues,
  manual_items: rows.filter((r) => r.gate_scope === 'manual_acceptance'),
  post_acceptance_items: rows.filter((r) => r.gate_scope === 'post_acceptance'),
  unexecuted_optional_items: rows.filter(
    (r) => r.gate_scope === 'optional' && r.status === 'not_run_optional',
  ),
});
// Keep every final run's evidence beside its receipt, independent of later latest-* updates.
const evidenceDirectory = `${directory}/${candidate}-evidence/${execution.id}`;
mkdirSync(evidenceDirectory, { recursive: true });
const snapshotFiles = new Set([
  'artifacts/verification/latest-candidate.json',
  'artifacts/verification/latest-verify.json',
  'artifacts/verification/latest-random-release.json',
  'artifacts/test-results/coverage.json',
  'coverage/coverage-summary.json',
  'artifacts/performance/report.json',
  'artifacts/architecture/report.json',
  'artifacts/traceability/report.json',
  ...randomFiles,
]);
const addLogs = (record) => {
  for (const check of record?.checks ?? []) snapshotFiles.add(check.log);
};
addLogs(execution);
addLogs(verify);
addLogs(release);
receipt.evidence = [];
for (const file of snapshotFiles)
  if (existsSync(file)) {
    const target = path.join(evidenceDirectory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(file));
    receipt.evidence.push({
      original: file,
      snapshot: target.replaceAll('\\', '/'),
      sha256: hash(target),
    });
  }
receipt.random_profile_count = existsSync('artifacts/random/release')
  ? readdirSync('artifacts/random/release').filter((n) => n.endsWith('.json')).length
  : 0;
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(`${receipt.status}: ${path.resolve(receiptPath)}`);
process.exitCode = receipt.status === 'READY_FOR_USER_REVIEW' ? 0 : 1;
