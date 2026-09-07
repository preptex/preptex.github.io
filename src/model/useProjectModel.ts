import { useMemo } from 'react';
import type {
  EnvironmentInventory,
  InventoryResult,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectView,
  SourceFile,
} from '@preptex/core';
import type { FilesMap } from '../types/files';
import type { ProjectConfigurationState } from './useProjectConfiguration';
import {
  createProjectSnapshotAdapter,
  inspectProjectAdapter,
  inspectProjectEnvironmentsAdapter,
  resolveProjectViewAdapter,
  toProcessingError,
} from '../services/core';
import type { ProcessingError } from '../services/core';

export interface ProjectModelResult {
  readonly snapshot: CoreProjectSnapshot | null;
  readonly view: ProjectView | null;
  readonly isReady: boolean;
  readonly detectedConditions: readonly string[];
  readonly inventory: InventoryResult | null;
  readonly envInventory: EnvironmentInventory | null;
  readonly error: ProcessingError | null;
}

export function useProjectModel(
  files: FilesMap,
  sourceRevision: number,
  config: ProjectConfigurationState,
): ProjectModelResult {
  // 1. Snapshot derived from files (memoized by sourceRevision and files)
  const { snapshot, snapshotError } = useMemo<{
    readonly snapshot: CoreProjectSnapshot | null;
    readonly snapshotError: ProcessingError | null;
  }>(() => {
    // Reference sourceRevision inside body to satisfy hook dependencies
    if (sourceRevision < 0) return { snapshot: null, snapshotError: null };
    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0) {
      return { snapshot: null, snapshotError: null };
    }
    const sourceFiles: readonly SourceFile[] = fileEntries.map(([path, source]) => ({
      path,
      source,
      version: 1,
    }));
    try {
      const snap = createProjectSnapshotAdapter(sourceFiles);
      return { snapshot: snap, snapshotError: null };
    } catch (err: unknown) {
      return { snapshot: null, snapshotError: toProcessingError(err) };
    }
  }, [files, sourceRevision]);

  // 2. Source inventories derived from snapshot
  const { inventory, envInventory, detectedConditions } = useMemo(() => {
    if (!snapshot) {
      return {
        inventory: null,
        envInventory: null,
        detectedConditions: [] as readonly string[],
      };
    }
    try {
      const inv = inspectProjectAdapter(snapshot);
      const envInv = inspectProjectEnvironmentsAdapter(snapshot);

      const conditionNames = new Set<string>();
      for (const fact of inv.facts) {
        if (fact.kind === 'condition-declaration' && fact.name) {
          conditionNames.add(fact.name);
        } else if (fact.kind === 'condition-assignment' && fact.name) {
          conditionNames.add(fact.name);
        } else if (fact.kind === 'condition-test' && fact.command.startsWith('if')) {
          const stripped = fact.command.slice(2);
          if (stripped) conditionNames.add(stripped);
        }
      }

      return {
        inventory: inv,
        envInventory: envInv,
        detectedConditions: Array.from(conditionNames).sort(),
      };
    } catch {
      return {
        inventory: null,
        envInventory: null,
        detectedConditions: [] as readonly string[],
      };
    }
  }, [snapshot]);

  // 3. Configured view derived from snapshot + configuration
  const { view, viewError } = useMemo<{
    readonly view: ProjectView | null;
    readonly viewError: ProcessingError | null;
  }>(() => {
    if (config.revision < 0) return { view: null, viewError: null };
    if (!snapshot || !config.entryPath) {
      return { view: null, viewError: null };
    }
    // Verify entry exists in snapshot
    if (!snapshot.files.some((f) => f.path === config.entryPath)) {
      return { view: null, viewError: null };
    }
    try {
      const resolved = resolveProjectViewAdapter(snapshot, {
        entryPath: config.entryPath,
        traversal: config.traversal,
        conditions: config.conditionPolicy,
      });
      return { view: resolved, viewError: null };
    } catch (err: unknown) {
      return { view: null, viewError: toProcessingError(err) };
    }
  }, [snapshot, config.entryPath, config.traversal, config.conditionPolicy, config.revision]);

  const isReady = view?.status === 'ready';
  const error = viewError || snapshotError;

  return {
    snapshot,
    view,
    isReady,
    detectedConditions,
    inventory,
    envInventory,
    error,
  };
}
