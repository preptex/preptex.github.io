import { useCallback, useState } from 'react';
import { PrepTexErrorCode } from '@preptex/core';
import type {
  AnalysisResult,
  CompositeTransformationRequest,
  ConditionRealizationRequest,
  ConditionRealizationResult,
  GeneratedArtifact,
  OperationCapability,
  ProjectEditPlan,
  ProjectIssue,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectView,
  TransformationRequest,
  TransformationResult,
} from '@preptex/core';
import {
  applyProjectEditsAdapter,
  checkOperationCapabilityAdapter,
  planCompositeTransformationAdapter,
  planTransformationAdapter,
  realizeProjectConditionsAdapter,
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

  readonly conditionRealization: ConditionRealizationResult | null;
  readonly conditionRealizationSnapshotId: string | null;

  readonly transformationRunning: boolean;
  readonly transformationResult: TransformationResult | null;
  readonly transformationError: ProcessingError | null;
  readonly transformationIssues: readonly ProjectIssue[];
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

    conditionRealization: null,
    conditionRealizationSnapshotId: null,

    transformationRunning: false,
    transformationResult: null,
    transformationError: null,
    transformationIssues: [],
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

  const checkConditionRealizationCapability = useCallback(
    (request: ConditionRealizationRequest): OperationCapability => {
      if (!snapshot) {
        return {
          eligible: false,
          reasons: [{
            code: 'wrong-model',
            message: 'Upload at least one source file to realize conditions.',
          }],
        };
      }
      return checkOperationCapabilityAdapter(snapshot, {
        operation: 'realize-conditions',
        options: request,
      });
    },
    [snapshot],
  );

  const realizeConditions = useCallback(
    (
      request: ConditionRealizationRequest,
      mode: 'preview-edits' | 'export-artifacts',
    ): ConditionRealizationResult | null => {
      if (!snapshot) return null;
      setState((prev) => ({ ...prev, transformationRunning: true, transformationError: null }));
      try {
        const realized = realizeProjectConditionsAdapter(snapshot, request);
        if (realized.status !== 'ready') {
          const failureMsg = realized.reason
            ? `${realized.reason.code}: ${realized.reason.message}`
            : 'Condition realization could not complete.';
          setState((prev) => ({
            ...prev,
            transformationRunning: false,
            conditionRealization: realized,
            conditionRealizationSnapshotId: snapshot.id,
            pendingEditPlan: null,
            transformationError: {
              kind: 'core',
              code: PrepTexErrorCode.OperationUnavailable,
              message: failureMsg,
            },
          }));
          return realized;
        }

        if (mode === 'preview-edits') {
          if (!realized.editPlan) {
            setState((prev) => ({
              ...prev,
              transformationRunning: false,
              conditionRealization: realized,
              conditionRealizationSnapshotId: snapshot.id,
              pendingEditPlan: null,
              artifacts: realized.artifacts,
              transformationError: {
                kind: 'core',
                code: PrepTexErrorCode.EditConflict,
                message: 'In-place edits are unavailable for this configuration; use artifact export instead.',
              },
            }));
            return realized;
          }
          setState((prev) => ({
            ...prev,
            transformationRunning: false,
            conditionRealization: realized,
            conditionRealizationSnapshotId: snapshot.id,
            pendingEditPlan: realized.editPlan,
            artifacts: realized.artifacts,
            transformationIssues: realized.coverage.issues,
            editPlanSnapshotId: snapshot.id,
            editPlanViewId: null,
            transformationError: null,
          }));
          return realized;
        }

        setState((prev) => ({
          ...prev,
          transformationRunning: false,
          conditionRealization: realized,
          conditionRealizationSnapshotId: snapshot.id,
          artifacts: realized.artifacts,
          transformationIssues: realized.coverage.issues,
          transformationError: null,
        }));
        return realized;
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          transformationRunning: false,
          pendingEditPlan: null,
          transformationError: toProcessingError(err),
        }));
        return null;
      }
    },
    [snapshot],
  );

  const checkTransformationCapability = useCallback((request: TransformationRequest): OperationCapability => {
    if (request.operation === 'realize-conditions') {
      if (!snapshot) {
        return {
          eligible: false,
          reasons: [{
            code: 'wrong-model',
            message: 'No project snapshot is available.',
          }],
        };
      }
      return checkOperationCapabilityAdapter(snapshot, request);
    }

    const isSourceTarget =
      (request.operation === 'suppress-comments' && request.options?.target === 'source') ||
      (request.operation === 'remove-environments' && request.options.target === 'source') ||
      (request.operation === 'refactor-symbols' && request.options.target === 'source') ||
      (request.operation === 'expand-inputs' &&
        (request.options.target === 'source' || request.options.target === 'artifact'));

    if (isSourceTarget) {
      if (!snapshot) {
        return {
          eligible: false,
          reasons: [{
            code: 'wrong-model',
            message: 'No project snapshot is available.',
          }],
        };
      }
      return checkOperationCapabilityAdapter(snapshot, request);
    }

    if (request.operation === 'refactor-symbols' || request.operation === 'compose-transformations') {
      const model = view?.status === 'ready' ? view : snapshot;
      if (!model) {
        return {
          eligible: false,
          reasons: [{
            code: 'wrong-model',
            message: 'No project snapshot is available.',
          }],
        };
      }
      return checkOperationCapabilityAdapter(model, request);
    }

    if (request.operation === 'export-project') {
      const model = view?.status === 'ready' ? view : snapshot;
      if (!model) {
        return {
          eligible: false,
          reasons: [{
            code: 'wrong-model',
            message: 'No project snapshot is available.',
          }],
        };
      }
      return checkOperationCapabilityAdapter(model, request);
    }

    if (!view) {
      return {
        eligible: false,
        reasons: [{
          code: 'view-not-ready',
          message: 'A ready configured view is required for structural transformations.',
        }],
      };
    }
    return checkOperationCapabilityAdapter(view, request);
  }, [snapshot, view]);

  const planTransformation = useCallback((request: TransformationRequest): TransformationResult | null => {
    const isSnapshotOp =
      request.operation === 'realize-conditions' ||
      (request.operation === 'suppress-comments' && request.options?.target === 'source') ||
      (request.operation === 'remove-environments' && request.options.target === 'source') ||
      (request.operation === 'refactor-symbols' && request.options.target === 'source') ||
      (request.operation === 'expand-inputs' && request.options.target === 'source');
    const isFlexibleModel =
      request.operation === 'refactor-symbols' ||
      request.operation === 'compose-transformations' ||
      request.operation === 'export-project' ||
      (request.operation === 'expand-inputs' && request.options.target === 'artifact');
    const readyView = view?.status === 'ready' ? view : null;
    const effectiveRequest: TransformationRequest =
      request.operation === 'refactor-symbols' && !readyView && request.options.target !== 'artifact'
        ? {
            ...request,
            options: { ...request.options, target: 'source' },
          }
        : request;
    const model = isSnapshotOp ? snapshot : isFlexibleModel ? (readyView ?? snapshot) : view;
    if (!model) return null;

    setState((prev) => ({ ...prev, transformationRunning: true, transformationError: null }));
    try {
      const result = planTransformationAdapter(model, effectiveRequest);
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: result,
        pendingEditPlan: result.editPlan,
        artifacts: result.artifacts,
        transformationIssues: result.coverage.issues,
        editPlanSnapshotId: snapshot?.id ?? null,
        editPlanViewId: model.kind === 'view' ? model.id : null,
        transformationError: null,
      }));
      return result;
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: null,
        pendingEditPlan: null,
        transformationError: toProcessingError(err),
      }));
      return null;
    }
  }, [snapshot, view]);

  const planCompositeTransformation = useCallback((
    options: CompositeTransformationRequest['options'],
  ): TransformationResult | null => {
    const requiresReadyView = options.steps.some((step) => {
      if (step.operation === 'suppress-comments' || step.operation === 'remove-environments') {
        return step.options?.target !== 'source';
      }
      if (step.operation === 'refactor-symbols' || step.operation === 'expand-inputs') {
        return step.options.target === 'selected' || step.options.target === 'artifact';
      }
      return false;
    });
    const model = requiresReadyView
      ? (view?.status === 'ready' ? view : null)
      : (snapshot ?? (view?.status === 'ready' ? view : null));
    if (!model) return null;

    setState((prev) => ({ ...prev, transformationRunning: true, transformationError: null }));
    try {
      const result = planCompositeTransformationAdapter(model, options);
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: result,
        pendingEditPlan: result.editPlan,
        artifacts: result.artifacts,
        transformationIssues: result.coverage.issues,
        editPlanSnapshotId: snapshot?.id ?? null,
        editPlanViewId: result.editPlan?.provenance.viewId ?? null,
        transformationError: null,
      }));
      return result;
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        transformationRunning: false,
        transformationResult: null,
        pendingEditPlan: null,
        transformationError: toProcessingError(err),
      }));
      return null;
    }
  }, [snapshot, view]);

  const applyPendingEdits = useCallback((onApplied: (updatedFiles: FilesMap) => void) => {
    if (!state.pendingEditPlan || !snapshot) return;

    const requiresView = state.pendingEditPlan.provenance.viewId !== null;
    const planView = requiresView ? (view ?? undefined) : undefined;

    const validation = validateProjectEditPlanAdapter(snapshot, state.pendingEditPlan, planView);
    if (!validation.eligible) {
      setState((prev) => ({ ...prev, transformationError: validation.error }));
      return;
    }

    try {
      const updatedSnapshot = applyProjectEditsAdapter(snapshot, state.pendingEditPlan, planView);
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
      transformationIssues: [],
      editPlanSnapshotId: null,
      editPlanViewId: null,
    }));
  }, []);

  const isStale = Boolean(
    state.result &&
      ((snapshot && state.executedForSnapshotId !== snapshot.id) ||
        (view && state.executedForViewId !== view.id)),
  );

  const isEditPlanStale = Boolean(
    state.pendingEditPlan &&
      ((snapshot && state.editPlanSnapshotId !== snapshot.id) ||
        (state.editPlanViewId !== null && view && state.editPlanViewId !== view.id)),
  );

  const isConditionRealizationStale = Boolean(
    state.conditionRealization &&
      snapshot &&
      state.conditionRealizationSnapshotId !== snapshot.id,
  );

  return {
    ...state,
    isStale,
    isEditPlanStale,
    isConditionRealizationStale,
    runReferences,
    runCommandUsage,
    clearResults,
    checkReferencesCapability,
    checkCommandUsageCapability,
    checkConditionRealizationCapability,
    realizeConditions,
    checkTransformationCapability,
    planTransformation,
    planCompositeTransformation,
    applyPendingEdits,
    discardPendingEdits,
    clearTransformationResult,
  } as const;
}
