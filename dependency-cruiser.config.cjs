/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-runtime-independence',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^(src/extension|src/webview)|^(vscode|node:|react)' },
    },
    {
      name: 'webview-no-extension-host',
      severity: 'error',
      from: { path: '^src/webview' },
      to: { path: '^src/extension|^vscode$|^node:' },
    },
    {
      name: 'production-no-test-dependencies',
      severity: 'error',
      from: { path: '^src', pathNot: '\\.(test|integration\\.test)\\.' },
      to: { path: '(^|/)(tests?|test)(/|$)|\\.(test|integration\\.test)\\.' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src',
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } },
  },
};
