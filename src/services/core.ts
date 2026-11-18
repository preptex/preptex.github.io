import {
  applyProjectEdits,
  buildCoarseViewTree,
  checkOperationCapability,
  createProjectSnapshot,
  createProjectSourceIndex,
  extractProjectMetadata,
  getSelectedEnvironment,
  getSelectedNode,
  inspectProject,
  inspectProjectCatalog,
  inspectProjectEnvironments,
  isConfiguredContainerNode,
  lookupProjectSource,
  planCompositeTransformation,
  planTransformation,
  PrepTexError,
  PrepTexErrorCode,
  ProjectOperationError,
  realizeProjectConditions,
  resolveProjectView,
  runAnalysis,
  runProjectPipeline,
  selectProjectNode,
  sourceOffsetAt,
  tokenizeFile,
  updateProjectSnapshot as updateProjectSnapshotCore,
  validateProjectEditPlan,
  walkConfiguredNodes,
} from '@preptex/core';
import type {
  AnalysisRequest,
  AnalysisResult,
  CoarseTree,
  CoarseTreeOptions,
  CompositeTransformationRequest,
  ConditionRealizationRequest,
  ConditionRealizationResult,
  ConfiguredContainerNode,
  ConfiguredNode,
  CustomCommandSignature,
  EnvironmentInventory,
  EnvironmentSelection,
  InventoryRequest,
  InventoryResult,
  NodeSelection,
  OperationCapability,
  OperationFailure,
  OperationRequest,
  ProjectCatalog,
  ProjectEditPlan,
  ProjectMetadata,
  ProjectPipelineOptions,
  ProjectPipelineResult,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectSourceChange,
  ProjectSourceIndex,
  ProjectView,
  ScanOptions,
  SourceFile,
  SourceLookupHit,
  SourceLookupQuery,
  SourceScope,
  SourceToken,
  TransformationRequest,
  TransformationResult,
  ViewConfiguration,
  ViewInputMode,
} from '@preptex/core';

export type { ViewInputMode };

export type ProcessingError =
  | {
      readonly kind: 'operation';
      readonly message: string;
      readonly code: PrepTexErrorCode;
      readonly failure: OperationFailure;
    }
  | { readonly kind: 'core'; readonly message: string; readonly code: PrepTexErrorCode }
  | { readonly kind: 'unexpected'; readonly message: string };

export function toProcessingError(error: unknown): ProcessingError {
  if (error instanceof ProjectOperationError) {
    return {
      kind: 'operation',
      message: error.message,
      code: error.code,
      failure: error.failure,
    };
  }
  if (error instanceof PrepTexError) {
    return {
      kind: 'core',
      message: error.message,
      code: error.code,
    };
  }
  return {
    kind: 'unexpected',
    message: error instanceof Error ? error.message : String(error),
  };
}

// ---------------------------------------------------------------------------
// Pure Core Adapters (@preptex/core@0.4.0)
// ---------------------------------------------------------------------------

export function tokenizeFileAdapter(source: string): readonly SourceToken[] {
  return tokenizeFile(source);
}

export function createProjectSnapshotAdapter(
  files: readonly SourceFile[],
  scanOptions?: ScanOptions,
): CoreProjectSnapshot {
  return createProjectSnapshot(files, scanOptions);
}

export function updateProjectSnapshotAdapter(
  snapshot: CoreProjectSnapshot,
  changes: readonly ProjectSourceChange[],
  scanOptions?: ScanOptions,
): CoreProjectSnapshot {
  return updateProjectSnapshotCore(snapshot, changes, scanOptions);
}

export function inspectProjectAdapter(
  snapshot: CoreProjectSnapshot,
  request?: InventoryRequest,
): InventoryResult {
  return inspectProject(snapshot, request);
}

export function inspectProjectEnvironmentsAdapter(
  snapshot: CoreProjectSnapshot,
  scope?: SourceScope,
): EnvironmentInventory {
  return inspectProjectEnvironments(snapshot, scope);
}

export function getSelectedEnvironmentAdapter(
  snapshot: CoreProjectSnapshot,
  selection: EnvironmentSelection,
) {
  return getSelectedEnvironment(snapshot, selection);
}

export function realizeProjectConditionsAdapter(
  snapshot: CoreProjectSnapshot,
  request?: ConditionRealizationRequest,
): ConditionRealizationResult {
  return realizeProjectConditions(snapshot, request);
}

export function resolveProjectViewAdapter(
  snapshot: CoreProjectSnapshot,
  configuration: ViewConfiguration,
): ProjectView {
  return resolveProjectView(snapshot, configuration);
}

export function runProjectPipelineAdapter(
  files: readonly SourceFile[],
  options: ProjectPipelineOptions,
): ProjectPipelineResult {
  return runProjectPipeline(files, options);
}

export function checkOperationCapabilityAdapter(
  model: CoreProjectSnapshot | ProjectView,
  request: OperationRequest,
): OperationCapability {
  return checkOperationCapability(model, request);
}

export function walkConfiguredNodesAdapter(root: ConfiguredNode): readonly ConfiguredNode[] {
  return walkConfiguredNodes(root);
}

export function isConfiguredContainerNodeAdapter(
  node: ConfiguredNode,
): node is ConfiguredContainerNode {
  return isConfiguredContainerNode(node);
}

export function selectProjectNodeAdapter(
  view: ProjectView,
  nodeKey: string,
): NodeSelection {
  return selectProjectNode(view, nodeKey);
}

export function getSelectedNodeAdapter(
  view: ProjectView,
  selection: NodeSelection,
): ConfiguredNode {
  return getSelectedNode(view, selection);
}

export function createProjectSourceIndexAdapter(
  model: CoreProjectSnapshot | ProjectView,
): ProjectSourceIndex {
  return createProjectSourceIndex(model);
}

export function lookupProjectSourceAdapter(
  index: ProjectSourceIndex,
  query: SourceLookupQuery,
): readonly SourceLookupHit[] {
  return lookupProjectSource(index, query);
}

export function sourceOffsetAtAdapter(
  index: ProjectSourceIndex,
  path: string,
  line: number,
  column?: number,
): number {
  return sourceOffsetAt(index, path, line, column);
}

export function runAnalysisAdapter(
  view: ProjectView,
  request: AnalysisRequest,
): AnalysisResult {
  return runAnalysis(view, request);
}

export function planTransformationAdapter(
  model: CoreProjectSnapshot | ProjectView,
  request: TransformationRequest,
): TransformationResult {
  return planTransformation(model, request);
}

export function applyProjectEditsAdapter(
  snapshot: CoreProjectSnapshot,
  plan: ProjectEditPlan,
  view?: ProjectView,
): CoreProjectSnapshot {
  return applyProjectEdits(snapshot, plan, view);
}

export function validateProjectEditPlanAdapter(
  snapshot: CoreProjectSnapshot,
  plan: ProjectEditPlan,
  view?: ProjectView,
): { readonly eligible: true } | { readonly eligible: false; readonly error: ProcessingError } {
  try {
    validateProjectEditPlan(snapshot, plan, view);
    return { eligible: true };
  } catch (err: unknown) {
    return { eligible: false, error: toProcessingError(err) };
  }
}

// ---------------------------------------------------------------------------
// Phase 2 Adapters: Coarse Tree, Symbol Catalog, Metadata & Composite Edits
// ---------------------------------------------------------------------------

export function buildCoarseViewTreeAdapter(
  view: ProjectView,
  options?: CoarseTreeOptions,
): CoarseTree {
  return buildCoarseViewTree(view, options);
}

export function inspectProjectCatalogAdapter(
  model: CoreProjectSnapshot | ProjectView,
  options?: {
    readonly scope?: SourceScope;
    readonly customCommands?: readonly CustomCommandSignature[];
  },
): ProjectCatalog {
  return inspectProjectCatalog(model, options);
}

export function extractProjectMetadataAdapter(
  model: CoreProjectSnapshot | ProjectView,
): ProjectMetadata {
  return extractProjectMetadata(model);
}

export function planCompositeTransformationAdapter(
  model: CoreProjectSnapshot | ProjectView,
  request: CompositeTransformationRequest['options'],
): TransformationResult {
  return planCompositeTransformation(model, request);
}

function isSurrogateSplit(source: string, pos: number): boolean {
  if (pos <= 0 || pos >= source.length) return false;
  const prev = source.charCodeAt(pos - 1);
  const next = source.charCodeAt(pos);
  return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
}

export function applyExternalProjectEditPlanAdapter(
  snapshot: CoreProjectSnapshot,
  plan: ProjectEditPlan,
  view?: ProjectView,
):
  | { readonly ok: true; readonly files: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly error: ProcessingError } {
  if (plan.provenance.snapshotId !== snapshot.id) {
    return {
      ok: false,
      error: {
        kind: 'core',
        code: PrepTexErrorCode.EditConflict,
        message: 'The edit plan belongs to a different source snapshot.',
      },
    };
  }
  if (plan.provenance.viewId !== null && (!view || view.id !== plan.provenance.viewId)) {
    return {
      ok: false,
      error: {
        kind: 'core',
        code: PrepTexErrorCode.EditConflict,
        message: 'The edit plan belongs to a different configured view.',
      },
    };
  }

  const fileMap = new Map(snapshot.files.map((file) => [file.path, file.source]));
  const editsByPath = new Map<string, (typeof plan.edits)[number][]>();
  let previousPath = '';
  let previousEnd = -1;
  let previousInsertion = false;

  for (const edit of plan.edits) {
    const source = fileMap.get(edit.path);
    if (source === undefined) {
      return {
        ok: false,
        error: {
          kind: 'core',
          code: PrepTexErrorCode.InvalidArgument,
          message: `An edit targets absent file "${edit.path}".`,
        },
      };
    }

    let start: number;
    let end: number;
    if (edit.kind === 'insert') {
      if (!Number.isSafeInteger(edit.offset) || edit.offset < 0 || edit.offset > source.length) {
        return {
          ok: false,
          error: {
            kind: 'core',
            code: PrepTexErrorCode.InvalidArgument,
            message: `Invalid insertion offset in "${edit.path}".`,
          },
        };
      }
      start = edit.offset;
      end = edit.offset;
    } else {
      if (
        !Number.isSafeInteger(edit.range.start) ||
        !Number.isSafeInteger(edit.range.end) ||
        edit.range.start < 0 ||
        edit.range.end < edit.range.start ||
        edit.range.end + 1 > source.length
      ) {
        return {
          ok: false,
          error: {
            kind: 'core',
            code: PrepTexErrorCode.InvalidArgument,
            message: `Invalid replacement range in "${edit.path}".`,
          },
        };
      }
      start = edit.range.start;
      end = edit.range.end + 1;
      if (source.slice(start, end) !== edit.expected) {
        return {
          ok: false,
          error: {
            kind: 'core',
            code: PrepTexErrorCode.EditConflict,
            message: `Edit expected contents do not match "${edit.path}".`,
          },
        };
      }
    }

    if (isSurrogateSplit(source, start) || isSurrogateSplit(source, end)) {
      return {
        ok: false,
        error: {
          kind: 'core',
          code: PrepTexErrorCode.InvalidArgument,
          message: `Edit boundary splits a UTF-16 surrogate pair in "${edit.path}".`,
        },
      };
    }

    if (
      edit.path < previousPath ||
      (edit.path === previousPath &&
        (start < previousEnd || (start === previousEnd && previousInsertion)))
    ) {
      return {
        ok: false,
        error: {
          kind: 'core',
          code: PrepTexErrorCode.InvalidArgument,
          message: 'Edits must be ordered and nonoverlapping.',
        },
      };
    }

    previousPath = edit.path;
    previousEnd = end;
    previousInsertion = edit.kind === 'insert';

    const list = editsByPath.get(edit.path) ?? [];
    list.push(edit);
    editsByPath.set(edit.path, list);
  }

  const updatedFiles: Record<string, string> = {};
  for (const file of snapshot.files) {
    const fileEdits = editsByPath.get(file.path);
    if (!fileEdits || fileEdits.length === 0) {
      updatedFiles[file.path] = file.source;
      continue;
    }
    let pos = 0;
    const chunks: string[] = [];
    for (const edit of fileEdits) {
      const start = edit.kind === 'replace' ? edit.range.start : edit.offset;
      const end = edit.kind === 'replace' ? edit.range.end + 1 : edit.offset;
      const text = edit.kind === 'replace' ? edit.replacement : edit.text;
      chunks.push(file.source.slice(pos, start), text);
      pos = end;
    }
    chunks.push(file.source.slice(pos));
    updatedFiles[file.path] = chunks.join('');
  }

  return { ok: true, files: updatedFiles };
}
