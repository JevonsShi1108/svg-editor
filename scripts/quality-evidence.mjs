import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { sourceDigest } from './source-digest.mjs';
export const readEvidence = (file, issues, notBefore) => {
  try {
    if (notBefore && statSync(file).mtimeMs < Date.parse(notBefore))
      issues.push(`${file}: stale evidence`);
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    issues.push(`${file}: ${error.message}`);
    return null;
  }
};
export const checkCoverage = (issues, notBefore) => {
  const summary = readEvidence('coverage/coverage-summary.json', issues, notBefore);
  if (!summary) return null;
  const entries = Object.entries(summary).filter(([key]) => key !== 'total'),
    normalize = (s) => s.replaceAll('\\', '/');
  const groups = {
    global: entries,
    domain: entries.filter(([p]) => normalize(p).includes('/src/domain/')),
    history: entries.filter(([p]) => normalize(p).includes('/src/application/history/')),
    session: entries.filter(([p]) => normalize(p).includes('/src/application/session/')),
  };
  const result = {};
  for (const [name, files] of Object.entries(groups)) {
    if (!files.length) issues.push(`coverage ${name}: empty scope`);
    result[name] = {};
    for (const field of ['lines', 'statements', 'branches']) {
      const total = files.reduce((n, [, data]) => n + data[field].total, 0),
        covered = files.reduce((n, [, data]) => n + data[field].covered, 0),
        pct = total === 0 ? 100 : (100 * covered) / total;
      const threshold =
        name === 'global' ? (field === 'branches' ? 75 : 80) : field === 'branches' ? 85 : 90;
      result[name][field] = { total, covered, pct, threshold };
      if (pct < threshold) issues.push(`coverage ${name}.${field}: ${pct} < ${threshold}`);
    }
  }
  // A config change may never hide executable code in the type-only exclusions.
  const ast = ts.createSourceFile(
    'vitest.config.ts',
    readFileSync('vitest.config.ts', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let excluded = [];
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(ast) === 'exclude' &&
      ts.isArrayLiteralExpression(node.initializer)
    )
      excluded = node.initializer.elements.map((n) => (ts.isStringLiteral(n) ? n.text : ''));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const excludedFiles = ts.sys
    .readDirectory(process.cwd(), ['.ts'], undefined, excluded)
    .map((p) => path.resolve(p));
  const pure = (statement) =>
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) ||
    (ts.isExportDeclaration(statement) && statement.isTypeOnly) ||
    (ts.isVariableStatement(statement) &&
      statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) &&
      statement.declarationList.declarations.every((d) => !d.initializer));
  for (const file of excludedFiles) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    if (!source.statements.every(pure)) issues.push(`coverage excludes executable code: ${file}`);
  }
  const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(path.join(directory, e.name)) : [path.join(directory, e.name)],
    );
  const reported = new Set(entries.map(([p]) => normalize(path.resolve(p))));
  for (const file of files('src').filter((p) => p.endsWith('.ts'))) {
    const full = path.resolve(file);
    if (!excludedFiles.includes(full) && !reported.has(normalize(full)))
      issues.push(`production file absent from coverage: ${file}`);
  }
  return result;
};
export const checkArchitecture = (issues, notBefore) => {
  const data = readEvidence('artifacts/architecture/report.json', issues, notBefore);
  if (!data) return;
  if (
    !data.passed ||
    !data.runtimeAcyclic ||
    data.sourceSha256 !== sourceDigest() ||
    data.plantedEdges.length < 12 ||
    data.plantedEdges.some((e) => !e.detected)
  )
    issues.push('architecture: incomplete or stale source proof');
};
export const checkPerformance = (issues, notBefore) => {
  const data = readEvidence('artifacts/performance/report.json', issues, notBefore);
  if (!data) return;
  if (data.sourceSha256 !== sourceDigest()) issues.push('performance source digest changed');
  if (
    data.policy.samples !== 11 ||
    data.policy.warmup !== 3 ||
    JSON.stringify(data.policy.sizes) !== '[100,1000,5000]'
  )
    issues.push('performance: frozen sampling profile changed');
  for (const id of ['PERF-01', 'PERF-02', 'PERF-03', 'PERF-04', 'PERF-05', 'PERF-06', 'PERF-07'])
    if (!data.metrics.some((m) => m.id === id)) issues.push(`performance missing ${id}`);
  if (data.retention.length < 3) issues.push('performance: missing retention relationships');
  for (const metric of data.metrics) {
    const samples = [...metric.samplesMs].sort((a, b) => a - b);
    if (
      samples.length !== 11 ||
      metric.medianMs !== samples[5] ||
      metric.p95Ms !== samples[10] ||
      ![
        metric.n,
        metric.k,
        metric.s,
        metric.B,
        metric.batch,
        metric.heapBefore,
        metric.heapAfter,
        metric.heapMaximum,
      ].every(Number.isFinite)
    )
      issues.push(`performance malformed measurement ${metric.operation}`);
  }
};
export const checkRandom = (issues, notBefore, profile = 'local') => {
  const targets = {
    local: { runs: 50, model: 30, commands: 40, nodes: 30 },
    ci: { runs: 200, model: 100, commands: 80, nodes: 40 },
    release: { runs: 1000, model: 500, commands: 200, nodes: 60 },
  };
  const target = targets[profile];
  if (!target) {
    issues.push('unknown random profile');
    return;
  }
  const directory = `artifacts/random/${profile}`;
  if (!existsSync(directory)) {
    issues.push(`missing random profile directory ${directory}`);
    return;
  }
  const records = readdirSync(directory)
    .filter((n) => n.endsWith('.json'))
    .map((file) => ({
      file: `${directory}/${file}`,
      mtime: statSync(`${directory}/${file}`).mtimeMs,
    }))
    .filter((e) => !notBefore || e.mtime >= Date.parse(notBefore))
    .map((e) => ({ ...e, data: readEvidence(e.file, issues, notBefore) }));
  for (const name of [
    ...Array.from({ length: 16 }, (_, i) => `PROP-${String(i + 1).padStart(2, '0')}`),
    'MODEL-01',
    'MODEL-IO',
  ]) {
    const matching = records.filter((e) => e.data?.name === name),
      valid = matching.filter(
        ({ data }) =>
          data.profile?.name === profile &&
          !data.failed &&
          data.skips === 0 &&
          data.runs === (name === 'MODEL-01' ? target.model : target.runs),
      );
    if (
      !valid.some((e) => e.data.seed === 20261025) ||
      !valid.some((e) => e.data.seed !== 20261025)
    )
      issues.push(`${name}: missing fixed + fresh successful ${profile} runs`);
    for (const { data } of valid)
      if (data.profile.maxCommands !== target.commands || data.profile.maxNodes !== target.nodes)
        issues.push(`${name}: profile limits reduced`);
  }
  return records.map((e) => e.file);
};
