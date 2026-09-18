import {
  applyProjectEdits,
  checkOperationCapability,
  createProjectSnapshot,
  createProjectSourceIndex,
  getSelectedEnvironment,
  getSelectedNode,
  inspectProject,
  inspectProjectEnvironments,
  isConfiguredContainerNode,
  lookupProjectSource,
  mergeProjects,
  parseProject,
  planTransformation,
  PrepTexError,
  PrepTexErrorCode,
  PrepTexSyntaxError,
  ProjectOperationError,
  resolveProjectView,
  runAnalysis,
  selectProjectNode,
  sourceOffsetAt,
  updateProjectSnapshot as updateProjectSnapshotCore,
  walkConfiguredNodes,
} from '@preptex/core';
import type {
  AnalysisRequest,
  AnalysisResult,
  ConfiguredContainerNode,
  ConfiguredNode,
  EnvironmentInventory,
  EnvironmentSelection,
  InventoryRequest,
  InventoryResult,
  NodeSelection,
  OperationCapability,
  OperationFailure,
  OperationRequest,
  ParsedProject,
  ProjectEditPlan,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectSourceChange,
  ProjectSourceIndex,
  ProjectView,
  ScanOptions,
  SourceFile,
  SourceLookupHit,
  SourceLookupQuery,
  SourceScope,
  SyntaxDiagnostic,
  TransformationRequest,
  TransformationResult,
  TransformOptions,
  ViewConfiguration,
} from '@preptex/core';
import type { CoreOptionsUI } from '../model/useControl';
import type { FilesMap } from '../types/files';

export type ProcessingError =
  | {
      readonly kind: 'syntax';
      readonly message: string;
      readonly code: PrepTexErrorCode.SyntaxError;
      readonly diagnostic: SyntaxDiagnostic;
    }
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
  if (error instanceof PrepTexSyntaxError) {
    return {
      kind: 'syntax',
      message: error.message,
      code: error.code,
      diagnostic: error.diagnostic,
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
// Pure Core Adapters (@preptex/core@0.3.0)
// ---------------------------------------------------------------------------

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

export function resolveProjectViewAdapter(
  snapshot: CoreProjectSnapshot,
  configuration: ViewConfiguration,
): ProjectView {
  return resolveProjectView(snapshot, configuration);
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

// ---------------------------------------------------------------------------
// Legacy Website Adapters (Kept for compatibility during phased migration)
// ---------------------------------------------------------------------------

interface SnapshotBase {
  readonly sources: FilesMap;
  readonly version: number;
}

export type ProjectSnapshot = SnapshotBase & (
  | { readonly status: 'ready'; readonly project: ParsedProject }
  | { readonly status: 'error'; readonly error: ProcessingError }
);

/** Parse changed buffers only; rebuild after deletion or a failed parse. */
export function updateProjectSnapshot(
  previous: ProjectSnapshot | null,
  sources: FilesMap,
): ProjectSnapshot {
  const version = (previous?.version ?? 0) + 1;
  const files: readonly SourceFile[] = Object.entries(sources).map(([path, source]) => ({
    path, source, version,
  }));

  try {
    const hasRemovals = previous && Object.keys(previous.sources).some(
      (path) => !Object.prototype.hasOwnProperty.call(sources, path),
    );
    let project: ParsedProject;
    if (previous?.status === 'ready' && !hasRemovals) {
      const changed = files.filter((file) => previous.sources[file.path] !== file.source);
      project = changed.length
        ? mergeProjects(previous.project, parseProject(changed))
        : previous.project;
    } else {
      project = parseProject(files);
    }
    return { status: 'ready', sources, version, project };
  } catch (error: unknown) {
    return { status: 'error', sources, version, error: toProcessingError(error) };
  }
}

export function toTransformOptions(options: CoreOptionsUI): TransformOptions {
  return {
    suppressComments: options.suppressComments,
    inputHandling: options.inputHandling,
    // Omission preserves syntax; an empty array evaluates every condition as false.
    ...(options.handleIfConditions ? { enabledConditions: options.enabledConditions } : {}),
  };
}
