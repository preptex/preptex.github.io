# PrepTeX website

A browser interface for inspecting and transforming virtual LaTeX projects with
`@preptex/core`. Upload files or a folder, select an entry, inspect its source
and AST, choose transformation options, and download the generated files.

The website uses React 19, TypeScript 4.9, CodeMirror 6, and Create React App 5.
PrepTeX Core is pinned to **0.2.1**. All document processing and file contents
stay in browser memory. The CodeMirror pane currently displays source read-only.

## Development

Use Node.js 22 and npm, matching the GitHub Actions environment.

```sh
npm ci
npm start
```

The development server opens at http://localhost:3000. Files disappear on reload;
only AST display preferences are stored in localStorage.

## Validation

```sh
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

The build is written to `build/`. CI runs these checks before deployment.
`npm test` starts the interactive test watcher.

## Development documentation

- [Website architecture](docs/architecture.md): components, hooks, services,
  state ownership, processing flow, error handling, and extension guidance.
- [AI development instructions](AGENTS.md): conventions and required checks.
- [Installed PrepTeX integration guide](node_modules/@preptex/core/dist/docs/integration.md).
- [Installed PrepTeX architecture](node_modules/@preptex/core/dist/docs/architecture.md).
- [Installed PrepTeX API reference](node_modules/@preptex/core/dist/docs/api/README.md).
- [Public TypeScript declarations](node_modules/@preptex/core/dist/index.d.ts).

The installed-package links become available after `npm ci`. They are shipped
with the exact dependency version; read them before updating the integration.
