# Website architecture

This document describes the website using `@preptex/core@0.4.0`. Update it when
component responsibilities, state ownership, or the integration contract change.

## Scope and dependencies

This is a client-only React application. It loads virtual files, displays LaTeX
source, renders condition-free configured document structure or lossless source
tokens, provides standalone condition realization (Pipeline B), independent
analyses (references, command definitions/usage), realized structural transforms
(Pipeline A), and downloads artifacts. There is no backend, persistence service,
TeX compiler, PDF renderer, or network file service. Files live in memory; only
AST filter preferences persist in browser localStorage.

Runtime dependencies are React 19, CodeMirror 6, and PrepTeX Core 0.4.0.
The build system is Create React App 5 with TypeScript 4.9 and Webpack 5.
TypeScript uses ES2020, strict checking, checked indexed access, and Node module
resolution compatible with that compiler. Explicit `any` is an ESLint error.
Jest transforms the ESM PrepTeX package and CodeMirror's ESM
`@marijn/find-cluster-break` dependency.

## Components and classes

| Component or class | Location | Responsibility |
| --- | --- | --- |
| `App` | `src/App.tsx` | Composes the panes and hooks; coordinates entry selection, generated artifacts, downloads, AST width/collapse, structure/source viewing mode, source-range navigation, and modal dialogs (Project Setup, Operations, Edit Preview, Log). |
| `Filetree` | `src/components/Filetree.tsx` | File/folder upload controls, nested folder-first listing, selection, removal, downloads, and upload failure display. |
| File tree `TreeNode` | `src/components/Filetree.tsx` | Private recursive row component; owns only folder expansion state. `buildFiletree` derives the display hierarchy from virtual paths. |
| `ConfigurationSummary` | `src/components/ConfigurationSummary.tsx` | Compact status bar showing configured entry, traversal policy, condition policy, and readiness badge (`Ready`, `Incomplete`, `Blocked`) with reason code, plus triggers to open project settings, operations dialog, and log dialog. |
| `ProjectSetupDialog` | `src/components/ProjectSetupDialog.tsx` | Modal dialog for draft configuration: entry file selection, project vs file-only traversal, and condition policies (`source`, `source-with-overrides`, `manual`, `none`). Opens once on first import. |
| `OperationsDialog` | `src/components/OperationsDialog.tsx` | Modal dialog housing `ControlPanel` for Pipeline B condition realization, Pipeline A analyses, structural edits, and artifact exports. |
| `EditPreviewDialog` | `src/components/EditPreviewDialog.tsx` | Modal diff dialog displaying proposed source edits before apply; displays affected files, edit counts, line diff cards (`replace` vs `insert`), stale warning alerts, optional switch to condition-free (`none`) policy after realization, and provides atomic apply or discard actions. |
| `NodeActionBar` | `src/components/NodeActionBar.tsx` | Contextual action bar displayed above the AST view when an AST node is selected; offers Rename environment, Wrap in environment, and Remove node operations. |
| `ControlPanel` | `src/components/ControlPanel.tsx` | Controlled form organized into Pipeline B (Condition Realization + decision badges), Pipeline A Analyses (`Check References`, `Check Commands`), Pipeline A Structural Edits (`suppress-comments`, `remove-environments`), Pipeline A Project Export (`export-project`), and Generated Artifacts with ZIP/file download. |
| `CodeMirrorView` (exported as `Codeview`) | `src/components/Codeview.tsx` | Owns the imperative CodeMirror `EditorView` lifecycle. Displays a read-only document, replaces it when source changes, and jumps to a requested one-based line or inclusive UTF-16 `jumpRange`. |
| `ASTview` | `src/components/astview/ASTview.tsx` | Displays configured structure or source token syntax, toggles structure/source mode, surfaces blocked/incomplete view issues, filters display nodes, hosts `NodeActionBar`, and persists validated preferences. |
| `AST TreeNode` | `src/components/astview/TreeNode.tsx` | Recursive AST rows with expansion state, labels, icons, source lines, ranges, and selection callbacks. |
| `TreeLayoutBuilder` | `src/components/astview/treebuilder.tsx` | Converts readonly `ConfiguredNode` or `SourceToken[]` values into readonly `LayoutNode` display data. |
| `LogDialog` | `src/components/LogDialog.tsx` | Modal dialog wrapping `LogPanel` for inspecting `ProjectIssue` diagnostics, errors, and analysis findings with badge counts and automatic popup on errors. |
| `LogPanel` | `src/components/LogPanel.tsx` | Renders structured `ProjectIssue` diagnostics, `ProcessingError` errors, and independent `AnalysisFinding` items with severity, code, stale indicators, and jump links. |
| `LayoutNode`, `LayoutNodeKind` | `src/types/LayoutNode.ts` | Website-owned display types, separate from core syntax data; includes `range`, `path`, `occurrenceKey`, and `token` kind. |

## Hooks, services, and state ownership

| Hook or service | State or contract | Role |
| --- | --- | --- |
| `useFiles` | Reducer owning `FilesMap`, `sourceRevision`, `fileVersions`, selected path, and upload errors. | Atomically upserts/removes source buffers; increments `sourceRevision` and `fileVersions` on buffer mutations. |
| `useProjectConfiguration` | `ProjectConfigurationState` (`entryPath`, `traversal`, `conditionPolicy`, `revision`). | Owns stable entry, traversal, and condition policy (`source`, `source-with-overrides`, `manual`, `none`); decoupled from currently viewed file. |
| `useProjectModel` | `ProjectModelResult` (`snapshot`, `view`, `isReady`, `viewIssue`, `issues`, `detectedConditions`, `inventory`, `envInventory`, `error`). | Incrementally maintains immutable `ProjectSnapshot` from sources and derives condition-free `ProjectView` from snapshot + configuration. |
| `useOperations` | `OperationState` (`running`, `result`, `error`, `conditionRealization`, `transformationRunning`, `transformationResult`, `transformationError`, `pendingEditPlan`, `artifacts`, `isStale`, `isEditPlanStale`, `isConditionRealizationStale`). | Coordinates Pipeline B (`realizeConditions`) on snapshots and Pipeline A analyses (`references`, `unused-commands`) and transformations (`suppress-comments`, `remove-environments`, `edit-nodes`, `export-project`) on views with validation, staging, and stale invalidation. |
| `useControl` | `CoreOptionsUI` (`suppressComments`, `suppressCommentEnvironments`, `inputHandling`, `stripDeclarationsAndSetters`, `outputName`) and `DEFAULT_CORE_OPTIONS`. | Owns export and condition-realization UI options using `'preserve' | 'inline'` input handling. |
| `src/services/zip.ts` | Zero-dependency PKZIP 2.0 Store format archive builder with IEEE 802.3 CRC-32 checksums and browser download helpers. | Packages generated artifacts into `.zip` archives without external compression dependencies. |
| `src/services/core.ts` | Pure adapters for `@preptex/core@0.4.0`. | Stateless tokenization, snapshot creation/updates, inventory inspection, standalone condition realization, view resolution, pipeline composition, capabilities, analyses, edit planning, validation, and typed error mapping (`ProcessingError`). |

## Data flow

```mermaid
flowchart TD
  Upload[Filetree / FileReader] --> Files[useFiles: source buffers & revisions]
  Files --> Model[useProjectModel]
  Config[useProjectConfiguration: entry, traversal & conditionPolicy] --> Model
  Model --> Snapshot[ProjectSnapshot: tokens & facts]
  Model --> View[ProjectView: condition-free structure]
  Snapshot --> Realize[useOperations: Pipeline B realizeProjectConditions]
  Realize --> Dialog
  Realize --> Artifacts
  Snapshot --> ASTSource[TreeLayoutBuilder: source tokens]
  View --> ASTConfig[TreeLayoutBuilder: configured tree]
  ASTSource --> AST[ASTview]
  ASTConfig --> AST
  AST --> NodeAction[NodeActionBar: selected node actions]
  NodeAction --> Ops[useOperations: Pipeline A planTransformation]
  Model --> Ops
  Ops --> Log[LogDialog / LogPanel: issues, findings & errors]
  Ops --> Dialog[EditPreviewDialog: pending edit plan]
  Dialog -- Apply --> Files
  Ops --> Artifacts[Generated Artifacts List & Viewer]
  Artifacts --> Zip[zip.ts: download ZIP / file]
  Files --> Code[Codeview: source & range selection]
  Artifacts --> Code
  AST --> Jump[App: jumpRange & line]
  Log --> Jump
  Jump --> Code
  Control[OperationsDialog / ControlPanel: Pipeline B & Pipeline A] --> Ops
```

## PrepTeX integration contract

Import public values and types only from `@preptex/core`.
Authoritative references:
- `node_modules/@preptex/core/dist/docs/integration.md`
- `node_modules/@preptex/core/dist/docs/architecture.md`
- `node_modules/@preptex/core/dist/docs/project-model.md`
- `node_modules/@preptex/core/dist/docs/node-operations.md`
- `node_modules/@preptex/core/dist/docs/migration-0.4.md`
- `node_modules/@preptex/core/dist/docs/website-handoff.md`
- `node_modules/@preptex/core/dist/docs/api/README.md`
- `node_modules/@preptex/core/dist/index.d.ts`

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
