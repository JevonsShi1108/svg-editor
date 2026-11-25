import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
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
