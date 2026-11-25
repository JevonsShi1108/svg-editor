import * as vscode from 'vscode';
import { SvgOutline } from './SvgOutline';

export class SvgSymbolProvider implements vscode.DocumentSymbolProvider {
  readonly #outline = new SvgOutline();

  provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken) {
    if (token.isCancellationRequested) return [];
    const all: vscode.DocumentSymbol[] = [];
    const roots: vscode.DocumentSymbol[] = [];
    for (const element of this.#outline.parse(document.getText())) {
      const start = document.positionAt(element.start);
      const symbol = new vscode.DocumentSymbol(
        element.name,
        '',
        vscode.SymbolKind.Object,
        new vscode.Range(start, document.positionAt(element.end)),
        new vscode.Range(start, document.positionAt(element.openingEnd)),
      );
      all.push(symbol);
      (element.parent === undefined ? roots : all[element.parent]!.children).push(symbol);
    }
    return roots;
  }
}
