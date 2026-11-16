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

## Local `@preptex/core` testing

To test unpublished changes from the sibling `../core` checkout before publishing to npm:

```sh
npm run core:link    # builds ../core (@preptex/core) and links file:../core/core
npm run core:build   # rebuilds ../core after further edits to core
npm run core:status  # shows current package.json, lockfile, and symlink state
npm run core:unlink  # restores the pinned npm registry version and lockfile
```

Pass `--core-dir <path>` (or set `PREPTEX_CORE_DIR`) if `core` is located elsewhere,
or `npm run core:unlink -- --version <x.y.z>` to restore a newly published version.
Versioned Git hooks in `.githooks/` block committing, pushing, or merging `package.json`
or `package-lock.json` while locally linked (feature-branch `src/` commits remain allowed),
and CI runs `npm run check:core-link` before building or deploying.

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
