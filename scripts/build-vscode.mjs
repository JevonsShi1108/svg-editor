import { build } from 'esbuild';

for (const [entry, output] of [
  ['src/extension.ts', 'extension'],
  ['test/host.ts', 'host'],
]) {
  await build({
    entryPoints: [`extensions/svg-tools/${entry}`],
    outfile: `extensions/svg-tools/dist/${output}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['vscode'],
  });
}
