import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { extractRequirementIds, validateMetadata, testMetadataGuard } from './traceability-lib.mjs';
import {
  readEvidence,
  checkCoverage,
  checkArchitecture,
  checkPerformance,
  checkRandom,
} from './quality-evidence.mjs';
import { sourceDigest } from './source-digest.mjs';
const stageIndex = process.argv.indexOf('--stage'),
  stage = stageIndex < 0 ? 'M15' : process.argv[stageIndex + 1];
if (!/^M(?:0\d|1[0-5])$/.test(stage ?? '')) throw new Error('Invalid stage');
const guardAssertions = testMetadataGuard(),
  rows = JSON.parse(readFileSync('doc/traceability.json', 'utf8'));
const source = readFileSync('doc/spec/SVG_Editor_Phase1_Test_Plan.md', 'utf8');
const expectedIds = [
  ...new Set(
    extractRequirementIds(source).concat(
      Array.from({ length: 6 }, (_, i) => `VAL-0${i + 1}`),
      ['REG-GROUP', 'REG-STATE', 'REG-SAVE'],
    ),
  ),
];
const issues = validateMetadata(rows, { stage, expectedIds });
const testFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? testFiles(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
for (const file of testFiles('test').filter((file) => file.endsWith('.ts'))) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ['only', 'skip', 'todo', 'skipIf', 'runIf'].includes(node.name.text) &&
      /^(it|test|describe)(\.|\()/.test(node.getText(ast))
    )
      issues.push(`${file}: test selection/omission modifier ${node.name.text}`);
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
const dueByGroup = {
  CFG: 'M00',
  INV: 'M07',
  CLI: 'M12',
  DOC: 'M10',
  CRT: 'M07',
  GEO: 'M03',
  SET: 'M03',
  QRY: 'M12',
  ERR: 'M12',
  STR: 'M04',
  HIS: 'M07',
  TX: 'M07',
  FAIL: 'M10',
  DRY: 'M07',
  FAULT: 'M10',
  XML: 'M09',
  ID: 'M09',
  SEC: 'M09',
  IO: 'M11',
  FS: 'M11',
  QUEUE: 'M10',
  PROP: 'M13',
  MODEL: 'M13',
  ARCH: 'M14',
  LIM: 'M14',
  PERF: 'M14',
  MUT: 'M14',
  DEL: 'M15',
  VAL: 'M12',
};
for (const row of rows) {
  const due =
    row.id === 'PROP-16'
      ? 'M12'
      : row.id === 'E2E-08'
        ? 'M15'
        : row.id.startsWith('E2E-')
          ? 'M12'
          : row.id === 'REG-GROUP'
            ? 'M07'
            : row.id.startsWith('REG-')
              ? 'M10'
              : dueByGroup[row.id.split('-')[0]];
  if (due && row.required_by !== due)
    issues.push(`${row.id}: required_by differs from established stage ${due}`);
}
const notBefore = process.env.VERIFY_STARTED_AT;
const results = [];
for (const file of [
  'artifacts/test-results/coverage.json',
  'artifacts/test-results/performance.json',
]) {
  const data = readEvidence(file, issues, notBefore);
  if (!data) continue;
  if (
    data.numTotalTests <= 0 ||
    data.numPendingTests ||
    data.numTodoTests ||
    !data.success ||
    data.numFailedTests
  )
    issues.push(`${file}: test suite is empty, failed, skipped or pending`);
  for (const suite of data.testResults)
    for (const assertion of suite.assertionResults)
      results.push({
        file: suite.name.replaceAll('\\', '/'),
        name: assertion.fullName,
        status: assertion.status,
      });
}
const due = rows.filter((row) => row.gate_scope === 'local_required' && row.required_by <= stage);
const allowedChecks = new Set([
  'profile',
  'architecture',
  'coverage',
  'performance',
  'deliverables',
  'preview',
]);
for (const row of due) {
  for (const file of row.tests ?? [])
    if (!existsSync(file)) issues.push(`${row.id}: nonexistent test/evidence source ${file}`);
  for (const c of row.cases ?? []) {
    const matches = results.filter(
      (result) =>
        result.file.endsWith('/' + c.file.replaceAll('\\', '/')) &&
        result.name.includes(c.contains),
    );
    if (matches.length < (c.minimum ?? 1) || matches.some((m) => m.status !== 'passed'))
      issues.push(
        `${row.id}: required actual case missing/failed: ${c.file} :: ${c.contains} (found ${matches.length})`,
      );
  }
  for (const check of row.checks ?? [])
    if (!allowedChecks.has(check)) issues.push(`${row.id}: unknown evidence check ${check}`);
}
const coverage = checkCoverage(issues, notBefore);
checkArchitecture(issues, notBefore);
checkPerformance(issues, notBefore);
const randomFiles = checkRandom(issues, notBefore, 'local');
if (!readFileSync('doc/INPUT_PROFILE.md', 'utf8').includes('EXEC-P1 v1.0'))
  issues.push('input profile is not documented');
if (due.some((row) => row.checks?.includes('deliverables'))) {
  const files = ['doc/README.md', 'doc/architecture.puml', 'doc/architecture.svg'];
  for (const file of files) if (!existsSync(file)) issues.push(`deliverables missing ${file}`);
  if (existsSync('doc/README.md')) {
    const text = readFileSync('doc/README.md', 'utf8');
    for (const field of [
      '架构方案',
      '过程记录',
      '一致性自查',
      '质量保证',
      'CommandCatalog',
      'ShapeFactory',
      'PlantUML',
      '验收',
      'final',
    ])
      if (!text.includes(field)) issues.push(`course report missing ${field}`);
  }
  if (existsSync('doc/architecture.puml')) {
    const text = readFileSync('doc/architecture.puml', 'utf8');
    if (!text.includes('@startuml') || !text.includes('@enduml'))
      issues.push('invalid PlantUML source');
    for (const directory of ['src/cli', 'src/application', 'src/domain', 'src/infrastructure'])
      if (!text.includes(directory) || !existsSync(directory))
        issues.push(`diagram does not represent ${directory}`);
  }
}
for (const row of rows.filter((r) => r.gate_scope === 'manual_acceptance'))
  if (!existsSync(row.manual?.artifact ?? '')) issues.push(`${row.id}: representative SVG missing`);
if (due.some((row) => row.checks?.includes('preview'))) {
  const preview = readEvidence('artifacts/preview/result.json', issues);
  if (
    !preview?.observed ||
    !existsSync(preview.artifact ?? '') ||
    !existsSync(preview.screenshot ?? '')
  )
    issues.push('preview was not actually observed');
}
mkdirSync('artifacts/traceability', { recursive: true });
const report = {
  stage,
  sourceSha256: sourceDigest(),
  guardAssertions,
  total: rows.length,
  due: due.length,
  passed: issues.length === 0,
  issues,
  coverage,
  randomFiles,
  counts: Object.fromEntries(
    [
      'local_required',
      'candidate_verification',
      'manual_acceptance',
      'post_acceptance',
      'optional',
    ].map((scope) => [scope, rows.filter((r) => r.gate_scope === scope).length]),
  ),
  note: 'Candidate receipt closes only after exact-SHA clean verification; other deferred scopes never count as passed.',
};
writeFileSync('artifacts/traceability/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `Traceability guard: ${guardAssertions} self-test assertions; ${rows.length} IDs, ${due.length} due at ${stage}`,
);
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `All due local requirements have actual evidence. ${path.resolve('artifacts/traceability/report.json')}`,
  );
