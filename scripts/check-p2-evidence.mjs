import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
function evidence(file) {
  if (process.env.VERIFY_STARTED_AT)
    assert.ok(
      statSync(file).mtimeMs >= Date.parse(process.env.VERIFY_STARTED_AT),
      'stale: ' + file,
    );
  return json(file);
}
const suite = evidence('artifacts/test-results/coverage.json');
assert.equal(suite.success, true);
assert.equal(suite.numFailedTests + suite.numPendingTests + suite.numTodoTests, 0);
const host = evidence('artifacts/vscode-host/latest.json'),
  desktop = json('doc/phase2/vscode-evidence.json');
assert.equal(host.active, true);
assert.equal(host.rectLine, 3);
assert.equal(host.otherLeaf, 'path#second');
assert.equal(host.recoveredRoot, 'svg');
for (const key of ['version', 'extension', 'extensionSha256', 'manifestSha256', 'fixtureSha256'])
  assert.equal(host[key], desktop[key], key);
for (const [file, expected] of Object.entries(desktop.sourceFiles))
  assert.equal(hash(file), expected, file);
for (const shot of desktop.observations) {
  assert.equal(hash(shot.file), shot.sha256);
  const data = readFileSync(shot.file);
  assert.ok(
    shot.file.endsWith('.png')
      ? data.readUInt32BE(0) === 0x89504e47
      : data.readUInt16BE(0) === 0xffd8,
  );
}
const claims = json('doc/phase2/traceability.json');
for (const claim of claims) {
  for (const file of claim.tests) {
    const suiteFile = suite.testResults.find(
      (item) => path.resolve(item.name) === path.resolve(file),
    );
    assert.ok(
      suiteFile &&
        suiteFile.assertionResults.length &&
        suiteFile.assertionResults.every((a) => a.status === 'passed'),
      file,
    );
  }
  for (const step of claim.desktop)
    assert.ok(
      desktop.observations.some((row) => row.step === step),
      step,
    );
}
const assemblies = evidence('artifacts/assemblies/latest.json'),
  diffs = evidence('artifacts/plugin-diffs/latest.json');
assert.equal(assemblies.candidate, head);
assert.equal(diffs.head, head);
assert.equal(diffs.proofs.length, 6);
for (const record of assemblies.records) {
  assert.equal(record.exit, 0);
  for (const [channel, detail] of Object.entries(record.channels)) {
    const file = path.join(assemblies.raw, record.name + '-' + record.profile + '.' + channel);
    assert.equal(statSync(file).size, detail.bytes);
    assert.equal(hash(file), detail.sha256);
  }
}
for (const dir of ['doc', 'doc/phase2']) {
  const meta = json(dir + '/architecture.meta.json');
  assert.equal(hash(meta.source), meta.sourceSha256);
  assert.equal(hash(meta.output), meta.outputSha256);
}
const report = readFileSync('doc/README.md', 'utf8').split('# SVG 编辑器 Phase 1 课程报告')[0];
for (const [, url] of report.matchAll(/\]\(([^)]+)\)/g))
  if (!url.includes('://') && !url.startsWith('#'))
    assert.ok(existsSync(path.resolve('doc', url.split('#')[0])), 'broken link: ' + url);
for (const key of [
  'ADR-01',
  'ADR-02',
  'ADR-03',
  'ADR-04',
  'ShapeProvider',
  'AttributeHandler',
  'TreeDecorator',
  'DirectoryReader',
  'PluginHost.activate',
])
  assert.ok(report.includes(key), key);
mkdirSync('artifacts/phase2', { recursive: true });
writeFileSync(
  'artifacts/phase2/verification.json',
  JSON.stringify(
    {
      head,
      claims,
      tests: suite.numPassedTests,
      host,
      byteRuns: assemblies.records.length,
      proofs: diffs.proofs,
      desktopEvidenceSha256: hash('doc/phase2/vscode-evidence.json'),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Verified ' +
    claims.length +
    ' requirement groups, ' +
    assemblies.records.length +
    ' binary process records and ' +
    desktop.observations.length +
    ' window captures.',
);
