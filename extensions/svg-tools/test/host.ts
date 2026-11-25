import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from '../src/SvgFileDecorationProvider';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('svg-editor-lab.svg-tools');
  assert.ok(extension, 'Expected the development extension in the host');
  await extension.activate();
  assert.ok(extension.isActive);
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const changed = new vscode.EventEmitter<vscode.Uri>();
  const provider = new SvgFileDecorationProvider(changed.event);
  const cancellation = new vscode.CancellationTokenSource();
  const badge = (name: string) =>
    provider.provideFileDecoration(vscode.Uri.joinPath(folder.uri, name), cancellation.token);
  assert.equal((await badge('example.svg'))?.badge, '[]');
  assert.equal((await badge('example.svg'))?.propagate, false);
  for (const name of [
    'plain.txt',
    'session.txt',
    'folder',
    'folder.svg',
    'x.svg.bak',
    'missing.svg',
  ]) {
    assert.equal(await badge(name), undefined, name);
  }
  cancellation.cancel();
  assert.equal(await badge('example.svg'), undefined);
  cancellation.dispose();
  changed.dispose();
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(folder.uri, 'example.svg'),
  );
  assert.match(document.lineAt(2).text, /<rect id="start"/);
}
