import { cruise } from 'dependency-cruiser';
import extractTsConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { rules } from './dependency-rules.mjs';
const actual = await cruise(
  ['src', 'test/model'],
  {
    ...rules.options,
    validate: true,
    ruleSet: rules,
    outputType: 'json',
  },
  {},
  { tsConfig: extractTsConfig('tsconfig.json') },
);
const report = JSON.parse(actual.output);
if (report.summary.violations.length)
  throw new Error(JSON.stringify(report.summary.violations, null, 2));
// SPEC interfaces refer to one another through types. Runtime imports must still be acyclic.
const graph = new Map(
  report.modules.map((m) => [
    m.source,
    m.dependencies.filter((d) => !d.dependencyTypes.includes('type-only')).map((d) => d.resolved),
  ]),
);
const finished = new Set();
const visitRuntime = (name, active = new Set()) => {
  if (active.has(name)) throw new Error(`Runtime dependency cycle: ${name}`);
  if (finished.has(name)) return;
  const next = new Set(active).add(name);
  for (const target of graph.get(name) ?? []) visitRuntime(target, next);
  finished.add(name);
};
for (const name of graph.keys()) visitRuntime(name);
const visitFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? visitFiles(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
const sourceFiles = visitFiles('src')
  .filter((f) => f.endsWith('.ts'))
  .sort();
const sourceHash = createHash('sha256');
const nameComparisons = [];
const commandNames = [];
const shapeNames = [];
let classCount = 0;
for (const file of sourceFiles) {
  sourceHash
    .update(file.replaceAll('\\', '/') + '\0')
    .update(readFileSync(file))
    .update('\0');
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const classes = [];
  const visit = (node) => {
    if (ts.isClassDeclaration(node)) classes.push(node.name?.text);
    if (
      ts.isBinaryExpression(node) &&
      ts.isPropertyAccessExpression(node.left) &&
      ['type', 'command'].includes(node.left.name.text) &&
      ts.isStringLiteral(node.right)
    )
      nameComparisons.push({
        file: file.replaceAll('\\', '/'),
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
        expression: node.getText(ast),
      });
    if (
      file.replaceAll('\\', '/').endsWith('/CommandCatalog.ts') &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'add' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      commandNames.push(node.arguments[0].text);
    if (
      file.replaceAll('\\', '/').endsWith('/ShapeFactory.ts') &&
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Map' &&
      node.arguments?.[0] &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      for (const entry of node.arguments[0].elements)
        if (
          ts.isArrayLiteralExpression(entry) &&
          entry.elements[0] &&
          ts.isStringLiteral(entry.elements[0])
        )
          shapeNames.push(entry.elements[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  classCount += classes.length;
  if (classes.length > 1 || (classes.length === 1 && path.basename(file, '.ts') !== classes[0]))
    throw new Error(`One class / matching filename violated: ${file}`);
}
if (
  nameComparisons.some(
    (c) => !c.file.endsWith('/ShapeFactory.ts') && !c.file.endsWith('/CommandCatalog.ts'),
  )
)
  throw new Error(`Extra name dispatch needs review: ${JSON.stringify(nameComparisons)}`);
const expectedCommands = [
  'init',
  'read',
  'save',
  'canvas',
  'create',
  'delete',
  'move',
  'scale',
  'set',
  'group',
  'ungroup',
  'addto',
  'front',
  'back',
  'tree',
  'show',
  'undo',
  'redo',
  'help',
];
if (JSON.stringify([...commandNames].sort()) !== JSON.stringify(expectedCommands.sort()))
  throw new Error('Command registration differs from the 19-command contract');
if (
  JSON.stringify([...shapeNames].sort()) !==
  JSON.stringify(['circle', 'ellipse', 'g', 'line', 'rect', 'text'])
)
  throw new Error('Shape registration differs from the six-type contract');
const base = 'artifacts/architecture-fixtures';
for (const directory of [
  'domain',
  'application',
  'cli',
  'infrastructure',
  'test/model',
  'src',
  'test',
])
  mkdirSync(`${base}/${directory}`, { recursive: true });
writeFileSync(
  `${base}/application/Contract.ts`,
  'export interface Contract { readonly x: number }\n',
);
writeFileSync(
  `${base}/infrastructure/Adapter.ts`,
  'export interface Adapter { readonly y: number }\n',
);
writeFileSync(
  `${base}/domain/Bad.ts`,
  "import type { Contract } from '../application/Contract.js'; import { readFileSync } from 'node:fs'; export type Bad = Contract; export const read = readFileSync;\n",
);
writeFileSync(
  `${base}/cli/BadCli.ts`,
  "import type { Adapter } from '../infrastructure/Adapter.js'; export type BadCli = Adapter;\n",
);
writeFileSync(
  `${base}/test/model/BadModel.ts`,
  "import { Shape } from '../../../../src/domain/shapes/Shape.js'; export const forbidden = Shape;\n",
);
const planted = [
  { file: 'domain/Bad.ts', to: 'application/Contract.ts', rule: 'domain-inward-only' },
  { file: 'domain/Bad.ts', to: 'fs', rule: 'domain-inward-only' },
  { file: 'cli/BadCli.ts', to: 'infrastructure/Adapter.ts', rule: 'cli-no-live-domain' },
  { file: 'test/model/BadModel.ts', to: 'src/domain/shapes/Shape.ts', rule: 'model-independent' },
  {
    file: 'domain/BadCrypto.ts',
    to: 'crypto',
    rule: 'domain-no-node-core',
    source: "export {createHash} from 'node:crypto';\n",
  },
  {
    file: 'domain/BadAlias.ts',
    to: 'application/Contract.ts',
    rule: 'domain-inward-only',
    source:
      "import type { Contract } from '@fixture/application/Contract'; export type Alias = Contract;\n",
  },
  {
    file: 'application/BadApp.ts',
    to: 'infrastructure/Adapter.ts',
    rule: 'application-no-adapters',
    source:
      "import type { Adapter } from '../infrastructure/Adapter.js'; export type Bad = Adapter;\n",
  },
  {
    file: 'application/BadIo.ts',
    to: 'crypto',
    rule: 'application-no-node-core',
    source: "export { createHash } from 'node:crypto';\n",
  },
  {
    file: 'infrastructure/BadSession.ts',
    to: 'src/application/internal/protocols.ts',
    rule: 'infrastructure-no-cli-or-session',
    source:
      "import type { SessionHead } from '../../../src/application/internal/protocols.js'; export type Bad = SessionHead;\n",
  },
  {
    file: 'cli/BadDomain.ts',
    to: 'src/domain/internal/protocols.ts',
    rule: 'cli-no-live-domain',
    source:
      "import type { StateTarget } from '../../../src/domain/internal/protocols.js'; export type Bad = StateTarget;\n",
  },
  {
    file: 'cli/BadInternal.ts',
    to: 'src/application/internal/protocols.ts',
    rule: 'cli-application-surface',
    source:
      "import type { SessionHead } from '../../../src/application/internal/protocols.js'; export type Bad = SessionHead;\n",
  },
  {
    file: 'src/BadProduction.ts',
    to: 'test/TestValue.ts',
    rule: 'production-no-tests',
    source: "export { testValue } from '../test/TestValue.js';\n",
  },
];
for (const fixture of planted)
  if (fixture.source) writeFileSync(`${base}/${fixture.file}`, fixture.source);
writeFileSync(`${base}/test/TestValue.ts`, 'export const testValue = 1;\n');
writeFileSync(
  `${base}/tsconfig.json`,
  JSON.stringify({
    extends: '../../tsconfig.json',
    compilerOptions: { baseUrl: '.', paths: { '@fixture/application/*': ['application/*'] } },
  }),
);
const bad = JSON.parse(
  (
    await cruise(
      [base],
      {
        ...rules.options,
        tsConfig: { fileName: `${base}/tsconfig.json` },
        validate: true,
        ruleSet: rules,
        outputType: 'json',
      },
      {},
      { tsConfig: extractTsConfig(`${base}/tsconfig.json`) },
    )
  ).output,
);
const violations = bad.summary.violations;
for (const fixture of planted)
  if (
    !violations.some(
      (v) =>
        v.rule.name === fixture.rule && v.from.endsWith(fixture.file) && v.to.endsWith(fixture.to),
    )
  )
    throw new Error(
      `ARCH-11 planted edge escaped ${fixture.file} -> ${fixture.to} (${fixture.rule})`,
    );
mkdirSync('artifacts/architecture', { recursive: true });
writeFileSync(
  'artifacts/architecture/report.json',
  JSON.stringify(
    {
      sourceSha256: sourceHash.digest('hex'),
      passed: true,
      modules: report.summary.totalCruised,
      classes: classCount,
      runtimeAcyclic: true,
      commandNames,
      shapeNames,
      nameComparisons,
      plantedEdges: planted.map((f) => ({ file: f.file, to: f.to, rule: f.rule, detected: true })),
      violations,
    },
    null,
    2,
  ),
);
console.log(
  `ARCH-01/02/11: ${report.summary.totalCruised} modules; ${violations.length} planted forbidden edges detected, including type-only.`,
);
