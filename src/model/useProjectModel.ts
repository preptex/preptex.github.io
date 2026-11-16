import { useMemo, useRef } from 'react';
import type {
  CoarseTree,
  EnvironmentInventory,
  InventoryResult,
  ProjectCatalog,
  ProjectFilePath,
  ProjectIssue,
  ProjectMetadata,
  ProjectSnapshot as CoreProjectSnapshot,
  ProjectSourceChange,
  ProjectView,
  SourceFile,
} from '@preptex/core';
import type { FilesMap } from '../types/files';
import type { ProjectConfigurationState } from './useProjectConfiguration';
import {
  buildCoarseViewTreeAdapter,
  createProjectSnapshotAdapter,
  extractProjectMetadataAdapter,
  inspectProjectAdapter,
  inspectProjectCatalogAdapter,
  inspectProjectEnvironmentsAdapter,
  resolveProjectViewAdapter,
  toProcessingError,
  updateProjectSnapshotAdapter,
} from '../services/core';
import type { ProcessingError } from '../services/core';

export interface ProjectModelResult {
  readonly snapshot: CoreProjectSnapshot | null;
  readonly view: ProjectView | null;
  readonly isReady: boolean;
  readonly viewIssue: ProjectIssue | null;
  readonly issues: readonly ProjectIssue[];
  readonly detectedConditions: readonly string[];
  readonly inventory: InventoryResult | null;
  readonly envInventory: EnvironmentInventory | null;
  readonly coarseTree: CoarseTree | null;
  readonly catalog: ProjectCatalog | null;
  readonly metadata: ProjectMetadata | null;
  readonly error: ProcessingError | null;
}

export function useProjectModel(
  files: FilesMap,
  sourceRevision: number,
  config: ProjectConfigurationState,
  fileVersions?: Readonly<Record<ProjectFilePath, number>>,
): ProjectModelResult {
  const previousSnapshotRef = useRef<CoreProjectSnapshot | null>(null);

  // 1. Snapshot derived from files (incrementally updated when possible)
  const { snapshot, snapshotError } = useMemo<{
    readonly snapshot: CoreProjectSnapshot | null;
    readonly snapshotError: ProcessingError | null;
  }>(() => {
    if (sourceRevision < 0) return { snapshot: null, snapshotError: null };
    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0) {
      previousSnapshotRef.current = null;
      return { snapshot: null, snapshotError: null };
    }

    try {
      const prev = previousSnapshotRef.current;
      if (prev) {
        const prevByPath = new Map(prev.files.map((f) => [f.path, f]));
        const changes: ProjectSourceChange[] = [];

        for (const prevFile of prev.files) {
          if (!Object.prototype.hasOwnProperty.call(files, prevFile.path)) {
            changes.push({ kind: 'remove', path: prevFile.path });
          }
        }

        for (const [path, source] of fileEntries) {
          const existing = prevByPath.get(path);
          if (!existing || existing.source !== source) {
            const explicitVersion = fileVersions?.[path];
            const nextVersion = Math.max(
              (existing?.version ?? 0) + 1,
              explicitVersion ?? 1,
            );
            changes.push({
              kind: 'upsert',
              file: { path, source, version: nextVersion },
            });
          }
        }

        if (changes.length === 0) {
          return { snapshot: prev, snapshotError: null };
        }

        const updated = updateProjectSnapshotAdapter(prev, changes);
        previousSnapshotRef.current = updated;
        return { snapshot: updated, snapshotError: null };
      }

      const sourceFiles: readonly SourceFile[] = fileEntries.map(([path, source]) => ({
        path,
        source,
        version: fileVersions?.[path] ?? 1,
      }));
      const created = createProjectSnapshotAdapter(sourceFiles);
      previousSnapshotRef.current = created;
      return { snapshot: created, snapshotError: null };
    } catch (err: unknown) {
      previousSnapshotRef.current = null;
      return { snapshot: null, snapshotError: toProcessingError(err) };
    }
  }, [files, sourceRevision, fileVersions]);

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
        } else if (
          fact.kind === 'condition-test' &&
          fact.testKind === 'named-candidate' &&
          fact.command.startsWith('if')
        ) {
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
    if (!snapshot.files.some((f) => f.path === config.entryPath)) {
      return { view: null, viewError: null };
    }
    try {
      const resolved = resolveProjectViewAdapter(snapshot, {
        entryPath: config.entryPath,
        traversal: config.traversal,
        conditions: config.conditionPolicy,
        ...(config.customCommands && config.customCommands.length > 0
          ? { customCommands: config.customCommands }
          : {}),
      });
      return { view: resolved, viewError: null };
    } catch (err: unknown) {
      return { view: null, viewError: toProcessingError(err) };
    }
  }, [
    snapshot,
    config.entryPath,
    config.traversal,
    config.conditionPolicy,
    config.customCommands,
    config.revision,
  ]);

  const viewIssue = useMemo<ProjectIssue | null>(() => {
    if (!view || view.status === 'ready') return null;
    return view.reason;
  }, [view]);

  const issues = useMemo<readonly ProjectIssue[]>(() => {
    const collected: ProjectIssue[] = [];
    const seen = new Set<string>();
    const addIssue = (issue: ProjectIssue) => {
      const key = `${issue.code}|${issue.location?.path ?? ''}|${issue.location?.range.start ?? -1}|${issue.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        collected.push(issue);
      }
    };

    if (view) {
      if (view.status !== 'ready') {
        addIssue(view.reason);
      }
      for (const issue of view.coverage.issues) {
        addIssue(issue);
      }
    }
    if (snapshot) {
      for (const file of snapshot.files) {
        for (const issue of file.coverage.issues) {
          addIssue(issue);
        }
      }
    }
    return collected;
  }, [view, snapshot]);

  const isReady = view?.status === 'ready';

  const coarseTree = useMemo<CoarseTree | null>(() => {
    if (!view || view.status !== 'ready') return null;
    try {
      return buildCoarseViewTreeAdapter(view, config.coarseTreeOptions);
    } catch {
      return null;
    }
  }, [view, config.coarseTreeOptions]);

  const catalog = useMemo<ProjectCatalog | null>(() => {
    const model = view?.status === 'ready' ? view : snapshot;
    if (!model) return null;
    try {
      return inspectProjectCatalogAdapter(
        model,
        config.customCommands && config.customCommands.length > 0
          ? { customCommands: config.customCommands }
          : undefined,
      );
    } catch {
      return null;
    }
  }, [view, snapshot, config.customCommands]);

  const metadata = useMemo<ProjectMetadata | null>(() => {
    const model = view?.status === 'ready' ? view : snapshot;
    if (!model) return null;
    try {
      return extractProjectMetadataAdapter(model);
    } catch {
      return null;
    }
  }, [view, snapshot]);

  const error = viewError || snapshotError;

  return {
    snapshot,
    view,
    isReady,
    viewIssue,
    issues,
    detectedConditions,
    inventory,
    envInventory,
    coarseTree,
    catalog,
    metadata,
    error,
  };
}
