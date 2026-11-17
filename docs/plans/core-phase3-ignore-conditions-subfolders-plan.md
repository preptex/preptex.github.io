# PrepTeX Core (`@preptex/core`) Implementation Plan: All-Branches (`ignore`) Condition Policy, Snapshot-Wide (`target: 'source'`) Transformations, and Subfolder / Relative `\input` Resolution

Status: **Proposed Backend Implementation Specification**
Prepared: 2026-11-17
Baseline: `@preptex/core@0.5.0`
Companion Frontend Plan: [website-phase3-workspace-redesign-plan.md](file:///Users/narekbojikian/workspace/preptex/website/docs/plans/website-phase3-workspace-redesign-plan.md)
Development Guide: [core/AGENTS.md](file:///Users/narekbojikian/workspace/preptex/core/AGENTS.md)

---

## 1. Goal and Core Architectural Invariants

This specification extends `@preptex/core` (and `@preptex/cli`) so that whole-document inspections, AST views, and structural transformations can operate across **all conditional branches** and **nested subfolders** without requiring users to configure Phase 0 boolean condition values upfront:

1. **New `ConditionPolicy` Mode: `{ readonly mode: 'ignore' }` (Visit All Branches / Treat Conditionals as Ordinary Commands)**:
   - Unlike `{ mode: 'none' }`—which asserts that source files are already condition-free and fails `parseConfiguredStructure` with `'unrealized-condition'` (**INV-4**)—`{ mode: 'ignore' }` instructs `evaluateConditionStream` and `parseConfiguredStructure` to **keep all branches active** and treat `\newif`, `\if...`, `\else`, `\fi`, `\Xtrue`, `\Xfalse`, and `etoolbox`/`ifthen` conditionals as ordinary LaTeX commands.
   - When conditional branches are structurally balanced, `resolveProjectView(snapshot, { entryPath, conditions: { mode: 'ignore' } })` produces a `ready` `ProjectView` and `CoarseTree` spanning the entire document.
   - When conditional branches contain mutually exclusive structural mismatches (e.g., `\ifdraft \begin{itemize} \else \begin{enumerate} \fi \item A \end{itemize}`), `parseConfiguredStructure` cleanly reports `status: 'blocked'` with `code: 'structural-error'`, signaling the frontend to prompt for Phase 0 condition evaluation only when needed.
2. **Snapshot-Wide (`target: 'source'`) Transformations Without Phase 0**:
   - Extends `suppress-comments`, `remove-environments`, and `export-project` (in addition to `refactor-symbols`) to execute directly against a `ProjectSnapshot` (`target: 'source'`, `provenance.viewId: null`) and inside `planCompositeTransformation` (`compose-transformations`) so users can rename commands/environments/labels/citations, strip `%` and `comment` environments, remove named environments, and export projects across all branches even when a single-branch `ProjectView` is unconfigured or blocked.
3. **Subfolder & Relative `\input` Resolution (Braced, Quoted, and Parenthesized)**:
   - Supports braced `\input{intro/history.tex}`, quoted `\input{"intro/history.tex"}` / `\input{'intro/history.tex'}`, and parenthesized `\input("intro/history.tex")` / `\input(intro/history.tex)` syntax in `tokenize.ts`, `scan.ts`, `conditions.ts`, and `structure.ts`.
   - Resolves relative `\input` paths against the current file's directory (`virtualDirname(currentFile.path)`) first, and falls back to the entry document's directory (`virtualDirname(entryFile.path)`) and project root (`""`) so standard LaTeX root-relative inclusions from inside subfolders (e.g., `intro/part1.tex` calling `\input{intro/history.tex}`) resolve identically in `evaluateConditionStream` and `dependencies`.

### Preservation of the 6 Core Invariants ([core/AGENTS.md](file:///Users/narekbojikian/workspace/preptex/core/AGENTS.md))

| ID | Invariant | Verification Rule with New Features |
| :--- | :--- | :--- |
| **INV-1** | **Single Stateless Tokenizer** | `tokenizeFile(source)` remains stateless and runs once per file version on snapshot create/update. |
| **INV-2** | **Lossless Token Stream & Zero Re-Lexing** | `file.tokens.map(t => t.value).join('') === file.source`. Quote unwrapping and parenthesized `\input(...)` argument scanning operate strictly over `SourceToken[]` indices and offsets. |
| **INV-3** | **Condition Realizer Ignores Non-Condition Syntax** | `realizeProjectConditions` continues to evaluate only condition tokens on `ProjectSnapshot` and rejects `mode: 'none'` and `mode: 'ignore'` with `PrepTexErrorCode.InvalidArgument`. |
| **INV-4** | **AST Parser Rejects Unrealized Conditions in Non-Ignore Modes** | `parseConfiguredStructure` continues to block with `'unrealized-condition'` when `conditions.mode !== 'ignore'` (including `mode: 'none'`). Only `conditions.mode === 'ignore'` permits condition tokens as ordinary command leaves/nodes. |
| **INV-5** | **Single Shared Condition Realizer** | `resolveProjectView` and `realizeProjectConditions` continue to share `evaluateConditionStream` and `resolveInputTargetPath`. |
| **INV-6** | **Explicit Provenance for View vs. Snapshot Operations** | View-scoped operations (`target: 'selected'`) record `provenance.viewId = view.id` and validate repeated inclusions; snapshot-scoped operations (`target: 'source'`) record `provenance.viewId = null` and operate deterministically across all files and branches. |

---

## 2. Backend Data-Flow Diagram

```mermaid
flowchart TD
    subgraph Stage0["Stage 0: Stateless Tokenizer & Scanner (tokenize.ts, scan.ts)"]
        Raw["SourceFile[] (.tex)"] --> Tok["tokenizeFile(source)\nLossless SourceToken[]"]
        Tok --> Scan["scanFile(file, scanOptions)\n• readInputArgumentTokens: {path}, {\"path\"}, (\"path\")\n• SyntaxFact[] across all branches"]
        Scan --> Snap["ProjectSnapshot (Immutable Authority)"]
    end

    subgraph CondStream["Shared Stream Engine (conditions.ts)"]
        Snap --> Eval["evaluateConditionStream(snapshot, config)\n• resolveInputTargetPath: current-dir -> entry-dir -> root\n• Mode 'source' / 'overrides' / 'manual': evaluates \\if/\\else/\\fi\n• Mode 'none': passes tokens, no removals\n• Mode 'ignore': keeps ALL branches active, treats \\if/\\else/\\fi/\\newif as structure tokens"]
    end

    subgraph ViewLayer["Configured View & AST Parser (view.ts, structure.ts)"]
        Eval -->|"ignoreConditions = (mode === 'ignore')"| Parser["parseConfiguredStructure(selectedTokens, ..., ignoreConditions)\n• ignoreConditions=false: fails with 'unrealized-condition' on \\if/\\else/\\fi (INV-4)\n• ignoreConditions=true: parses \\if/\\else/\\fi as ordinary commands across all branches"]
        Parser --> View["ProjectView (Ready or Blocked on cross-branch mismatch)"]
    end

    subgraph OpsLayer["Operations & Composable Pipeline (operations.ts, transformation.ts, composite.ts)"]
        Snap -->|"target: 'source'\n(viewId: null)"| SnapOps["Snapshot-Wide All-Branches Operations\n• refactor-symbols (target: 'source')\n• suppress-comments (target: 'source')\n• remove-environments (target: 'source')\n• export-project (on snapshot via ignore stream)\n• compose-transformations (chains snapshot steps)"]
        View -->|"target: 'selected' | 'artifact'\n(viewId: view.id)"| ViewOps["Branch-Realized View Operations\n• edit-nodes\n• suppress-comments / remove-environments / refactor-symbols (target: 'selected')\n• references / unused-commands\n• export-project"]
    end
```

---

## 3. Step-by-Step Backend Implementation Specification

### Step B1: Public API Types, Option Normalizers & CLI Arguments

#### 3.1.1 Public Types in [core/core/src/project-types.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/project-types.ts)
1. **Extend `ConditionPolicy` (lines 345–370)**:
   ```ts
   export type ConditionPolicy =
     | {
         /** Follow reached \newif declarations and boolean assignments in source order. */
         readonly mode: 'source';
         /** Seed values before entry; declarations reset them to false. */
         readonly initialValues?: BooleanValues;
       }
     | {
         /** Force only named values supplied here; omitted names are unknown. */
         readonly mode: 'manual';
         /** Permanent per-test named values. */
         readonly values: BooleanValues;
       }
     | {
         /** Track source and force specified names at each test. */
         readonly mode: 'source-with-overrides';
         /** Permanent per-test overrides. */
         readonly overrides: BooleanValues;
         /** Initial source state, reset by declarations. */
         readonly initialValues?: BooleanValues;
       }
     | {
         /** Assert no conditionals exist in the reached source; any conditional syntax stops with unrealized-condition. */
         readonly mode: 'none';
       }
     | {
         /** Do not evaluate or strip conditionals; visit all branches and treat conditional commands as ordinary commands. */
         readonly mode: 'ignore';
       };
   ```
2. **Extend `suppress-comments` Target in `CompositeStepRequest` (lines 816–828) and `OperationRequest` (lines 880–892)**:
   - Update `readonly target?: 'selected'` to `readonly target?: 'selected' | 'source'`.
3. **Extend `ExportOptions` (lines 907–918) for Snapshot-Level Export**:
   - Add optional fields used when `planTransformation(snapshot, { operation: 'export-project', options })` is called directly on a `ProjectSnapshot`:
     ```ts
     /** Entry virtual path when exporting directly from a ProjectSnapshot; defaults to 'main.tex' or single file. */
     readonly entryPath?: string;
     /** Input traversal policy when exporting directly from a ProjectSnapshot; default 'project'. */
     readonly traversal?: 'project' | 'file-only';
     ```

#### 3.1.2 Node Operation Types in [core/core/src/node-types.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/node-types.ts)
- In `NodeTransformationRequest` (lines 220–227), widen `target` on `remove-environments`:
  ```ts
  | {
      /** Remove matching literal environments from the realized view or across all source files. */
      readonly operation: 'remove-environments';
      /** Explicit selected, source-wide, or artifact scope. */
      readonly options: {
        /** Configured selected occurrences, all source files, or artifact export. */
        readonly target: 'selected' | 'source' | 'artifact';
        /** Case-sensitive literal names; nonempty, sorted during normalization. */
        readonly names: readonly string[];
        /** Total output UTF-16 bound, default 10000000. */
        readonly maxOutputCodeUnits?: number;
      };
    };
  ```

#### 3.1.3 Configuration & Option Normalizers
- **[core/core/src/lib/project/configuration.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/configuration.ts)**:
  - Update `normalizeConditionPolicy(value: unknown = { mode: 'source' }, allowNone = true, allowIgnore = true): ConditionPolicy`:
    ```ts
    if (allowIgnore && input['mode'] === 'ignore') {
      fields(input, ['mode'], 'ignore policy');
      return { mode: 'ignore' };
    }
    ```
  - In `normalizeConfiguration(value: unknown)`, call `normalizeConditionPolicy(input['conditions'], true, true)`. Keep `{ mode: 'source' }` as the fallback when `input['conditions'] === undefined` so all existing core callers and tests remain 100% backward-compatible.
- **[core/core/src/lib/project/node-options.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/node-options.ts)**:
  - In `normalizeNodeOperation` (lines 259–295):
    - For `operation === 'edit-nodes'`: require `target === 'selected' || target === 'artifact'`.
    - For `operation === 'remove-environments'`: allow `target === 'selected' || target === 'source' || target === 'artifact'`.

#### 3.1.4 CLI Argument Support in [core/cli/src/project-args.ts](file:///Users/narekbojikian/workspace/preptex/core/cli/src/project-args.ts)
- In `consumeConditionFlag` (lines 85–97): accept `'ignore'` alongside `'source' | 'manual' | 'source-with-overrides' | 'none'`.
- In `finalizeConditionPolicy` (lines 118–143):
  - Reject `mode === 'ignore'` when `options?.allowNone === false` (`'ignore condition mode is not valid for condition realization.'`).
  - Reject `--condition` and `--initial` flags when `mode === 'ignore'`.
  - Return `{ mode: 'ignore' }` when `mode === 'ignore'`.

---

### Step B2: `ConditionPolicy` `{ mode: 'ignore' }` in Condition Stream & AST Parser

#### 3.2.1 Condition Stream Evaluation ([core/core/src/lib/project/conditions.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/conditions.ts))
1. In `normalizeConditionRealizationRequest` (line 1112):
   - Call `normalizeConditionPolicy(input['conditions'], false, false)` so `realizeProjectConditions` rejects `{ mode: 'ignore' }` with `PrepTexErrorCode.InvalidArgument`.
2. In `evaluateConditionStream`:
   - Define `const evaluateConds = policy.mode !== 'none' && policy.mode !== 'ignore';`.
   - Use `evaluateConds` at:
     - Line 306 (`initial` seed map initialization: ` !evaluateConds || policy.mode === 'manual' ? {} : (policy.initialValues ?? {})`)
     - Line 465 (`if (evaluateConds) { ... }` around conditional test/delimiter evaluation)
     - Line 684 (`if (evaluateConds) { ... }` around `\global`, boolean setters, and `\newif`)
     - Line 799 (`if (evaluateConds && /^[A-Za-z]+(?:true|false)$/.test(token.name))` unassigned setter check)
     - Line 1006 (`rawRemovals` collection: empty in `'ignore'` and `'none'` modes)
   - At line 791:
     ```ts
     if (
       UNSUPPORTED_EFFECTS.has(token.name) ||
       (policy.mode !== 'ignore' && ORDINARY_IF_COMMANDS.has(token.name) && token.name !== 'iff')
     ) {
       stop('unsupported-effect', `\\${token.name} has semantics outside the direct profile.`, at);
       continue;
     }
     ```
     In `'ignore'` mode, `ORDINARY_IF_COMMANDS` (`\ifthenelse`, `\ifstrequal`, `\ifstrempty`, `\ifboolexpr`) are also treated as normal commands rather than stopping with `'unsupported-effect'`.

#### 3.2.2 Structural AST Parser ([core/core/src/lib/project/view.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/view.ts) & [core/core/src/lib/project/structure.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/structure.ts))
1. In [view.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/view.ts#L87-L93), pass `config.conditions.mode === 'ignore'` as the 6th argument (`ignoreConditions`) to `parseConfiguredStructure`:
   ```ts
   const parsed = parseConfiguredStructure(
     evaluation.selectedTokens,
     id,
     config.limits.maxNesting,
     source,
     commandSignatures,
     config.conditions.mode === 'ignore'
   );
   ```
2. In [structure.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/structure.ts):
   - Add `ignoreConditions = false` to `parseConfiguredStructure`.
   - Gate the single-token `tex-arg` conditional check (lines 679–684) with `!ignoreConditions`:
     ```ts
     if (
       argCmd === 'begin' ||
       argCmd === 'end' ||
       sectionLevel(argCmd) !== undefined ||
       (!ignoreConditions &&
         (argCmd === 'newif' ||
           argCmd === 'else' ||
           argCmd === 'fi' ||
           testKind(argCmd) !== null ||
           declaredSetters.has(argCmd)))
     )
     ```
   - Gate the top-level `'unrealized-condition'` guard (lines 947–960) with `!ignoreConditions`:
     ```ts
     if (
       !ignoreConditions &&
       (command === 'newif' ||
         command === 'else' ||
         command === 'fi' ||
         testKind(command) !== null ||
         declaredSetters.has(command))
     ) {
       fail(
         `Unrealized conditional command \\${command} encountered in structural parser. Realize conditions before building the AST.`,
         i,
         'unrealized-condition'
       );
       break;
     }
     ```
   - When `ignoreConditions === true`:
     - Conditional commands (`\newif`, `\ifdraft`, `\else`, `\fi`, `\drafttrue`) are emitted as ordinary command leaf tokens in the `ConfiguredNode` tree.
     - In `buildCoarseViewTree` ([coarse-tree.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/coarse-tree.ts)), ensure `shouldIncludeCommand` excludes raw conditional scaffolding tokens (`newif`, `else`, `fi`, `testKind(name) !== null`, and declared setters) unless `includeBuiltinCommands` is enabled, keeping the default Coarse Tree clean while including all sections, environments, and commands from every branch.

---

### Step B3: Subfolder & Relative `\input` Resolution (Braced, Quoted, and Parenthesized)

#### 3.3.1 Flexible `\input` Argument Reader ([core/core/src/lib/project/tokenize.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/tokenize.ts) & [core/core/src/lib/project/scan.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/scan.ts))
1. In `tokenize.ts`, export `readInputArgumentTokens(tokens: readonly SourceToken[], startIndex: number, untilIndex = tokens.length): BracedGroupMatch | null`:
   - First tries `readBracedGroupTokens(tokens, startIndex, untilIndex)` (handles `\input{intro/history.tex}` and `\input{"intro/history.tex"}`).
   - If `readBracedGroupTokens` returns `null`, inspects the token at `skipTriviaTokens(tokens, startIndex, untilIndex)`:
     - If that token is `kind === 'text'` and starts with `'('` (e.g., `\input("intro/history.tex")` or `\input(intro/history.tex)`), scans forward within the same line until the matching `')'` character, returning a `BracedGroupMatch`-compatible span (`openIndex`, `closeIndex`, `nextIndex`, `start`, `end`, `innerStart`, `innerEnd`, `text`) covering the parenthesized argument.
2. In `scan.ts`, add `unwrapQuotedInputLiteral(arg: LiteralArgument, starts: readonly number[]): LiteralArgument`:
   - When `arg.kind === 'literal'`, trims optional surrounding matching double quotes `"..."` or single quotes `'...'` (e.g., `"intro/history.tex"` $\rightarrow$ `intro/history.tex`) and narrows `arg.range` to the unquoted interior offsets via `rangeAt(starts, ...)`.
3. Use `readInputArgumentTokens` + `unwrapQuotedInputLiteral` in:
   - `scanFile` ([scan.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/scan.ts#L433-L460)) when `token.name === 'input'`.
   - `evaluateConditionStream` ([conditions.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/conditions.ts#L810-L815)) when `token.name === 'input'`.

#### 3.3.2 Multi-Root Relative Path Resolution ([core/core/src/lib/project/conditions.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/conditions.ts) & [core/core/src/lib/project/emission.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/emission.ts))
In standard LaTeX (`pdflatex`/`xelatex`/`lualatex`), `\input{intro/history.tex}` inside an already-included subfolder file `intro/part1.tex` resolves relative to the entry document's directory (`main.tex`), whereas `\input{../shared/macros.tex}` or `\input{sibling.tex}` may be written relative to `intro/part1.tex`.

Add shared helper `resolveInputCandidates(rawPath: string, currentFilePath: string, entryFilePath: string, fileExists: (p: string) => boolean)` in [virtual-path.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/virtual-path.ts):
```ts
export type ResolvedInputLookup =
  | { readonly status: 'invalid-path'; readonly matches: readonly [] }
  | { readonly status: 'missing' | 'present' | 'ambiguous'; readonly matches: readonly string[] };

export function resolveVirtualInputPath(
  rawPath: string,
  currentFilePath: string,
  entryFilePath: string,
  hasFile: (path: string) => boolean
): ResolvedInputLookup
```
Resolution order:
1. If `/^(?:[\\/]|[A-Za-z]:)/.test(rawPath) || rawPath.includes('\0')`, return `{ status: 'invalid-path', matches: [] }`.
2. **Current-file-relative**:
   - `const currentBase = virtualDirname(currentFilePath);`
   - `const relCurrent = normalizeVirtualPath(currentBase ? `${currentBase}/${rawPath}` : rawPath);`
   - If `!relCurrent`, return `{ status: 'invalid-path', matches: [] }` (preserves **F10** `\input{../outside}` escaping the virtual root).
   - `const currentMatches = [...new Set([relCurrent, withTexExtension(relCurrent)])].filter(hasFile);`
   - If `currentMatches.length > 0`, return `{ status: currentMatches.length === 1 ? 'present' : 'ambiguous', matches: currentMatches }`.
3. **Entry-directory-relative fallback** (when `virtualDirname(entryFilePath) !== currentBase` and `!rawPath.startsWith('.')`):
   - `const entryBase = virtualDirname(entryFilePath);`
   - `const relEntry = normalizeVirtualPath(entryBase ? `${entryBase}/${rawPath}` : rawPath);`
   - If `relEntry`:
     - `const entryMatches = [...new Set([relEntry, withTexExtension(relEntry)])].filter(hasFile);`
     - If `entryMatches.length > 0`, return `{ status: entryMatches.length === 1 ? 'present' : 'ambiguous', matches: entryMatches }`.
4. **Workspace-root-relative fallback** (when `entryBase !== ''` and `!rawPath.startsWith('.')`):
   - `const relRoot = normalizeVirtualPath(rawPath);`
   - If `relRoot`:
     - `const rootMatches = [...new Set([relRoot, withTexExtension(relRoot)])].filter(hasFile);`
     - If `rootMatches.length > 0`, return `{ status: rootMatches.length === 1 ? 'present' : 'ambiguous', matches: rootMatches }`.
5. Otherwise return `{ status: 'missing', matches: [] }`.

Wire `resolveVirtualInputPath` into:
- `evaluateConditionStream` in [conditions.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/conditions.ts#L821-L851) (passing `entryFile.path` as `entryFilePath`).
- `dependencies` in [emission.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/emission.ts#L174-L195) (passing `artifacts[0]?.path ?? artifact.path` as `entryFilePath`).

---

### Step B4: Snapshot-Wide (`target: 'source'`) All-Branches Transformations

#### 3.4.1 Snapshot-Wide Comment Suppression ([core/core/src/lib/project/comment-edits.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/comment-edits.ts))
- Update `commentEdits(source: ProjectSnapshot, files: readonly ScannedFile[], view?: ProjectView): ProjectEdit[]`:
  - When `view` is provided (`target === 'selected'`), keep the existing `view.selectedTokens` loop and `validateOccurrenceEdits(view, candidates)`.
  - When `view` is `undefined` (`target === 'source'`):
    - For each `file` in `files`:
      - Compute verbatim token intervals via `matchVerbatimTokens` so `%` inside `\verb` or `\begin{verbatim}` / `lstlisting` / `minted` is never touched.
      - For every non-verbatim token with `token.kind === 'comment'`, if `safeComment(source, file, token.range.start, token.range.end)`, push `commentEdit(source, file, token.range.start, token.range.end)`.
    - Run the existing per-file `boundaryDelimiter` pass so adjacent comment removals preserve exact token boundaries.

#### 3.4.2 Snapshot-Wide Environment Removal ([core/core/src/lib/project/node-edits.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/node-edits.ts))
- Export `snapshotEnvironmentRemovalEdits(source: ProjectSnapshot, names: readonly string[]): ProjectEdit[]`:
  - Call `inspectProjectEnvironments(source)` to inspect all environments across `source.files`.
  - Filter `env` where `env.name !== null && names.includes(env.name)`.
  - If any matching environment has `env.status !== 'matched'` or `env.protected`, call `reject('unavailable', `Environment ${env.name ?? ''} is unmatched or inside a protected region.`, [{ snapshotId: source.id, occurrenceId: null, path: env.path, range: env.range }])`.
  - Group matched environments by `env.path`, discard nested environments whose `[range.start, range.end]` is already contained inside an outer removed environment, expand standalone-line bounds (matching `nodeSourceEdits`), and return `sourceChanges(source, byPath)`.

#### 3.4.3 Routing & Capability Checks ([source-operations.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/source-operations.ts), [operations.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/operations.ts), [transformation.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/transformation.ts), [composite.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/composite.ts))
1. **[source-operations.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/source-operations.ts)**:
   - In `sourceOperationEdits(source, request, view)`:
     - If `request.operation === 'remove-environments'`:
       - When `request.options.target === 'source'`, return `snapshotEnvironmentRemovalEdits(source, request.options.names)`.
       - When `request.options.target === 'selected'`, require `view` and return `nodeSourceEdits(view, environmentActions(view, request.options.names))`.
     - If `request.operation === 'suppress-comments'`:
       - Obtain `comments = commentEdits(source, source.files, request.options?.target === 'source' ? undefined : view)`.
       - Obtain `environments = request.options?.suppressCommentEnvironments ? (request.options?.target === 'source' ? snapshotEnvironmentRemovalEdits(source, ['comment']) : nodeSourceEdits(view!, environmentActions(view!, ['comment']))) : []`.
       - Merge `comments` and `environments` per file as today and return `sourceChanges(source, byPath)`.
2. **[operations.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/operations.ts)**:
   - Update `projectOperations` descriptors for `remove-environments`, `suppress-comments`, and `export-project` to `scopes: ['all-files', 'configured']`.
   - In `validateOperation`:
     - For `suppress-comments` (line 191): allow `target === 'selected' || target === 'source'`.
     - For `export-project` (line 205): allow optional `entryPath` and `traversal`.
   - In `checkOperationCapability` (lines 281–388):
     - Allow `model.kind === 'snapshot'` when:
       - `operation.operation === 'refactor-symbols' && (operation.options.target === undefined || operation.options.target === 'source')`
       - `operation.operation === 'suppress-comments' && operation.options?.target === 'source'`
       - `operation.operation === 'remove-environments' && operation.options.target === 'source'`
       - `operation.operation === 'export-project'`
   - In `validateProjectEditPlan` (lines 438–455):
     - Treat `suppress-comments` (`target === 'source'`) and `remove-environments` (`target === 'source'`) as source-local edit plans (`viewId === null`).
3. **[transformation.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/transformation.ts)**:
   - In `planTransformation`:
     - Allow `normalized.kind === 'snapshot'` for `suppress-comments` (`target === 'source'`) and `remove-environments` (`target === 'source'`), setting `provenance.viewId = null`.
     - When `operation.operation === 'export-project'` and `normalized.kind === 'snapshot'`:
       - Resolve an internal all-branches view/trace with `conditions: { mode: 'ignore' }`, `entryPath: operation.options.entryPath ?? (normalized.files.some(f => f.path === 'main.tex') ? 'main.tex' : normalized.files[0]?.path ?? 'main.tex')`, and `traversal: operation.options.traversal ?? 'project'`, and emit the exported artifacts (`provenance.viewId = null`).
4. **[composite.ts](file:///Users/narekbojikian/workspace/preptex/core/core/src/lib/project/composite.ts)**:
   - Expand `isSnapshotStep` (lines 349–351) to include `suppress-comments` (`target === 'source'`) and `remove-environments` (`target === 'source'`) so multi-step pipelines of whole-document operations execute directly on `currentSnapshot` without requiring `resolveProjectView`.

---

## 4. Backend Testing, Documentation & Verification Pipeline

Per [core/AGENTS.md](file:///Users/narekbojikian/workspace/preptex/core/AGENTS.md), every public change must be verified across runtime tests, compile-time type tests, CLI tests, TypeDoc generation, and package tarball inspection:

1. **Unit & Regression Tests (`core/core/tests/`)**:
   - [core/core/tests/project-model.test.ts](file:///Users/narekbojikian/workspace/preptex/core/core/tests/project-model.test.ts):
     - `resolveProjectView` with `conditions: { mode: 'ignore' }` retains tokens and facts from both `\if...` and `\else` branches, builds a `ready` AST when branches are balanced, and reports `status: 'blocked'` (`structural-error`) when branches contain mismatched delimiters.
     - Subfolder `\input` resolution: `\input{intro/history.tex}` from `main.tex`, root-relative `\input{intro/history.tex}` from `intro/part1.tex`, sibling `\input{history.tex}` from `intro/part1.tex`, quoted `\input{"intro/history.tex"}`, and parenthesized `\input("intro/history.tex")`.
   - [core/core/tests/project-operations.test.ts](file:///Users/narekbojikian/workspace/preptex/core/core/tests/project-operations.test.ts):
     - `suppress-comments` (`target: 'source'`, with and without `suppressCommentEnvironments`) removes comments in both `\ifdraft` and `\else` branches on a `ProjectSnapshot`.
     - `remove-environments` (`target: 'source'`) removes matched environments in all conditional branches on a `ProjectSnapshot` and rejects unmatched/protected environments.
     - `export-project` on a `ProjectSnapshot` exports all branches with `inputs: 'preserve'` and `inputs: 'inline'`.
   - [core/core/tests/composite.test.ts](file:///Users/narekbojikian/workspace/preptex/core/core/tests/composite.test.ts):
     - `planCompositeTransformation` chains `refactor-symbols` (`target: 'source'`) $\rightarrow$ `suppress-comments` (`target: 'source'`) $\rightarrow$ `remove-environments` (`target: 'source'`) on a snapshot with conditionals and produces a single valid `ProjectEditPlan`.
   - [core/cli/tests/](file:///Users/narekbojikian/workspace/preptex/core/cli/tests):
     - Test `--condition-mode ignore` in CLI `analyze` args.
2. **Compile-Time Type Tests (`core/core/type-tests/`)**:
   - [core/core/type-tests/project-model.ts](file:///Users/narekbojikian/workspace/preptex/core/core/type-tests/project-model.ts) & [node-operations.ts](file:///Users/narekbojikian/workspace/preptex/core/core/type-tests/node-operations.ts):
     - Verify `resolveProjectView(snapshot, { entryPath: 'main.tex', conditions: { mode: 'ignore' } })`.
     - Verify `planTransformation(snapshot, { operation: 'suppress-comments', options: { target: 'source' } })` and `planTransformation(snapshot, { operation: 'remove-environments', options: { target: 'source', names: ['comment'] } })`.
3. **Documentation & TypeDoc (`core/docs/`)**:
   - Update `core/docs/architecture.md`, `core/docs/integration.md`, `core/docs/project-model.md`, `core/docs/node-operations.md`, and `core/docs/website-handoff.md`.
   - Run `npm run docs` to regenerate `core/docs/api/`.
4. **Full Verification Commands (run in `/Users/narekbojikian/workspace/preptex/core`)**:
   ```sh
   npm run check
   npm run pack:check
   ```
   Then build and sync `dist/` for the website consumer (`npm run prepack --workspace=@preptex/core`).
