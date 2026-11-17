import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilesMap } from './types/files';
import './App.css';

import {
  ASTview,
  CatalogDialog,
  Codeview,
  Filetree,
  LogDialog,
  MetadataDialog,
  OperationsDialog,
  WelcomeEmptyState,
  WorkspaceHeader,
} from './components';
import type { AstStructureMode } from './components/astview/ASTview';
import { ProjectSetupDialog } from './components/ProjectSetupDialog';
import { EditPreviewDialog } from './components/EditPreviewDialog';
import { NodeActionBar } from './components/NodeActionBar';
import { useFiles } from './model/useFiles';
import { useControl } from './model/useControl';
import { recommendEntry, useProjectConfiguration } from './model/useProjectConfiguration';
import { useProjectModel } from './model/useProjectModel';
import { useOperations } from './model/useOperations';
import { useWorkspaceLayout } from './model/useWorkspaceLayout';
import { TreeLayoutBuilder } from './components/astview/treebuilder';
import type { LayoutNode } from './types/LayoutNode';
import type {
  CompositeStepRequest,
  ConfiguredNode,
  GeneratedArtifact,
  SourceLocation,
  SymbolRefactorAction,
} from '@preptex/core';
import { selectProjectNodeAdapter, walkConfiguredNodesAdapter } from './services/core';
import { downloadBlob, downloadZipArchive } from './services/zip';

function normalizeOutputName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasExt = /\.[^./\\]+$/.test(trimmed);
  return hasExt ? trimmed : `${trimmed}.processed.tex`;
}

function getOperationHistoryLabel(operation: string | undefined): string {
  switch (operation) {
    case 'realize-conditions':
      return 'Condition realization';
    case 'refactor-symbols':
      return 'Symbol refactor';
    case 'suppress-comments':
      return 'Comment suppression';
    case 'remove-environments':
      return 'Remove environments';
    case 'compose-transformations':
      return 'Composed pipeline';
    case 'edit-nodes':
      return 'Node edit';
    default:
      return 'Transformation';
  }
}

const DEMO_PROJECT_FILES: FilesMap = {
  'main.tex': `\\documentclass[11pt]{article}
\\usepackage{amsmath}
\\newcommand{\\highlight}[1]{\\textbf{#1}}
\\newenvironment{notebox}{\\begin{quote}}{\\end{quote}}
\\newif\\ifdraft
\\drafttrue
\\title[PrepTeX Demo]{PrepTeX Phase 3 Workspace Demo}
\\author{Narek Bojikian \\and Alex Researcher\\thanks{PrepTeX Lab}}
\\date{November 2026}
\\begin{document}
\\maketitle
\\begin{abstract}
A concise summary of the structural TeX workspace.
\\end{abstract}

% Main section
\\section{Introduction}\\label{sec:intro}
This is a \\highlight{sample} document demonstrating PrepTeX processing.
Undefined call with arguments: \\badge[new]{ready}.
See Section~\\ref{sec:methods} and work~\\cite{knuth84}.

\\input{intro/history.tex}

\\begin{notebox}
Editable custom environment content.
\\end{notebox}

\\ifdraft
% Draft notes:
Draft notice: work in progress.
\\else
Final published version.
\\fi

\\begin{comment}
Internal development comment to remove.
\\end{comment}

\\section{Methods}\\label{sec:methods}
Reference to \\ref{sec:missing}.
\\begin{enumerate}
\\item First item
\\item Second item
\\end{enumerate}
\\begin{thebibliography}{9}
\\bibitem{knuth84} Donald Knuth, The TeXbook.
\\end{thebibliography}
\\end{document}
`,
  'intro/history.tex': `% Historical note in subfolder
\\subsection{Background}
Since 1984, \\highlight{TeX} has enabled structured mathematical typesetting across nested project files.
`,
};

function App() {
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [jumpRange, setJumpRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [jumpToken, setJumpToken] = useState(0);
  const [structureMode, setStructureMode] = useState<AstStructureMode>('coarse');
  const hasAutoRecommendedEntryRef = useRef(false);

  const [uploadFilesTrigger, setUploadFilesTrigger] = useState(0);
  const [uploadFolderTrigger, setUploadFolderTrigger] = useState(0);
  const [newFileTrigger, setNewFileTrigger] = useState(0);

  const [selectedNode, setSelectedNode] = useState<ConfiguredNode | null>(null);
  const [switchToConditionFree, setSwitchToConditionFree] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<GeneratedArtifact | null>(null);

  const {
    filesByName,
    fileNames,
    fileVersions,
    selectedFile,
    selectFile,
    uploadError,
    upsertFiles,
    upsertFileItems,
    upsertTextFiles,
    removeFile,
    resetFiles,
    sourceRevision,
    canGoBack,
    canGoForward,
    backLabel,
    forwardLabel,
    goBack,
    goForward,
  } = useFiles();

  const projectConfig = useProjectConfiguration(filesByName, {
    entryPath: selectedFile || null,
    conditionPolicy: { mode: 'ignore' },
  });
  const projectModel = useProjectModel(filesByName, sourceRevision, projectConfig, fileVersions);
  const operations = useOperations(projectModel.snapshot, projectModel.view);
  const layout = useWorkspaceLayout('code');
  const { options, setOptions } = useControl();

  const loadDemoProject = useCallback(() => {
    hasAutoRecommendedEntryRef.current = true;
    upsertTextFiles(DEMO_PROJECT_FILES);
    selectFile('main.tex');
    projectConfig.commitConfiguration({
      entryPath: 'main.tex',
      traversal: 'project',
      conditionPolicy: { mode: 'ignore' },
    });
    setSelectedArtifact(null);
    setSelectedNode(null);
  }, [projectConfig, selectFile, upsertTextFiles]);

  // Auto-recommend an entry file quietly (without modal popup) when files enter an empty workspace
  useEffect(() => {
    if (fileNames.length === 0) {
      hasAutoRecommendedEntryRef.current = false;
      return;
    }
    if (!hasAutoRecommendedEntryRef.current) {
      hasAutoRecommendedEntryRef.current = true;
      if (!projectConfig.entryPath) {
        const recommended = recommendEntry(filesByName);
        if (recommended) {
          projectConfig.setEntryPath(recommended);
          selectFile(recommended);
        }
      }
    }
  }, [fileNames.length, filesByName, projectConfig, selectFile]);

  // Demo / State URL parameter support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'sample' && fileNames.length === 0) {
      loadDemoProject();
      const state = params.get('state');
      if (state === 'operations' || state === 'transformations') {
        layout.selectView('transformations');
      } else if (state === 'ast') {
        layout.selectView('ast');
      } else if (state === 'catalog') {
        layout.selectView('catalog');
      } else if (state === 'metadata') {
        layout.selectView('metadata');
      } else if (state === 'settings') {
        layout.selectView('settings');
      } else if (state === 'log' || state === 'bottom-log' || state === 'diagnostics') {
        layout.selectView('diagnostics');
        setTimeout(() => {
          operations.runReferences();
        }, 100);
      }
    }
  }, [fileNames.length, loadDemoProject, layout, operations]);

  const code = filesByName[selectedFile] ?? '';
  const displayedFilename = selectedArtifact ? selectedArtifact.path : selectedFile;
  const displayedCode = selectedArtifact ? selectedArtifact.source : code;
  const effectiveEntry = projectConfig.entryPath || selectedFile;

  const rootNode: LayoutNode | null = useMemo(() => {
    if (structureMode === 'coarse') {
      if (projectModel.coarseTree) {
        return new TreeLayoutBuilder().buildCoarse(projectModel.coarseTree);
      }
      return null;
    }

    if (structureMode === 'configured') {
      if (projectModel.view?.status === 'ready' && projectModel.view.root) {
        return new TreeLayoutBuilder().buildConfigured(projectModel.view.root);
      }
      return null;
    }

    const scannedFile = projectModel.snapshot?.files.find((file) => file.path === selectedFile);
    if (scannedFile && scannedFile.tokens.length > 0) {
      return new TreeLayoutBuilder().buildSourceTokens(selectedFile, scannedFile.tokens);
    }
    return null;
  }, [structureMode, projectModel.coarseTree, projectModel.view, projectModel.snapshot, selectedFile]);

  const jumpToAnalysisLocation = useCallback(
    (location: SourceLocation) => {
      if (filesByName[location.path]) {
        setSelectedArtifact(null);
        selectFile(location.path);
      }
      setJumpRange(location.range);
      setJumpToLine(location.range.line);
      setJumpToken((val) => val + 1);
      if (!layout.splitEnabled) {
        layout.selectView('code');
      }
    },
    [filesByName, layout, selectFile],
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
        projectConfig.conditionPolicy.mode === 'ignore' || projectModel.view?.status !== 'ready'
          ? 'source'
          : 'selected';
      const res = operations.planTransformation({
        operation: 'refactor-symbols',
        options: {
          target,
          actions: [action],
        },
      });
      stageEditPlanIfPresent(Boolean(res?.editPlan));
    },
    [operations, projectConfig.conditionPolicy.mode, projectModel.view?.status, stageEditPlanIfPresent],
  );

  const onDownload = (name: string) => {
    const text = filesByName[name] ?? '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, name);
  };

  const onSelectFile = (name: string) => {
    setSelectedArtifact(null);
    setJumpToLine(undefined);
    setJumpRange(undefined);
    selectFile(name);
    if (layout.activeView === 'diff' || layout.activeView === 'settings') {
      return;
    }
  };

  const handleCreateFile = (path: string) => {
    const existed = Object.prototype.hasOwnProperty.call(filesByName, path);
    if (!existed) {
      upsertTextFiles(
        { [path]: '% New TeX file\n' },
        { recordHistory: true, label: `Create ${path}` },
      );
    }
    selectFile(path);
    if (!layout.splitEnabled) {
      layout.selectView('code');
    }
  };

  const realizePolicy =
    projectConfig.conditionPolicy.mode === 'none' || projectConfig.conditionPolicy.mode === 'ignore'
      ? ({ mode: 'source' } as const)
      : projectConfig.conditionPolicy;

  const realizeCapability = operations.checkConditionRealizationCapability({
    ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
    traversal: projectConfig.traversal,
    conditions: realizePolicy,
    inputs: 'preserve',
    stripDeclarationsAndSetters: options.stripDeclarationsAndSetters,
  });

  const exportCapability = operations.checkTransformationCapability({
    operation: 'export-project',
    options: {
      inputs: options.inputHandling,
      suppressComments: options.suppressComments,
      suppressCommentEnvironments: options.suppressCommentEnvironments,
    },
  });

  const viewBlockedReason = projectModel.viewIssue
    ? `${projectModel.viewIssue.code}: ${projectModel.viewIssue.message}`
    : !projectConfig.entryPath
    ? 'Select an entry file in Settings first.'
    : undefined;

  const activeDecisions =
    !operations.isConditionRealizationStale && operations.conditionRealization
      ? operations.conditionRealization.decisions
      : projectModel.view?.decisions ?? [];

  const findingsCount = operations.result?.findings.length ?? 0;
  const diagnosticsCount = projectModel.issues.length;
  const totalDiagnosticCount =
    diagnosticsCount +
    findingsCount +
    (projectModel.error || operations.error || operations.transformationError ? 1 : 0);

  const handleSelectAstNode = useCallback(
    (node: LayoutNode) => {
      if (node.path && node.path !== selectedFile && filesByName[node.path]) {
        setSelectedArtifact(null);
        selectFile(node.path);
      }
      if (node.range) {
        setJumpRange(node.range);
      }
      if (typeof node.line === 'number' && Number.isFinite(node.line)) {
        setJumpToLine(node.line);
        setJumpToken((value) => value + 1);
      }
      if (projectModel.view?.status === 'ready' && node.occurrenceKey) {
        const allNodes = walkConfiguredNodesAdapter(projectModel.view.root);
        const found = allNodes.find((n) => n.occurrenceKey === node.occurrenceKey) ?? null;
        setSelectedNode(found);
      } else {
        setSelectedNode(null);
      }
    },
    [filesByName, projectModel.view, selectFile, selectedFile],
  );

  const renderAstView = (isSplitCompanion = false) => (
    <div className="AstPaneComposite">
      <NodeActionBar
        selectedNode={selectedNode}
        catalog={projectModel.catalog}
        customCommands={projectConfig.customCommands}
        onRemoveNode={() => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'remove-node', selection: sel }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onRenameEnvironment={(newName) => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'rename-environment', selection: sel, name: newName }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onRenameEnvironmentGlobally={(oldName, newName) => {
          handleRefactorSymbol({
            kind: 'rename-environment-globally',
            oldName,
            newName,
          });
        }}
        onRenameCommand={(newName) => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'rename-command', selection: sel, name: newName }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onRenameCommandGlobally={(oldName, newName) => {
          handleRefactorSymbol({
            kind: 'rename-command-globally',
            oldName,
            newName,
          });
        }}
        onRenameSection={(sectionCommand, starred) => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'rename-section', selection: sel, sectionCommand, starred }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onUnwrapNode={() => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'unwrap-node', selection: sel }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onUpsertCustomCommand={projectConfig.upsertCustomCommand}
        onWrapNode={(wrapperName) => {
          if (!projectModel.view || !selectedNode) return;
          const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
          const res = operations.planTransformation({
            operation: 'edit-nodes',
            options: {
              target: 'selected',
              actions: [{ kind: 'wrap-node', selection: sel, name: wrapperName }],
            },
          });
          stageEditPlanIfPresent(Boolean(res?.editPlan));
        }}
        onClearSelection={() => setSelectedNode(null)}
      />
      <ASTview
        key={`${selectedFile}:${projectModel.view?.id ?? ''}:${isSplitCompanion ? 'split' : 'main'}`}
        root={rootNode}
        selectedNodeKey={selectedNode?.occurrenceKey ?? null}
        isSidePanel={false}
        structureMode={structureMode}
        onChangeStructureMode={setStructureMode}
        isConfiguredAvailable={projectModel.view?.status === 'ready'}
        viewIssue={projectModel.viewIssue}
        coarseOptions={projectConfig.coarseTreeOptions}
        onChangeCoarseOptions={projectConfig.setCoarseTreeOptions}
        hasConditionals={projectModel.hasConditionals}
        conditionPolicy={projectConfig.conditionPolicy}
        detectedConditions={projectModel.detectedConditions}
        onConfigureConditions={projectConfig.setConditionPolicy}
        splitEnabled={layout.splitEnabled}
        onToggleSplit={isSplitCompanion ? undefined : layout.toggleSplit}
        onSelectNode={handleSelectAstNode}
      />
    </div>
  );

  const renderPrimaryView = () => {
    if (fileNames.length === 0) {
      return (
        <WelcomeEmptyState
          onUploadFiles={() => setUploadFilesTrigger((c) => c + 1)}
          onUploadFolder={() => setUploadFolderTrigger((c) => c + 1)}
          onLoadDemo={loadDemoProject}
          onDropFiles={(items) => {
            void upsertFileItems(items);
          }}
        />
      );
    }

    switch (layout.activeView) {
      case 'code':
        return (
          <>
            {selectedArtifact ? (
              <div className="ArtifactBanner">
                <span>
                  Viewing generated artifact: <code>{selectedArtifact.path}</code>
                </span>
                <button
                  type="button"
                  className="ArtifactBannerBtn"
                  onClick={() => setSelectedArtifact(null)}
                >
                  Return to source
                </button>
              </div>
            ) : null}
            <Codeview
              filename={displayedFilename}
              code={displayedCode}
              jumpToLine={jumpToLine}
              jumpRange={jumpRange}
              jumpToken={jumpToken}
            />
          </>
        );

      case 'ast':
        return renderAstView(false);

      case 'transformations':
        return (
          <OperationsDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            options={options}
            onChange={setOptions}
            entryFile={effectiveEntry}
            conditionPolicy={projectConfig.conditionPolicy}
            hasConditionals={projectModel.hasConditionals}
            detectedConditions={projectModel.detectedConditions}
            onConfigureConditions={projectConfig.setConditionPolicy}
            defaultTransformTarget={
              projectConfig.conditionPolicy.mode === 'ignore' ? 'source' : 'selected'
            }
            canRunSourceTransformations={Boolean(projectModel.snapshot && effectiveEntry)}
            canRealizeConditions={Boolean(projectModel.snapshot) && realizeCapability.eligible}
            realizeConditionsReason={realizeCapability.reasons[0]?.message}
            conditionDecisions={activeDecisions}
            onRealizeConditions={(mode, inputs) => {
              const realized = operations.realizeConditions(
                {
                  ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
                  traversal: projectConfig.traversal,
                  conditions: realizePolicy,
                  inputs,
                  stripDeclarationsAndSetters: options.stripDeclarationsAndSetters,
                },
                mode,
              );
              if (!realized) return;
              if (realized.status !== 'ready') {
                layout.selectView('diagnostics');
                return;
              }
              if (mode === 'preview-edits' && realized.editPlan) {
                setSwitchToConditionFree(true);
                layout.selectView('diff');
              }
            }}
            onRunReferences={() => {
              operations.runReferences();
              layout.selectView('diagnostics');
            }}
            canRunReferences={operations.checkReferencesCapability().eligible}
            referencesReason={operations.checkReferencesCapability().reasons[0]?.message}
            onRunCommandUsage={() => {
              operations.runCommandUsage();
              layout.selectView('diagnostics');
            }}
            canRunCommandUsage={operations.checkCommandUsageCapability().eligible}
            commandUsageReason={operations.checkCommandUsageCapability().reasons[0]?.message}
            isAnalyzing={operations.running}
            canRunViewTransformations={projectModel.view?.status === 'ready'}
            viewTransformationReason={viewBlockedReason}
            onPreviewCommentSuppression={(suppressCommentEnvironments, target = 'selected') => {
              const res = operations.planTransformation({
                operation: 'suppress-comments',
                options: {
                  target,
                  suppressCommentEnvironments,
                },
              });
              stageEditPlanIfPresent(Boolean(res?.editPlan));
            }}
            onPreviewRemoveEnvironments={(names, target) => {
              const res = operations.planTransformation({
                operation: 'remove-environments',
                options: {
                  target,
                  names,
                },
              });
              if (target !== 'artifact') {
                stageEditPlanIfPresent(Boolean(res?.editPlan));
              }
            }}
            onExportProject={() => {
              operations.planTransformation({
                operation: 'export-project',
                options: {
                  inputs: options.inputHandling,
                  suppressComments: options.suppressComments,
                  suppressCommentEnvironments: options.suppressCommentEnvironments,
                },
              });
            }}
            canExportProject={exportCapability.eligible}
            exportReason={exportCapability.reasons[0]?.message || viewBlockedReason}
            canComposePipeline={Boolean(projectModel.snapshot && effectiveEntry)}
            onRunCompositePipeline={(cfg) => {
              const useSourceTarget =
                projectConfig.conditionPolicy.mode === 'ignore' && !cfg.realizeConditions;
              const stepTarget = useSourceTarget ? 'source' : 'selected';
              const steps: CompositeStepRequest[] = [];
              if (cfg.realizeConditions) {
                steps.push({
                  operation: 'realize-conditions',
                  options: {
                    ...(effectiveEntry ? { entryPath: effectiveEntry } : {}),
                    traversal: projectConfig.traversal,
                    conditions: realizePolicy,
                    inputs: cfg.finalExport ? 'inline' : 'preserve',
                    stripDeclarationsAndSetters: options.stripDeclarationsAndSetters,
                  },
                });
              }
              if (cfg.suppressComments) {
                steps.push({
                  operation: 'suppress-comments',
                  options: {
                    target: stepTarget,
                    suppressCommentEnvironments: cfg.suppressCommentEnvironments,
                  },
                });
              }
              if (cfg.removeEnvironments.length > 0) {
                steps.push({
                  operation: 'remove-environments',
                  options: {
                    target: stepTarget,
                    names: cfg.removeEnvironments,
                  },
                });
              }
              if (cfg.finalExport) {
                steps.push({
                  operation: 'export-project',
                  options: {
                    inputs: options.inputHandling,
                    suppressComments: cfg.suppressComments,
                    suppressCommentEnvironments: cfg.suppressCommentEnvironments,
                  },
                });
              }
              if (steps.length === 0) return;
              const res = operations.planCompositeTransformation({
                ...(useSourceTarget
                  ? {}
                  : {
                      configuration: {
                        entryPath: effectiveEntry,
                        traversal: projectConfig.traversal,
                        conditions: cfg.realizeConditions ? realizePolicy : projectConfig.conditionPolicy,
                        customCommands: projectConfig.customCommands,
                      },
                    }),
                steps,
              });
              stageEditPlanIfPresent(Boolean(res?.editPlan));
            }}
            artifacts={operations.artifacts}
            onDownloadZip={() => {
              if (operations.artifacts.length > 0) {
                downloadZipArchive(
                  operations.artifacts.map((a) => ({ path: a.path, content: a.source })),
                  'preptex-export.zip',
                );
              }
            }}
            onDownloadArtifact={(art) => {
              const overrideName =
                operations.artifacts.length === 1 ? normalizeOutputName(options.outputName) : '';
              const blob = new Blob([art.source], { type: 'text/plain;charset=utf-8' });
              downloadBlob(blob, overrideName || art.path);
            }}
            onSelectArtifact={(art) => {
              setSelectedArtifact(art);
              layout.selectView('code');
            }}
          />
        );

      case 'catalog':
        return (
          <CatalogDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            catalog={projectModel.catalog}
            customCommands={projectConfig.customCommands}
            onUpsertCustomCommand={projectConfig.upsertCustomCommand}
            onRemoveCustomCommand={projectConfig.removeCustomCommand}
            onRefactorSymbol={handleRefactorSymbol}
            onSelectLocation={jumpToAnalysisLocation}
          />
        );

      case 'metadata':
        return (
          <MetadataDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            metadata={projectModel.metadata}
            onEditMetadata={(action) => handleRefactorSymbol(action)}
            onSelectLocation={jumpToAnalysisLocation}
          />
        );

      case 'diagnostics':
        return (
          <LogDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            diagnostics={projectModel.issues}
            error={projectModel.error || operations.error || operations.transformationError}
            findings={operations.result?.findings}
            isStale={operations.isStale}
            onRunReferences={() => operations.runReferences()}
            canRunReferences={operations.checkReferencesCapability().eligible}
            onRunCommandUsage={() => operations.runCommandUsage()}
            canRunCommandUsage={operations.checkCommandUsageCapability().eligible}
            isAnalyzing={operations.running}
            onSelectLocation={jumpToAnalysisLocation}
          />
        );

      case 'diff':
        return (
          <EditPreviewDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.returnFromDiff('code')}
            editPlan={operations.pendingEditPlan}
            isStale={operations.isEditPlanStale}
            error={operations.transformationError}
            switchToConditionFree={switchToConditionFree}
            onToggleSwitchToConditionFree={setSwitchToConditionFree}
            onSelectLocation={(path, line) => {
              if (filesByName[path]) {
                setSelectedArtifact(null);
                selectFile(path);
              }
              setJumpRange(undefined);
              setJumpToLine(line);
              setJumpToken((val) => val + 1);
              if (!layout.splitEnabled) {
                layout.selectView('code');
              }
            }}
            onDiscard={() => {
              operations.discardPendingEdits();
              layout.returnFromDiff('code');
            }}
            onApply={() => {
              const plan = operations.pendingEditPlan;
              const isConditionRealization =
                plan?.provenance.request.operation === 'realize-conditions';
              const label = getOperationHistoryLabel(plan?.provenance.request.operation);
              operations.applyPendingEdits((updatedFiles: FilesMap) => {
                upsertTextFiles(updatedFiles, { recordHistory: true, label });
                setSelectedNode(null);
                setSelectedArtifact(null);
                if (isConditionRealization && switchToConditionFree) {
                  projectConfig.setConditionPolicy({ mode: 'none' });
                }
                layout.selectView('code');
              });
            }}
          />
        );

      case 'settings':
        return (
          <ProjectSetupDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            files={filesByName}
            configuration={projectConfig}
            onApply={(draft) => {
              projectConfig.commitConfiguration(draft);
              layout.selectView('code');
            }}
            detectedConditions={projectModel.detectedConditions}
            customCommands={projectConfig.customCommands}
            onRemoveCustomCommand={projectConfig.removeCustomCommand}
            splitEnabled={layout.splitEnabled}
            onToggleSplit={layout.toggleSplit}
          />
        );
    }
  };

  return (
    <div className="AppShell">
      <WorkspaceHeader
        activeView={layout.activeView}
        splitEnabled={layout.splitEnabled}
        sidebarCollapsed={layout.sidebarCollapsed}
        openMenu={layout.openMenu}
        onSelectView={layout.selectView}
        onToggleSplit={layout.toggleSplit}
        onToggleSidebar={layout.toggleSidebar}
        onToggleMenu={layout.toggleMenu}
        onCloseMenu={() => layout.setOpenMenu(null)}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        backLabel={backLabel}
        forwardLabel={forwardLabel}
        onGoBack={() => {
          operations.discardPendingEdits();
          setSelectedNode(null);
          setSelectedArtifact(null);
          goBack();
        }}
        onGoForward={() => {
          operations.discardPendingEdits();
          setSelectedNode(null);
          setSelectedArtifact(null);
          goForward();
        }}
        entryPath={projectConfig.entryPath}
        selectedFile={selectedFile}
        fileCount={fileNames.length}
        conditionPolicy={projectConfig.conditionPolicy}
        hasConditionals={projectModel.hasConditionals}
        viewStatus={projectModel.view?.status ?? null}
        pendingDiffCount={operations.pendingEditPlan?.edits.length ?? 0}
        diagnosticCount={totalDiagnosticCount}
        artifactCount={operations.artifacts.length}
        onTriggerUploadFiles={() => setUploadFilesTrigger((c) => c + 1)}
        onTriggerUploadFolder={() => setUploadFolderTrigger((c) => c + 1)}
        onRequestNewFile={() => {
          layout.setSidebarCollapsed(false);
          setNewFileTrigger((c) => c + 1);
        }}
        onLoadDemo={loadDemoProject}
        onOpenExport={() => layout.selectView('transformations')}
        onDownloadProjectZip={() => {
          const entries = Object.entries(filesByName).map(([path, content]) => ({ path, content }));
          if (entries.length > 0) {
            downloadZipArchive(entries, 'preptex-project.zip');
          }
        }}
        onDownloadActiveFile={() => {
          if (selectedFile) {
            onDownload(selectedFile);
          }
        }}
        onResetWorkspace={() => {
          resetFiles();
          operations.discardPendingEdits();
          setSelectedNode(null);
          setSelectedArtifact(null);
          layout.selectView('code');
        }}
      />

      <div className="WorkspaceMainRow">
        <aside
          className={`WorkspaceSidebar${layout.sidebarCollapsed ? ' is-collapsed' : ''}`}
          aria-hidden={layout.sidebarCollapsed}
        >
          <Filetree
            files={fileNames}
            selected={selectedFile}
            entryPath={projectConfig.entryPath}
            onSelect={onSelectFile}
            onSetEntry={(path) => projectConfig.setEntryPath(path)}
            onCreateFile={handleCreateFile}
            onDownload={onDownload}
            onRemove={(name) => removeFile(name)}
            onUploadFiles={(fl) => {
              void upsertFiles(fl);
            }}
            onDropFiles={(items) => {
              void upsertFileItems(items);
            }}
            uploadError={uploadError}
            uploadFilesTrigger={uploadFilesTrigger}
            uploadFolderTrigger={uploadFolderTrigger}
            newFileTrigger={newFileTrigger}
          />
        </aside>

        <main className="WorkspaceViewport">
          <div className="WorkspacePrimaryPane">{renderPrimaryView()}</div>

          {layout.splitEnabled && fileNames.length > 0 ? (
            <div className="WorkspaceSplitPane" aria-label="Split companion view">
              {layout.activeView === 'code' ? (
                renderAstView(true)
              ) : (
                <>
                  <div className="SplitPaneHeader">
                    <span>Code Companion</span>
                    <button
                      type="button"
                      className="AstPhase0ToggleBtn"
                      onClick={() => layout.setSplitEnabled(false)}
                    >
                      Close Split
                    </button>
                  </div>
                  <Codeview
                    filename={displayedFilename}
                    code={displayedCode}
                    jumpToLine={jumpToLine}
                    jumpRange={jumpRange}
                    jumpToken={jumpToken}
                  />
                </>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;
