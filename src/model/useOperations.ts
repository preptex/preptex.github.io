import { useCallback, useState } from 'react';
import type {
  AnalysisResult,
  OperationCapability,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectView,
} from '@preptex/core';
import {
  checkOperationCapabilityAdapter,
  runAnalysisAdapter,
  toProcessingError,
} from '../services/core';
import type { ProcessingError } from '../services/core';

export interface OperationState {
  readonly running: boolean;
  readonly result: AnalysisResult | null;
  readonly error: ProcessingError | null;
  readonly executedForSnapshotId: string | null;
  readonly executedForViewId: string | null;
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
      setState({
        running: false,
        result,
        error: null,
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      });
    } catch (err: unknown) {
      setState({
        running: false,
        result: null,
        error: toProcessingError(err),
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      });
    }
  }, [view, snapshot]);

  const runCommandUsage = useCallback(() => {
    if (!view || view.status !== 'ready' || !snapshot) return;
    setState((prev) => ({ ...prev, running: true, error: null }));
    try {
      const result = runAnalysisAdapter(view, { operation: 'unused-commands' });
      setState({
        running: false,
        result,
        error: null,
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      });
    } catch (err: unknown) {
      setState({
        running: false,
        result: null,
        error: toProcessingError(err),
        executedForSnapshotId: snapshot.id,
        executedForViewId: view.id,
      });
    }
  }, [view, snapshot]);

  const clearResults = useCallback(() => {
    setState({
      running: false,
      result: null,
      error: null,
      executedForSnapshotId: null,
      executedForViewId: null,
    });
  }, []);

  // Stale detection: if current snapshot or view ID does not match the executed IDs
  const isStale = Boolean(
    state.result &&
      ((snapshot && state.executedForSnapshotId !== snapshot.id) ||
        (view && state.executedForViewId !== view.id)),
  );

  return {
    ...state,
    isStale,
    runReferences,
    runCommandUsage,
    clearResults,
    checkReferencesCapability,
    checkCommandUsageCapability,
  } as const;
}
