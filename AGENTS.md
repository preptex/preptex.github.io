# AI development instructions

## Read first

1. Read [the website architecture](docs/architecture.md) before changing components,
   hooks, services, or state flow.
2. Read the PrepTeX docs shipped with the version being used. The `@preptex/core`
   package contains comprehensive APIs, blueprints, and architecture specifications
   that agents can inspect when using the library:
   - [Integration guide](node_modules/@preptex/core/dist/docs/integration.md)
   - [Core architecture](node_modules/@preptex/core/dist/docs/architecture.md)
   - [API reference](node_modules/@preptex/core/dist/docs/api/README.md)
   - [Project model blueprint](node_modules/@preptex/core/dist/docs/project-model.md)
   - [Node operations blueprint](node_modules/@preptex/core/dist/docs/node-operations.md)
   - [0.4 migration guide](node_modules/@preptex/core/dist/docs/migration-0.4.md)
   - [Website handoff guide](node_modules/@preptex/core/dist/docs/website-handoff.md)
   - [Public declarations](node_modules/@preptex/core/dist/index.d.ts)
3. If a `packages/preptex-core` package is supplied, read its README, bundled
   `dist/docs/`, and declarations as well. Verify its package version against
   `package.json` and `package-lock.json`. In this checkout the published package
   is installed in `node_modules/@preptex/core`; install with `npm ci` if absent.

## Repository boundaries

- This is the browser website, not the core library repository.
- Import only the public `@preptex/core` entry point. Do not deep-import private
  lexer/parser files or use a sibling checkout as a released `file:` dependency.
- Pin PrepTeX to an exact version while it is in 0.x; update the lockfile together
  with the manifest and review its shipped docs for breaking changes.
- Keep the existing React/CRA/CodeMirror stack unless changing it is part of the
  requested work. The code pane is currently read-only.
- Use `docs/architecture.md` to find state owners. Update that document when
  responsibilities or behavior change.

## Type and state conventions

- Keep strict TypeScript and checked indexed access enabled. Run the explicit
  typecheck command; Babel/Jest passing does not establish type safety.
- Do not add explicit `any`, cast away readonly, suppress compiler errors, or
  redefine the core's public types locally. Use `import type` for type imports.
- `ConfiguredNode` is a discriminated union (`root | section | environment | group | math | token`).
  Use `isConfiguredContainerNode` and handle all variants exhaustively in `TreeLayoutBuilder`.
- Core snapshots, condition realizations, views, artifacts, and issues are immutable.
  Derive website `LayoutNode` values and store UI state separately.
- Update file buffers through `useFiles`. Keep reducer updates atomic and pure;
  multiple updates in a React batch must not discard earlier changes.
- Incrementally update `ProjectSnapshot` via `updateProjectSnapshot` when file buffers
  change, rebuilding on initialization or errors. Never transform an obsolete snapshot or view.
- `occurrenceKey` values are view-local and do not persist across reparsing. Include snapshot/view
  identity in UI state ownership; do not use node keys as global identifiers.
- Preserve original source and line endings. Range offsets are inclusive UTF-16
  indices, and lines are one-based.

## Options and error handling

- `src/model/useControl.ts` owns the single `CoreOptionsUI` definition.
- Use exported types and guards for core values. Validate untrusted DOM values,
  JSON, file reads, and any future worker messages before using them.
- `ConditionPolicy` supports `'source'`, `'source-with-overrides'`, `'manual'`, and `'none'`.
  `'none'` asserts condition-free source and blocks `resolveProjectView` with `'unrealized-condition'`
  if any conditional remains.
- Pipeline B (`realizeProjectConditions`) operates on `ProjectSnapshot` even when braces or
  environments are unbalanced; Pipeline A (`resolveProjectView`, `runAnalysis`, `planTransformation`)
  operates exclusively on realized views.
- Catch `unknown`. Preserve `ProjectOperationError.failure` and
  `PrepTexError.code` through the typed `ProcessingError` adapter.
- Keep `ProjectIssue` diagnostics structured until presentation. Surface failed file reads,
  view blocks, and transforms, and disable view-dependent actions when `view.status !== 'ready'`.

## Checks

Use Node.js 22 and npm. Before completing code changes, run:

```sh
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

Add meaningful regression tests for changed core/state behavior. Do not mock the
core API to make migration tests pass. Use browser checks for interactions or
layout changes; preserve the current styling unless asked otherwise. Keep Jest's
ESM transformation exceptions narrow. Do not deploy or push merely to verify a
local change.
