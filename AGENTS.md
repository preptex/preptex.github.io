# AI development instructions

## Read first

1. Read [the website architecture](docs/architecture.md) before changing components,
   hooks, services, or state flow.
2. Read the PrepTeX docs shipped with the version being used:
   - [Integration guide](node_modules/@preptex/core/dist/docs/integration.md)
   - [Core architecture](node_modules/@preptex/core/dist/docs/architecture.md)
   - [API reference](node_modules/@preptex/core/dist/docs/api/README.md)
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
- `AstNode` is a discriminated union. Use `NodeType` and `isContainerNode`;
  handle new variants exhaustively in `TreeLayoutBuilder`.
- Core projects, ASTs, output files, and diagnostics are immutable snapshots.
  Derive website `LayoutNode` values and store UI state separately.
- Update file buffers through `useFiles`. Keep reducer updates atomic and pure;
  multiple updates in a React batch must not discard earlier changes.
- Incrementally parse/merge updates with identical parse options. Rebuild after
  deletions or failed parses. Never transform a snapshot for older source buffers.
- Node IDs are file-local and do not persist across reparsing. Include the file
  identity in UI state ownership; do not use node IDs as global identifiers.
- Preserve original source and line endings. Range offsets are inclusive UTF-16
  indices, and lines are one-based. Reparse output before navigating its AST.

## Options and error handling

- `src/model/useControl.ts` owns the single `CoreOptionsUI` definition.
- Use exported enums and guards for core values. Validate untrusted DOM values,
  JSON, file reads, and any future worker messages before using them.
- Omit `enabledConditions` to preserve conditions. An empty array evaluates them
  all as false. These states are not interchangeable.
- Separate mode transforms every parsed file. Output naming is website policy;
  it currently leaves preserved input references unchanged.
- Catch `unknown`. Preserve `PrepTexSyntaxError.diagnostic` and
  `PrepTexError.code` through the typed `ProcessingError` adapter.
- Keep warnings structured until presentation. Surface failed file reads and
  transforms, and disable Run when the current project is unavailable.

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
