export const rules = {
  forbidden: [
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
      name: 'infrastructure-no-cli-or-session',
      from: { path: '(^|/)infrastructure/' },
      to: { path: '(^|/)cli/|(^|/)application/(session|history|commands)/' },
    },
    { name: 'production-no-tests', from: { path: '^src/' }, to: { path: '(^|/)(test|tests)/' } },
    {
      name: 'model-independent',
      from: { path: '^test/model/' },
      to: { path: '^src/(?!application/contracts/|domain/values/contracts)' },
    },
    { name: 'no-cycles', from: {}, to: { circular: true } },
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
