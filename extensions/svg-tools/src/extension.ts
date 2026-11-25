import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from './SvgFileDecorationProvider';

export function activate(context: vscode.ExtensionContext): void {
  const changed = new vscode.EventEmitter<vscode.Uri>();
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.svg', false, true, false);
  context.subscriptions.push(
    changed,
    watcher,
    watcher.onDidCreate((uri) => changed.fire(uri)),
    watcher.onDidDelete((uri) => changed.fire(uri)),
    vscode.window.registerFileDecorationProvider(new SvgFileDecorationProvider(changed.event)),
  );
}
