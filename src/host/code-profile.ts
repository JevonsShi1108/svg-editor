import dir from '@svgframe/plugin-dir';
import dirManifest from '@svgframe/plugin-dir/package.json' with { type: 'json' };
import stats from '@svgframe/plugin-stats';
import statsManifest from '@svgframe/plugin-stats/package.json' with { type: 'json' };
import type { Plugin } from '../public.js';
import type { Manifest, PluginHost } from './loader/PluginHost.js';

interface InstalledPlugin {
  readonly plugin: Plugin;
  readonly manifest: Manifest;
  readonly presets: readonly string[];
  readonly options?: Readonly<Record<string, unknown>>;
}

const installed: readonly InstalledPlugin[] = [
  { plugin: dir, manifest: dirManifest, presets: ['demo', 'commands'] },
  { plugin: stats, manifest: statsManifest, presets: ['demo', 'commands'] },
];

export async function loadCodeProfile(name: string, host: PluginHost): Promise<string[]> {
  if (!['base', 'demo', 'box', 'commands'].includes(name))
    return ['unknown plugin preset: ' + name];
  const diagnostics: string[] = [];
  for (const entry of installed.filter((p) => p.presets.includes(name))) {
    const diagnostic = await host.activate(entry.plugin, entry.manifest, entry.options);
    if (diagnostic) diagnostics.push(diagnostic);
  }
  return diagnostics;
}
