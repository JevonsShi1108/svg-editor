import assert from 'node:assert/strict';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('svg-editor-lab.svg-tools');
  assert.ok(extension, 'Expected the development extension in the host');
  await extension.activate();
  assert.ok(extension.isActive);
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(folder.uri, 'example.svg'),
  );
  assert.match(document.lineAt(2).text, /<rect id="start"/);
}
