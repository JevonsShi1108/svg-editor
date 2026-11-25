import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runTests } from '@vscode/test-electron';
import { prepareFixture } from './prepare-vscode.mjs';

const parent = path.resolve('artifacts/vscode-host');
mkdirSync(parent, { recursive: true });
const directory = mkdtempSync(path.join(parent, 'run-'));
const fixture = path.join(directory, 'fixture');
prepareFixture(fixture);
const extensionDevelopmentPath = path.resolve('extensions/svg-tools');
await runTests({
  version: '1.147.0',
  ...(process.env.VSCODE_EXECUTABLE_PATH && {
    vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
  }),
  extensionTestsEnv: { SVG_HOST_EVIDENCE: path.join(directory, 'host.json') },
  extensionDevelopmentPath,
  extensionTestsPath: path.join(extensionDevelopmentPath, 'dist/host.cjs'),
  launchArgs: [
    fixture,
    '--disable-extensions',
    '--skip-welcome',
    '--skip-release-notes',
    '--user-data-dir',
    path.join(directory, 'profile'),
    '--extensions-dir',
    path.join(directory, 'extensions'),
  ],
});

const data = JSON.parse(readFileSync(path.join(directory, 'host.json'), 'utf8'));
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(
  path.join(parent, 'latest.json'),
  JSON.stringify(
    {
      ...data,
      extensionSha256: digest('extensions/svg-tools/dist/extension.cjs'),
      manifestSha256: digest('extensions/svg-tools/package.json'),
      fixtureSha256: digest(path.join(fixture, 'example.svg')),
    },
    null,
    2,
  ) + '\n',
);
