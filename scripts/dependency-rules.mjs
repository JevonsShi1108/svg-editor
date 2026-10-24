export const rules = {
  forbidden: [
    {
      name: 'domain-no-node-core',
      from: { path: '(^|/)domain/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'application-no-node-core',
      from: { path: '(^|/)application/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'domain-inward-only',
      from: { path: '(^|/)domain/' },
      to: { path: '(^|/)(application|cli|infrastructure)/|^(node:|fs$|path$|saxes$|@xmldom/)' },
    },
    {
      name: 'application-no-adapters',
      from: { path: '(^|/)application/' },
      to: { path: '(^|/)(cli|infrastructure)/|^(node:|fs$|path$|saxes$|@xmldom/)' },
    },
    {
      name: 'cli-no-live-domain',
      from: { path: '(^|/)cli/' },
      to: { path: '(^|/)infrastructure/|(^|/)domain/(?!values/|errors/)' },
    },
    {
      name: 'cli-application-surface',
      from: { path: '(^|/)cli/' },
      to: { path: '(^|/)application/(commands|history|internal)/' },
    },
    {
      name: 'infrastructure-no-cli-or-session',
      from: { path: '(^|/)infrastructure/' },
      to: { path: '(^|/)cli/|(^|/)application/(session|history|commands|internal)/' },
    },
    {
      name: 'production-no-tests',
      from: { path: '(^|/)src/' },
      to: { path: '(^|/)(test|tests)/' },
    },
    {
      name: 'model-independent',
      from: { path: '(^|/)test/model/' },
      to: { pathNot: '^test/model/|^src/application/contracts/|^src/domain/values/contracts' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
