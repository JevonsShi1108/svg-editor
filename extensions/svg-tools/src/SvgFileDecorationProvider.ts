import * as vscode from 'vscode';

export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  constructor(readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri>) {}

  async provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken) {
    if (token.isCancellationRequested || !uri.path.endsWith('.svg')) return undefined;
    try {
      const { type } = await vscode.workspace.fs.stat(uri);
      if (token.isCancellationRequested || !(type & vscode.FileType.File)) return undefined;
      const decoration = new vscode.FileDecoration('[]', 'SVG file');
      decoration.propagate = false;
      return decoration;
    } catch {
      return undefined;
    }
  }
}
