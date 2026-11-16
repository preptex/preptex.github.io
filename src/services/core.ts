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
} from '@preptex/core';

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
