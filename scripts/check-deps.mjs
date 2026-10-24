import { cruise } from 'dependency-cruiser';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { rules } from './dependency-rules.mjs';
const actual = await cruise(['src'], {
  ...rules.options,
  validate: true,
  ruleSet: rules,
  outputType: 'json',
});
const report = JSON.parse(actual.output);
if (report.summary.violations.length)
  throw new Error(JSON.stringify(report.summary.violations, null, 2));
const visitFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? visitFiles(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
for (const file of visitFiles('src').filter((f) => f.endsWith('.ts'))) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const classes = [];
  const visit = (node) => {
    if (ts.isClassDeclaration(node)) classes.push(node.name?.text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (classes.length > 1 || (classes.length === 1 && path.basename(file, '.ts') !== classes[0]))
    throw new Error(`One class / matching filename violated: ${file}`);
}
const base = 'artifacts/architecture-fixtures';
for (const directory of ['domain', 'application', 'cli', 'infrastructure'])
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
const bad = JSON.parse(
  (await cruise([base], { ...rules.options, validate: true, ruleSet: rules, outputType: 'json' }))
    .output,
);
const violations = bad.summary.violations;
for (const name of ['domain-inward-only', 'cli-no-live-domain'])
  if (!violations.some((v) => v.rule.name === name))
    throw new Error(`ARCH-11 fixture escaped ${name}`);
if (
  !violations.some(
    (v) => v.from.endsWith('domain/Bad.ts') && v.to.endsWith('application/Contract.ts'),
  )
)
  throw new Error('ARCH-11 type-only violation escaped');
console.log(
  `ARCH-01/02/11: ${report.summary.totalCruised} modules; ${violations.length} planted forbidden edges detected, including type-only.`,
);
