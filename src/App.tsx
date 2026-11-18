import { useCallback, useMemo } from 'react';
import type {
  CompositeStepRequest,
  ConfiguredNode,
  GeneratedArtifact,
  ProjectEditPlan,
  ProjectFilePath,
  ProjectIssue,
  SourceToken,
  SymbolRefactorAction,
} from '@preptex/core';
import {
  buildNewFileOutputs,
  DEFAULT_DEMO_PROJECT_FILES,
  type FilesMap,
  normalizeOutputFolder,
  PrepTeXWorkspace,
  type SectionCommandName,
  type StagedEditMetadata,
  type UnifiedTransformRequest,
  useControl,
  useFiles,
  useProjectConfiguration,
  useWorkspaceLayout,
  type WorkspaceActionHandlers,
  type WorkspaceModelData,
} from '@preptex/ui';
import './App.css';
import { useOperations } from './model/useOperations';
import { useProjectModel } from './model/useProjectModel';
import { selectProjectNodeAdapter } from './services/core';

function App() {
  const files = useFiles();
  const projectConfig = useProjectConfiguration(files.filesByName, {
    entryPath: files.selectedFile || null,
    conditionPolicy: { mode: 'ignore' },
  });
  const layout = useWorkspaceLayout();
  const control = useControl();

  const projectModel = useProjectModel(
    files.filesByName,
    files.sourceRevision,
    projectConfig,
    files.fileVersions,
  );
  const operations = useOperations(projectModel.snapshot, projectModel.view);

  const effectiveEntry = projectConfig.entryPath || files.selectedFile;
  const effectiveTransformTraversal: 'project' | 'file-only' =
    projectConfig.inputs === 'command' ? 'file-only' : 'project';

  const realizePolicy = useMemo(
    () =>
      projectConfig.conditionPolicy.mode === 'none' ||
      projectConfig.conditionPolicy.mode === 'ignore'
        ? ({ mode: 'source' } as const)
        : projectConfig.conditionPolicy,
    [projectConfig.conditionPolicy],
  );

  const realizeCapability = operations.checkConditionRealizationCapability({
    ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
    traversal: effectiveTransformTraversal,
    conditions: realizePolicy,
    inputs: 'preserve',
    stripDeclarationsAndSetters: control.options.stripDeclarationsAndSetters,
  });

  const viewBlockedReason = projectModel.viewIssue
    ? `${projectModel.viewIssue.code}: ${projectModel.viewIssue.message}`
    : !projectConfig.entryPath
    ? 'Select an entry file in Settings first.'
    : undefined;

  const activeDecisions = useMemo(
    () =>
      !operations.isConditionRealizationStale && operations.conditionRealization
        ? operations.conditionRealization.decisions
        : projectModel.view?.decisions ?? [],
    [
      operations.conditionRealization,
      operations.isConditionRealizationStale,
      projectModel.view?.decisions,
    ],
  );

  const mergedDiagnostics = useMemo(() => {
    const seen = new Set<string>();
    const combined: ProjectIssue[] = [];
    for (const issue of [...projectModel.issues, ...operations.transformationIssues]) {
      const key = `${issue.code}:${issue.location?.path ?? ''}:${issue.location?.range.start ?? ''}:${issue.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(issue);
    }
    return combined;
  }, [projectModel.issues, operations.transformationIssues]);

  const sourceTokensByFile = useMemo<
    Readonly<Record<ProjectFilePath, readonly SourceToken[]>>
  >(() => {
    if (!projectModel.snapshot) return {};
    return Object.fromEntries(
      projectModel.snapshot.files.map((file) => [file.path, file.tokens]),
    );
  }, [projectModel.snapshot]);

  const refsCap = operations.checkReferencesCapability();
  const cmdCap = operations.checkCommandUsageCapability();
  const combinedError =
    projectModel.error ?? operations.error ?? operations.transformationError;

  const modelData: WorkspaceModelData = useMemo(
    () => ({
      viewStatus: projectModel.view?.status ?? null,
      viewId: projectModel.view?.id ?? null,
      viewIssue: projectModel.viewIssue,
      hasConditionals: projectModel.hasConditionals,
      detectedConditions: projectModel.detectedConditions,
      conditionDecisions: activeDecisions,
      coarseTree: projectModel.coarseTree,
      configuredRoot:
        projectModel.view?.status === 'ready' ? projectModel.view.root : null,
      sourceTokensByFile,
      catalog: projectModel.catalog,
      metadata: projectModel.metadata,
      diagnostics: mergedDiagnostics,
      findings: operations.result?.findings ?? [],
      isFindingsStale: operations.isStale,
      isAnalyzing: operations.running,
      error: combinedError,
      pendingEditPlan: operations.pendingEditPlan,
      pendingEditMetadata: operations.pendingEditMetadata,
      isEditPlanStale: operations.isEditPlanStale,
      artifacts: operations.artifacts,
      canRunSourceTransformations: Boolean(
        projectModel.snapshot && effectiveEntry,
      ),
      canRealizeConditions: Boolean(projectModel.snapshot) && realizeCapability.eligible,
      realizeConditionsReason: realizeCapability.reasons[0]?.message,
      canRunViewTransformations: projectModel.view?.status === 'ready',
      viewTransformationReason: viewBlockedReason,
      canRunReferences: refsCap.eligible,
      referencesReason: refsCap.reasons[0]?.message,
      canRunCommandUsage: cmdCap.eligible,
      commandUsageReason: cmdCap.reasons[0]?.message,
    }),
    [
      activeDecisions,
      cmdCap.eligible,
      cmdCap.reasons,
      combinedError,
      effectiveEntry,
      mergedDiagnostics,
      operations.artifacts,
      operations.isEditPlanStale,
      operations.isStale,
      operations.pendingEditMetadata,
      operations.pendingEditPlan,
      operations.result?.findings,
      operations.running,
      projectModel.catalog,
      projectModel.coarseTree,
      projectModel.detectedConditions,
      projectModel.hasConditionals,
      projectModel.metadata,
      projectModel.snapshot,
      projectModel.view,
      projectModel.viewIssue,
      realizeCapability.eligible,
      realizeCapability.reasons,
      refsCap.eligible,
      refsCap.reasons,
      sourceTokensByFile,
      viewBlockedReason,
    ],
  );

  const stageEditPlanIfPresent = useCallback(
    (hasPlan: boolean) => {
      if (hasPlan) {
        layout.selectView('diff');
      }
    },
    [layout],
  );

  const handleRefactorSymbol = useCallback(
    (action: SymbolRefactorAction) => {
      const target =
        projectConfig.conditionPolicy.mode === 'ignore' ||
        projectModel.view?.status !== 'ready'
          ? 'source'
          : 'selected';
      const res = operations.planTransformation({
        operation: 'refactor-symbols',
        options: {
          target,
          ...(target === 'source' && effectiveEntry
            ? { entryPath: effectiveEntry, traversal: effectiveTransformTraversal }
            : {}),
          actions: [action],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [
      effectiveEntry,
      effectiveTransformTraversal,
      operations,
      projectConfig.conditionPolicy.mode,
      projectModel.view?.status,
      stageEditPlanIfPresent,
    ],
  );

  const handleApplyTransformations = useCallback(
    (req: UnifiedTransformRequest) => {
      const folder = normalizeOutputFolder(req.outputFolder);
      if (req.destination === 'new-files' && folder === null) {
        return;
      }

      const activeCount =
        Number(req.realizeConditions) +
        Number(req.suppressComments.enabled) +
        Number(req.removeEnvironments.enabled && req.removeEnvironments.names.length > 0) +
        Number(req.expandInputs.enabled);

      if (activeCount === 0) return;

      const emitNewFiles = (
        artifacts: readonly GeneratedArtifact[],
        changedPaths: ReadonlySet<string>,
      ) => {
        const { files: newFiles, primaryPath } = buildNewFileOutputs({
          artifacts,
          existingFiles: files.filesByName,
          changedPaths,
          entryPath: effectiveEntry,
          outputFolder: req.outputFolder,
        });
        const newKeys = Object.keys(newFiles);
        if (newKeys.length === 0) return;
        const label =
          folder && folder.length > 0
            ? `Transform to ${folder}`
            : 'Output transformed files';
        files.upsertTextFiles(newFiles, { recordHistory: true, label });
        const targetSelect =
          primaryPath && newFiles[primaryPath] !== undefined ? primaryPath : newKeys[0];
        if (targetSelect) {
          files.selectFile(targetSelect);
        }
        layout.selectView('code');
      };

      if (activeCount === 1) {
        if (req.realizeConditions) {
          const realized = operations.realizeConditions(
            {
              ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
              traversal: effectiveTransformTraversal,
              conditions: realizePolicy,
              inputs: 'preserve',
              stripDeclarationsAndSetters: req.stripDeclarationsAndSetters,
            },
            req.destination === 'inplace' ? 'preview-edits' : 'export-artifacts',
          );
          if (!realized) return;
          if (realized.status !== 'ready') {
            layout.selectView('diagnostics');
            return;
          }
          if (req.destination === 'inplace') {
            if (realized.editPlan) {
              layout.selectView('diff');
            }
          } else {
            const changed = new Set((realized.editPlan?.edits ?? []).map((e) => e.path));
            emitNewFiles(realized.artifacts, changed);
          }
          return;
        }

        if (req.suppressComments.enabled) {
          const target = req.suppressComments.target;
          const res = operations.planTransformation({
            operation: 'suppress-comments',
            options: {
              target,
              ...(target === 'source' && effectiveEntry
                ? { entryPath: effectiveEntry, traversal: effectiveTransformTraversal }
                : {}),
              suppressCommentEnvironments: req.suppressComments.suppressCommentEnvironments,
            },
          });
          if (!res) return;
          if (req.destination === 'inplace') {
            stageEditPlanIfPresent(Boolean(res.editPlan));
          } else {
            const changed = new Set((res.editPlan?.edits ?? []).map((e) => e.path));
            emitNewFiles(res.artifacts, changed);
          }
          return;
        }

        if (req.removeEnvironments.enabled && req.removeEnvironments.names.length > 0) {
          const target = req.removeEnvironments.target;
          const res = operations.planTransformation({
            operation: 'remove-environments',
            options: {
              target,
              ...(target === 'source' && effectiveEntry
                ? { entryPath: effectiveEntry, traversal: effectiveTransformTraversal }
                : {}),
              names: req.removeEnvironments.names,
            },
          });
          if (!res) return;
          if (req.destination === 'inplace') {
            stageEditPlanIfPresent(Boolean(res.editPlan));
          } else {
            const changed = new Set((res.editPlan?.edits ?? []).map((e) => e.path));
            emitNewFiles(res.artifacts, changed);
          }
          return;
        }

        if (req.expandInputs.enabled) {
          const target =
            req.destination === 'new-files' ? 'artifact' : req.expandInputs.target;
          const res = operations.planTransformation({
            operation: 'expand-inputs',
            options: {
              mode: req.expandInputs.mode,
              target,
              ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
            },
          });
          if (!res) return;
          if (req.destination === 'inplace') {
            stageEditPlanIfPresent(Boolean(res.editPlan));
          } else {
            const changed = new Set((res.editPlan?.edits ?? []).map((e) => e.path));
            emitNewFiles(res.artifacts, changed);
          }
          return;
        }
      }

      const steps: CompositeStepRequest[] = [];
      if (req.realizeConditions) {
        steps.push({
          operation: 'realize-conditions',
          options: {
            ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
            traversal: effectiveTransformTraversal,
            conditions: realizePolicy,
            inputs: 'preserve',
            stripDeclarationsAndSetters: req.stripDeclarationsAndSetters,
          },
        });
      }
      if (req.suppressComments.enabled) {
        const target = req.realizeConditions ? 'selected' : req.suppressComments.target;
        steps.push({
          operation: 'suppress-comments',
          options: {
            target,
            ...(target === 'source' && effectiveEntry
              ? { entryPath: effectiveEntry, traversal: effectiveTransformTraversal }
              : {}),
            suppressCommentEnvironments: req.suppressComments.suppressCommentEnvironments,
          },
        });
      }
      if (req.removeEnvironments.enabled && req.removeEnvironments.names.length > 0) {
        const target = req.realizeConditions ? 'selected' : req.removeEnvironments.target;
        steps.push({
          operation: 'remove-environments',
          options: {
            target,
            ...(target === 'source' && effectiveEntry
              ? { entryPath: effectiveEntry, traversal: effectiveTransformTraversal }
              : {}),
            names: req.removeEnvironments.names,
          },
        });
      }
      if (req.expandInputs.enabled) {
        const target =
          req.destination === 'new-files'
            ? 'artifact'
            : req.realizeConditions
            ? 'selected'
            : req.expandInputs.target;
        steps.push({
          operation: 'expand-inputs',
          options: {
            mode: req.expandInputs.mode,
            target,
            ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
          },
        });
      }

      const needsViewConfig =
        req.realizeConditions ||
        req.suppressComments.target === 'selected' ||
        req.removeEnvironments.target === 'selected' ||
        req.expandInputs.target === 'selected' ||
        projectConfig.conditionPolicy.mode !== 'ignore';

      const res = operations.planCompositeTransformation({
        ...(needsViewConfig && effectiveEntry
          ? {
              configuration: {
                entryPath: effectiveEntry,
                traversal: effectiveTransformTraversal,
                inputs: projectConfig.inputs,
                conditions: req.realizeConditions
                  ? realizePolicy
                  : projectConfig.conditionPolicy,
                customCommands: projectConfig.customCommands,
              },
            }
          : {}),
        steps,
      });
      if (!res) return;
      if (req.destination === 'inplace') {
        stageEditPlanIfPresent(Boolean(res.editPlan));
      } else {
        const changed = new Set((res.editPlan?.edits ?? []).map((e) => e.path));
        emitNewFiles(res.artifacts, changed);
      }
    },
    [
      effectiveEntry,
      effectiveTransformTraversal,
      files,
      layout,
      operations,
      projectConfig.conditionPolicy,
      projectConfig.customCommands,
      projectConfig.inputs,
      realizePolicy,
      stageEditPlanIfPresent,
    ],
  );

  const handleRemoveNode = useCallback(
    (node: ConfiguredNode) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'remove-node', selection: sel }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleRenameEnvironment = useCallback(
    (node: ConfiguredNode, newName: string) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'rename-environment', selection: sel, name: newName }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleRenameCommand = useCallback(
    (node: ConfiguredNode, newName: string) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'rename-command', selection: sel, name: newName }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleRenameSection = useCallback(
    (node: ConfiguredNode, sectionCommand: SectionCommandName, starred: boolean) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'rename-section', selection: sel, sectionCommand, starred }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleUnwrapNode = useCallback(
    (node: ConfiguredNode) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'unwrap-node', selection: sel }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleWrapNode = useCallback(
    (node: ConfiguredNode, wrapperName: string) => {
      if (!projectModel.view) return;
      const sel = selectProjectNodeAdapter(projectModel.view, node.occurrenceKey);
      const res = operations.planTransformation({
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [{ kind: 'wrap-node', selection: sel, name: wrapperName }],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectModel.view, stageEditPlanIfPresent],
  );

  const handleStageEditPlan = useCallback(
    (plan: ProjectEditPlan, metadata?: StagedEditMetadata) => {
      operations.stageExternalEditPlan(plan, metadata);
    },
    [operations],
  );

  const handleApplyPendingEdits = useCallback(
    ({
      switchToConditionFree,
      historyLabel,
    }: {
      readonly switchToConditionFree: boolean;
      readonly historyLabel: string;
    }) => {
      const plan = operations.pendingEditPlan;
      const isConditionRealization =
        plan?.provenance.request.operation === 'realize-conditions';
      return operations.applyPendingEdits((updatedFiles: FilesMap) => {
        files.upsertTextFiles(updatedFiles, {
          recordHistory: true,
          label: historyLabel,
        });
        if (isConditionRealization && switchToConditionFree) {
          projectConfig.setConditionPolicy({ mode: 'none' });
        }
        layout.selectView('code');
      });
    },
    [files, layout, operations, projectConfig],
  );

  const actions: WorkspaceActionHandlers = useMemo(
    () => ({
      onApplyTransformations: handleApplyTransformations,
      onRefactorSymbol: handleRefactorSymbol,
      onRunReferences: operations.runReferences,
      onRunCommandUsage: operations.runCommandUsage,
      onRemoveNode: handleRemoveNode,
      onRenameEnvironment: handleRenameEnvironment,
      onRenameCommand: handleRenameCommand,
      onRenameSection: handleRenameSection,
      onUnwrapNode: handleUnwrapNode,
      onWrapNode: handleWrapNode,
      onStageEditPlan: handleStageEditPlan,
      onApplyPendingEdits: handleApplyPendingEdits,
      onDiscardPendingEdits: operations.discardPendingEdits,
    }),
    [
      handleApplyPendingEdits,
      handleApplyTransformations,
      handleRefactorSymbol,
      handleRemoveNode,
      handleRenameCommand,
      handleRenameEnvironment,
      handleRenameSection,
      handleStageEditPlan,
      handleUnwrapNode,
      handleWrapNode,
      operations.discardPendingEdits,
      operations.runCommandUsage,
      operations.runReferences,
    ],
  );

  return (
    <PrepTeXWorkspace
      files={files}
      projectConfig={projectConfig}
      layout={layout}
      control={control}
      model={modelData}
      actions={actions}
      demoFiles={DEFAULT_DEMO_PROJECT_FILES}
    />
  );
}

export default App;
