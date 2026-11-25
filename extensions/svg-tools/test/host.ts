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
  const symbols = () =>
    vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      document.uri,
    );
  const original = document.getText();
  const replace = async (text: string) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      text,
    );
    assert.ok(await vscode.workspace.applyEdit(edit));
  };
  const check = async (id: string, line: number) => {
    const [root] = await symbols();
    assert.equal(root?.name, 'svg');
    const flow = root.children[0]!;
    assert.equal(flow.name, 'g#flow');
    const [rect, nested] = flow.children;
    assert.equal(rect?.name, 'rect#' + id);
    assert.equal(rect.selectionRange.start.line, line);
    assert.match(document.getText(rect.selectionRange), /^<rect.*\/>$/);
    assert.equal(nested?.children[0]?.name, 'text');
  };
  await check('start', 2);
  const rect = (await symbols())[0]!.children[0]!.children[0]!;
  await vscode.commands.executeCommand('vscode.open', document.uri, {
    selection: rect.selectionRange,
  });
  assert.equal(
    vscode.window.activeTextEditor?.document.uri.toString(),
    document.uri.toString(),
    'Outline navigation needs a text editor',
  );
  assert.equal(vscode.window.activeTextEditor.selection.start.line, 2);
  const updated = original.replace('    <rect', '\n    <rect').replace('id="start"', 'id="ready"');
  await replace(updated);
  assert.ok(document.isDirty);
  await check('ready', 3);
  await replace(updated.replace('</svg>', ''));
  // VS Code 1.147 returns undefined when the aggregate symbol result is empty.
  assert.deepEqual((await symbols()) ?? [], []);
  await replace(original);
  await check('start', 2);
}
