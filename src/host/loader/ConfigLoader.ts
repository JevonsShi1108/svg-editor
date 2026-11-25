import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolveImport } from 'import-meta-resolve';
import type { Plugin } from '../../application/contracts/Plugin.js';
import type { Manifest, PluginHost } from './PluginHost.js';

interface Entry {
  module: string;
  enabled?: boolean;
  options?: Readonly<Record<string, unknown>>;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function entries(raw: unknown): Entry[] {
  if (!record(raw) || Object.keys(raw).some((k) => k !== 'plugins') || !Array.isArray(raw.plugins))
    throw Error();
  for (const item of raw.plugins) {
    if (
      !record(item) ||
      typeof item.module !== 'string' ||
      !item.module.trim() ||
      Object.keys(item).some((k) => !['module', 'options', 'enabled'].includes(k)) ||
      ('enabled' in item && typeof item.enabled !== 'boolean') ||
      ('options' in item && !record(item.options))
    )
      throw Error();
  }
  return raw.plugins;
}
async function packageAt(directory: string) {
  const manifest: unknown = JSON.parse(
    await readFile(path.join(directory, 'package.json'), 'utf8'),
  );
  if (!record(manifest) || typeof manifest.name !== 'string' || !manifest.name)
    throw Error('invalid package manifest');
  return manifest as unknown as Manifest & { main?: string };
}
function missing(error: unknown) {
  return (
    record(error) && ['ENOENT', 'ENOTDIR', 'ERR_MODULE_NOT_FOUND'].includes(String(error.code))
  );
}
async function enclosingManifest(file: string) {
  let directory = path.dirname(file);
  for (;;) {
    try {
      return await packageAt(directory);
    } catch (error) {
      if (!missing(error)) throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw Error('missing package manifest');
    directory = parent;
  }
}

export class ConfigLoader {
  constructor(private readonly host: PluginHost) {}
  async load(file: string): Promise<string[]> {
    let ordered: Entry[];
    try {
      ordered = entries(JSON.parse(await readFile(file, 'utf8')));
    } catch {
      return ['invalid plugin config'];
    }
    const diagnostics: string[] = [];
    for (const entry of ordered) {
      if (entry.enabled === false) continue;
      const diagnostic = await this.loadEntry(file, entry);
      if (diagnostic) diagnostics.push(diagnostic);
    }
    return diagnostics;
  }
  private async loadEntry(config: string, entry: Entry) {
    const base = path.resolve(config);
    let name = entry.module;
    try {
      let file: string, directory: boolean;
      try {
        file =
          entry.module.startsWith('.') || path.isAbsolute(entry.module)
            ? path.resolve(path.dirname(base), entry.module)
            : fileURLToPath(resolveImport(entry.module, pathToFileURL(base).href));
        directory = (await stat(file)).isDirectory();
      } catch (error) {
        if (missing(error)) return 'plugin not found: ' + entry.module;
        throw error;
      }
      const manifest = directory ? await packageAt(file) : await enclosingManifest(file);
      name = manifest.name;
      if (directory) file = path.resolve(file, manifest.main ?? 'index.js');
      const module = (await import(pathToFileURL(file).href)) as { default?: Plugin };
      if (!Object.hasOwn(module, 'default')) return 'plugin has no default export: ' + entry.module;
      return await this.host.activate(module.default!, manifest, entry.options);
    } catch (error) {
      return `plugin failed to activate: ${name} (${error instanceof Error ? error.message : String(error)})`;
    }
  }
}
