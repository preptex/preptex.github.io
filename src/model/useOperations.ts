import { useCallback, useState } from 'react';
import type {
  AnalysisResult,
  GeneratedArtifact,
  OperationCapability,
  ProjectEditPlan,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectView,
  TransformationRequest,
  TransformationResult,
} from '@preptex/core';
import {
  applyProjectEditsAdapter,
  checkOperationCapabilityAdapter,
  planTransformationAdapter,
  runAnalysisAdapter,
  toProcessingError,
  validateProjectEditPlanAdapter,
} from '../services/core';
import type { ProcessingError } from '../services/core';
import type { FilesMap } from '../types/files';

export interface OperationState {
  readonly running: boolean;
  readonly result: AnalysisResult | null;
  readonly error: ProcessingError | null;
  readonly executedForSnapshotId: string | null;
  readonly executedForViewId: string | null;

  readonly transformationRunning: boolean;
  readonly transformationResult: TransformationResult | null;
  readonly transformationError: ProcessingError | null;
  readonly pendingEditPlan: ProjectEditPlan | null;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly editPlanSnapshotId: string | null;
  readonly editPlanViewId: string | null;
}

export function useOperations(
  snapshot: CoreProjectSnapshot | null,
  view: ProjectView | null,
) {
  const [state, setState] = useState<OperationState>({
    running: false,
    result: null,
    error: null,
    executedForSnapshotId: null,
    executedForViewId: null,

    transformationRunning: false,
    transformationResult: null,
    transformationError: null,
    pendingEditPlan: null,
    artifacts: [],
    editPlanSnapshotId: null,
    editPlanViewId: null,
  });

  const checkReferencesCapability = useCallback((): OperationCapability => {
    if (!view) {
      return {
        eligible: false,
        reasons: [{
          code: 'view-not-ready',
          message: 'A ready configured view is required to check references.',
        }],
      };
    }
    return checkOperationCapabilityAdapter(view, { operation: 'references' });
  }, [view]);

  const checkCommandUsageCapability = useCallback((): OperationCapability => {
    if (!view) {
      return {
        eligible: false,
        reasons: [{
          code: 'view-not-ready',
          message: 'A ready configured view is required to check command usage.',
        }],
      };
    }
    return checkOperationCapabilityAdapter(view, { operation: 'unused-commands' });
  }, [view]);

  const runReferences = useCallback(() => {
    if (!view || view.status !== 'ready' || !snapshot) return;
    setState((prev) => ({ ...prev, running: true, error: null }));
    try {
      const result = runAnalysisAdapter(view, { operation: 'references' });
      setState((prev) => ({
        ...prev,
        running: false,
        result,
        error: null,
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        running: false,
        result: null,
        error: toProcessingError(err),
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      }));
    }
  }, [view, snapshot]);

  const runCommandUsage = useCallback(() => {
    if (!view || view.status !== 'ready' || !snapshot) return;
    setState((prev) => ({ ...prev, running: true, error: null }));
    try {
      const result = runAnalysisAdapter(view, { operation: 'unused-commands' });
      setState((prev) => ({
        ...prev,
        running: false,
        result,
        error: null,
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        running: false,
        result: null,
        error: toProcessingError(err),
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      }));
    }
  }, [view, snapshot]);

  const clearResults = useCallback(() => {
    setState((prev) => ({
      ...prev,
      running: false,
      result: null,
      error: null,
      executedForSnapshotId: null,
      executedForViewId: null,
    }));
  }, []);

  const checkTransformationCapability = useCallback((request: TransformationRequest): OperationCapability => {
    const target = 'target' in request.options ? request.options.target : undefined;
    const model = (target === 'source' || !view) ? snapshot : view;
    if (!model) {
      return {
        eligible: false,
        reasons: [{
          code: 'view-not-ready',
          message: 'No project snapshot or view is available.',
        }],
      };
    }
    return checkOperationCapabilityAdapter(model, request);
  }, [snapshot, view]);

  const planTransformation = useCallback((request: TransformationRequest) => {
    const target = 'target' in request.options ? request.options.target : undefined;
    const model = (target === 'source' || !view) ? snapshot : view;
    if (!model) return;

    setState((prev) => ({ ...prev, transformationRunning: true, transformationError: null }));
    try {
      const result = planTransformationAdapter(model, request);
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: result,
        pendingEditPlan: result.editPlan,
        artifacts: result.artifacts,
        editPlanSnapshotId: snapshot?.id ?? null,
        editPlanViewId: view?.id ?? null,
        transformationError: null,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: null,
        pendingEditPlan: null,
        transformationError: toProcessingError(err),
      }));
    }
  }, [snapshot, view]);

  const applyPendingEdits = useCallback((onApplied: (updatedFiles: FilesMap) => void) => {
    if (!state.pendingEditPlan || !snapshot) return;

    const validation = validateProjectEditPlanAdapter(snapshot, state.pendingEditPlan, view ?? undefined);
    if (!validation.eligible) {
      setState((prev) => ({ ...prev, transformationError: validation.error }));
      return;
    }

    try {
      const updatedSnapshot = applyProjectEditsAdapter(snapshot, state.pendingEditPlan, view ?? undefined);
      const updatedFiles: FilesMap = Object.fromEntries(
        updatedSnapshot.files.map((file) => [file.path, file.source]),
      );
      onApplied(updatedFiles);
      setState((prev) => ({
        ...prev,
        pendingEditPlan: null,
        transformationError: null,
        editPlanSnapshotId: null,
        editPlanViewId: null,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        transformationError: toProcessingError(err),
      }));
    }
  }, [state.pendingEditPlan, snapshot, view]);

  const discardPendingEdits = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pendingEditPlan: null,
      transformationError: null,
      editPlanSnapshotId: null,
      editPlanViewId: null,
    }));
  }, []);

  const clearTransformationResult = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transformationResult: null,
      pendingEditPlan: null,
      transformationError: null,
      editPlanSnapshotId: null,
      editPlanViewId: null,
    }));
  }, []);

  // Stale detection: if current snapshot or view ID does not match the executed IDs
  const isStale = Boolean(
    state.result &&
      ((snapshot && state.executedForSnapshotId !== snapshot.id) ||
        (view && state.executedForViewId !== view.id)),
  );

  const isEditPlanStale = Boolean(
    state.pendingEditPlan &&
      ((snapshot && state.editPlanSnapshotId !== snapshot.id) ||
        (view && state.editPlanViewId !== view.id)),
  );

  return {
    ...state,
    isStale,
    isEditPlanStale,
    runReferences,
    runCommandUsage,
    clearResults,
    checkReferencesCapability,
    checkCommandUsageCapability,
    checkTransformationCapability,
    planTransformation,
    applyPendingEdits,
    discardPendingEdits,
    clearTransformationResult,
  } as const;
}
