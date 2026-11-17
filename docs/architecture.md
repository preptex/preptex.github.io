# Website architecture

This document describes the website using `@preptex/core@0.6.0`. Update it when
component responsibilities, state ownership, or the integration contract change.

## Scope and dependencies

This is a client-only React application. It loads virtual files (including nested subfolders
and drag-and-drop folders), displays LaTeX source, renders whole-document (`ignore` conditionals),
condition-free configured structure, or lossless source tokens, provides standalone condition
realization (Pipeline B), independent analyses (references, command definitions/usage),
whole-document and single-branch transformations, staged diff review with undo/redo history, and
ZIP/file downloads. There is no backend, persistence service, TeX compiler, PDF renderer, or
network file service. Files live in memory; only AST filter preferences persist in browser
`localStorage`.

Runtime dependencies are React 19, CodeMirror 6, and PrepTeX Core 0.6.0.
The build system is Create React App 5 with TypeScript 4.9 and Webpack 5.
TypeScript uses ES2020, strict checking, checked indexed access, and Node module
resolution compatible with that compiler. Explicit `any` is an ESLint error.
Jest transforms the ESM PrepTeX package and CodeMirror's ESM
`@marijn/find-cluster-break` dependency.

## Components and classes

| Component or class | Location | Responsibility |
| --- | --- | --- |
| `App` | `src/App.tsx` | Single-workspace shell with top `WorkspaceHeader`, collapsible left `Filetree` sidebar, primary view switcher (`Code`, `AST`, `Transformations`, `Catalog`, `Metadata`, `Diagnostics`, `Diff Review`, `Settings`), and optional `Split` companion pane (off by default). |
| `WorkspaceHeader` | `src/components/WorkspaceHeader.tsx` | Top bar containing Explorer toggle, `File` menu (upload files/folder, new file, load demo, export, download ZIP/file, clear), expandable `Views` drawer + quick tabs, transformation undo/redo (`←`/`→`), `Split` toggle, and entry/condition readiness pill. |
| `WelcomeEmptyState` | `src/components/WelcomeEmptyState.tsx` | Centered empty-workspace onboarding dropzone supporting file/folder upload, drag-and-drop directories, and demo project loading. |
| `Filetree` | `src/components/Filetree.tsx` | Left sidebar explorer with nested folder hierarchy, live path filtering, expand/collapse-all folders, inline file/subfolder creation, `Entry` badge + `Set as entry`, drag-and-drop traversal (`src/utils/dropEntries.ts`), downloads, and removal. |
| `OperationsDialog` & `ControlPanel` | `src/components/OperationsDialog.tsx`, `src/components/ControlPanel.tsx` | Transformations view supporting default all-branches (`target: 'source'`) comment suppression and environment removal, optional inline Phase 0 condition paths, Pipeline B condition realization, composable multi-step pipelines, analyses, and generated artifacts. |
| `ASTview` | `src/components/astview/ASTview.tsx` | Structural tree view (`Coarse`, `Structure`, `Source` modes) with lazy inline Phase 0 condition configuration when conditionals exist, AST node filtering, `NodeActionBar`, and `Split` companion toggle. |
| `CatalogDialog` | `src/components/CatalogDialog.tsx` | Commands, environments, conditions, labels, and citations inspector with occurrence jumping, global `target: 'source'` refactoring, inline definition editing, and custom signature reparsing. |
| `MetadataDialog` | `src/components/MetadataDialog.tsx` | Title, authors, date, abstract, preamble packages, bibliography info, and project statistics with direct edit diff staging and source jumping. |
| `LogDialog` & `LogPanel` | `src/components/LogDialog.tsx`, `src/components/LogPanel.tsx` | Diagnostics and analysis findings view with `Check References` and `Check Commands` actions, error banners, stale indicators, and clickable source jump links. |
| `EditPreviewDialog` | `src/components/EditPreviewDialog.tsx` | Full-pane Diff Review view (also supports `variant="dialog"` for unit tests) displaying file/line diffs, stale alerts, Discard, and atomic Apply that records transformation history. |
| `ProjectSetupDialog` | `src/components/ProjectSetupDialog.tsx` | Settings view (also supports `variant="dialog"` for unit tests) configuring entry file, input traversal (`project` / `file-only`), condition policy (`ignore` default, `source`, `source-with-overrides`, `manual`, `none`), split preference, and custom signatures. |
| `NodeActionBar` | `src/components/NodeActionBar.tsx` | Contextual action strip above `ASTview` for removing, wrapping, unwrapping, or renaming selected AST nodes. |
| `Codeview` | `src/components/Codeview.tsx` | Read-only CodeMirror 6 wrapper supporting document switching and precise line/UTF-16 range jumping. |

## Hooks, services, and state ownership

| Hook or service | State or contract | Role |
| --- | --- | --- |
| `useFiles` | Reducer owning `FilesMap`, monotonic `sourceRevision`, monotonic `fileVersions`, `selectedFile`, and bounded undo/redo history stacks (`past`, `future`). | Normalizes uploaded folder batches (stripping shared root wrappers), manages create/upsert/remove/reset, and supports `goBack()`/`goForward()` with advancing versions. |
| `useWorkspaceLayout` | `activeView`, `previousView`, `splitEnabled` (`false` default), `sidebarCollapsed`, `openMenu`. | Owns single-viewport navigation, `File`/`Views` dropdown state, Split side-by-side companion visibility, and clean return from `Diff Review`. |
| `useProjectConfiguration` | `entryPath`, `traversal`, `conditionPolicy` (App initializes with `{ mode: 'ignore' }`), `customCommands`, `coarseTreeOptions`, `revision`. | Owns stable entry, traversal, and condition evaluation configuration decoupled from active viewer file; exposes `recommendEntry()`. |
| `useProjectModel` | `snapshot`, `view`, `coarseTree`, `catalog`, `metadata`, `hasConditionals`, `detectedConditions`, `issues`, `viewIssue`, `isReady`, `error`. | Maintains incremental immutable `ProjectSnapshot`, derives `ProjectView` (defaulting to `'ignore'` mode), and derives whole-project `catalog`/`metadata` on snapshots when needed. |
| `useOperations` | `result`, `pendingEditPlan`, `conditionRealization`, `artifacts`, `isStale`, `isEditPlanStale`, capabilities. | Supports both snapshot-wide (`target: 'source'`) and view-scoped transformations, condition realization (Pipeline B), analyses, composable pipelines, and edit validation/application. |
| `useControl` | `CoreOptionsUI` (`suppressComments`, `suppressCommentEnvironments`, `inputHandling`, `stripDeclarationsAndSetters`, `outputName`). | Owns export and condition-realization options. |
| `src/utils/dropEntries.ts` | `extractDroppedFiles` | Recursively flattens drag-and-drop directory entries while preserving relative virtual paths. |
| `src/services/zip.ts` | Zero-dependency PKZIP 2.0 archive builder | Packages project files or artifacts into `.zip` downloads. |
| `src/services/core.ts` | Pure adapters for `@preptex/core@0.5.0` | Stateless tokenization, snapshot updates, condition realization, view resolution, composite pipelines, analyses, and typed `ProcessingError` mapping. |

## Data flow

```mermaid
flowchart TD
  Upload[Filetree / Drag-and-Drop / Empty State] --> Files[useFiles: source buffers, versions & undo/redo stack]
  Files --> Model[useProjectModel]
  Config[useProjectConfiguration: recommendEntry, ignore default & Phase 0] --> Model
  Model --> Snapshot[ProjectSnapshot: tokens, subfolder inputs & facts]
  Model --> View[ProjectView: ignore / realized structure]
  Snapshot --> Ops[useOperations: source-wide & view transforms]
  View --> Ops
  Ops --> Diff[Diff Review View: staged ProjectEditPlan]
  Diff -- Apply (records history) --> Files
  Header[WorkspaceHeader: File menu, Views drawer, Back/Forward, Split] --> Layout[useWorkspaceLayout]
  Header -- Undo / Redo --> Files
  Snapshot --> Views[Primary Views: Code, AST, Transformations, Catalog, Metadata, Diagnostics, Settings]
  View --> Views
  Views -- Jump / AST select --> Code[Codeview: primary or Split companion]
```

## PrepTeX integration contract

Import public values and types only from `@preptex/core`.
Core results are deeply frozen and readonly. Never mutate core objects or cast away readonly.
Source ranges are inclusive UTF-16 offsets and one-based lines.
They are translated to CodeMirror half-open coordinates at the display boundary in `Codeview`.

## Checks

Use Node.js 22 and npm. Before concluding changes, run:
```sh
npm run typecheck
npm run lint
npm run test:ci
npm run build
```
