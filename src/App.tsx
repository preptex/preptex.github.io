import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from './components';
import type { AstStructureMode } from './components/astview/ASTview';
import { ProjectSetupDialog } from './components/ProjectSetupDialog';
import { ConfigurationSummary } from './components/ConfigurationSummary';
import { EditPreviewDialog } from './components/EditPreviewDialog';
import { NodeActionBar } from './components/NodeActionBar';
import { useFiles } from './model/useFiles';
import { useControl } from './model/useControl';
import { useProjectConfiguration } from './model/useProjectConfiguration';
import { useProjectModel } from './model/useProjectModel';
import { useOperations } from './model/useOperations';
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

function App() {
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [jumpRange, setJumpRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [jumpToken, setJumpToken] = useState(0);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [structureMode, setStructureMode] = useState<AstStructureMode>('coarse');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const hasImportedRef = useRef(false);

  const [astCollapsed, setAstCollapsed] = useState(false);
  const [astWidth, setAstWidth] = useState(320);
  const astPaneRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);

  const [selectedNode, setSelectedNode] = useState<ConfiguredNode | null>(null);
  const [isEditPreviewOpen, setIsEditPreviewOpen] = useState(false);
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
    upsertTextFiles,
    removeFile,
    sourceRevision,
  } = useFiles();

  const projectConfig = useProjectConfiguration(filesByName, { entryPath: selectedFile || null });
  const projectModel = useProjectModel(filesByName, sourceRevision, projectConfig, fileVersions);
  const operations = useOperations(projectModel.snapshot, projectModel.view);

  // Open Project Setup once when files are first imported into an empty workspace
  useEffect(() => {
    if (fileNames.length > 0 && !hasImportedRef.current) {
      hasImportedRef.current = true;
      setIsSetupOpen(true);
    }
  }, [fileNames]);

  // Demo / Snapshot URL parameter support for visual verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'sample' && fileNames.length === 0) {
      hasImportedRef.current = true;
      upsertTextFiles({
        'main.tex': `\\documentclass[11pt]{article}
\\usepackage{amsmath}
\\newcommand{\\highlight}[1]{\\textbf{#1}}
\\newenvironment{notebox}{\\begin{quote}}{\\end{quote}}
\\newif\\ifdraft
\\drafttrue
\\title[PrepTeX Demo]{PrepTeX Phase 2 Workspace Demo}
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
      });
      selectFile('main.tex');
      projectConfig.commitConfiguration({
        entryPath: 'main.tex',
        traversal: 'project',
        conditionPolicy: { mode: 'source-with-overrides', overrides: { draft: true } },
      });
      const state = params.get('state');
      if (state === 'operations') {
        setIsOperationsOpen(true);
      } else if (state === 'catalog') {
        setIsCatalogOpen(true);
      } else if (state === 'metadata') {
        setIsMetadataOpen(true);
      } else if (state === 'log' || state === 'bottom-log') {
        setIsLogOpen(true);
        setTimeout(() => {
          operations.runReferences();
        }, 100);
      }
    }
  }, [fileNames.length, selectFile, upsertTextFiles, projectConfig, operations]);

  const { options, setOptions } = useControl();

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

  const jumpToAnalysisLocation = (location: SourceLocation) => {
    if (filesByName[location.path]) {
      setSelectedArtifact(null);
      selectFile(location.path);
    }
    setJumpRange(location.range);
    setJumpToLine(location.range.line);
    setJumpToken((val) => val + 1);
  };

  const handleRefactorSymbol = (action: SymbolRefactorAction) => {
    const res = operations.planTransformation({
      operation: 'refactor-symbols',
      options: {
        target: projectModel.view?.status === 'ready' ? 'selected' : 'source',
        actions: [action],
      },
    });
    if (res?.editPlan) {
      setIsCatalogOpen(false);
      setIsMetadataOpen(false);
      setIsEditPreviewOpen(true);
    }
  };

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
  };

  const astPaneCol = astCollapsed ? '34px' : `${astWidth}px`;

  const onRemove = (name: string) => {
    removeFile(name);
  };

  const realizePolicy =
    projectConfig.conditionPolicy.mode === 'none'
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
  const hasBlockingIssue = projectModel.issues.some((issue) => issue.severity === 'error');
  const hasError = Boolean(
    projectModel.error || operations.error || operations.transformationError || hasBlockingIssue,
  );
  const logButtonLabel = hasError
    ? 'Log (error)'
    : diagnosticsCount + findingsCount > 0
    ? `Log (${diagnosticsCount + findingsCount})`
    : 'Log';

  useEffect(() => {
    if (hasError) {
      setIsLogOpen(true);
    }
  }, [hasError]);

  const appStyle: React.CSSProperties & {
    '--ast-pane-col': string;
  } = {
    '--ast-pane-col': astPaneCol,
  };

  return (
    <div className="App" style={appStyle}>
      <ProjectSetupDialog
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        files={filesByName}
        configuration={projectConfig}
        onApply={projectConfig.commitConfiguration}
        detectedConditions={projectModel.detectedConditions}
      />

      <OperationsDialog
        isOpen={isOperationsOpen}
        onClose={() => setIsOperationsOpen(false)}
        options={options}
        onChange={setOptions}
        entryFile={effectiveEntry}
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
            setIsOperationsOpen(false);
            setIsLogOpen(true);
            return;
          }
          if (mode === 'preview-edits' && realized.editPlan) {
            setSwitchToConditionFree(true);
            setIsOperationsOpen(false);
            setIsEditPreviewOpen(true);
          }
        }}
        onRunReferences={() => {
          operations.runReferences();
          setIsOperationsOpen(false);
          setIsLogOpen(true);
        }}
        canRunReferences={operations.checkReferencesCapability().eligible}
        referencesReason={operations.checkReferencesCapability().reasons[0]?.message}
        onRunCommandUsage={() => {
          operations.runCommandUsage();
          setIsOperationsOpen(false);
          setIsLogOpen(true);
        }}
        canRunCommandUsage={operations.checkCommandUsageCapability().eligible}
        commandUsageReason={operations.checkCommandUsageCapability().reasons[0]?.message}
        isAnalyzing={operations.running}
        canRunViewTransformations={projectModel.view?.status === 'ready'}
        viewTransformationReason={viewBlockedReason}
        onPreviewCommentSuppression={(suppressCommentEnvironments) => {
          const res = operations.planTransformation({
            operation: 'suppress-comments',
            options: {
              target: 'selected',
              suppressCommentEnvironments,
            },
          });
          if (res?.editPlan) {
            setIsOperationsOpen(false);
            setIsEditPreviewOpen(true);
          }
        }}
        onPreviewRemoveEnvironments={(names, target) => {
          const res = operations.planTransformation({
            operation: 'remove-environments',
            options: {
              target,
              names,
            },
          });
          if (target === 'selected' && res?.editPlan) {
            setIsOperationsOpen(false);
            setIsEditPreviewOpen(true);
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
                target: 'selected',
                suppressCommentEnvironments: cfg.suppressCommentEnvironments,
              },
            });
          }
          if (cfg.removeEnvironments.length > 0) {
            steps.push({
              operation: 'remove-environments',
              options: {
                target: 'selected',
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
            configuration: {
              entryPath: effectiveEntry,
              traversal: projectConfig.traversal,
              conditions: projectConfig.conditionPolicy,
              customCommands: projectConfig.customCommands,
            },
            steps,
          });
          if (res?.editPlan) {
            setIsOperationsOpen(false);
            setIsEditPreviewOpen(true);
          }
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
          setIsOperationsOpen(false);
        }}
      />

      <EditPreviewDialog
        isOpen={isEditPreviewOpen && Boolean(operations.pendingEditPlan)}
        onClose={() => setIsEditPreviewOpen(false)}
        editPlan={operations.pendingEditPlan}
        isStale={operations.isEditPlanStale}
        error={operations.transformationError}
        switchToConditionFree={switchToConditionFree}
        onToggleSwitchToConditionFree={setSwitchToConditionFree}
        onDiscard={() => {
          operations.discardPendingEdits();
          setIsEditPreviewOpen(false);
        }}
        onApply={() => {
          const isConditionRealization =
            operations.pendingEditPlan?.provenance.request.operation === 'realize-conditions';
          operations.applyPendingEdits((updatedFiles: FilesMap) => {
            upsertTextFiles(updatedFiles);
            setSelectedNode(null);
            setIsEditPreviewOpen(false);
            if (isConditionRealization && switchToConditionFree) {
              projectConfig.setConditionPolicy({ mode: 'none' });
            }
          });
        }}
      />

      <div className="AppCell AppCell--leftTop">
        <Filetree
          files={fileNames}
          selected={selectedFile}
          onSelect={onSelectFile}
          onDownload={onDownload}
          onRemove={onRemove}
          onUploadFiles={(fl) => { void upsertFiles(fl); }}
          uploadError={uploadError}
        />
      </div>

      <LogDialog
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        diagnostics={projectModel.issues}
        error={projectModel.error || operations.error || operations.transformationError}
        findings={operations.result?.findings}
        isStale={operations.isStale}
        onSelectLocation={jumpToAnalysisLocation}
      />

      <CatalogDialog
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        catalog={projectModel.catalog}
        customCommands={projectConfig.customCommands}
        onUpsertCustomCommand={projectConfig.upsertCustomCommand}
        onRemoveCustomCommand={projectConfig.removeCustomCommand}
        onRefactorSymbol={handleRefactorSymbol}
        onSelectLocation={(loc) => {
          setIsCatalogOpen(false);
          jumpToAnalysisLocation(loc);
        }}
      />

      <MetadataDialog
        isOpen={isMetadataOpen}
        onClose={() => setIsMetadataOpen(false)}
        metadata={projectModel.metadata}
        onEditMetadata={(action) => handleRefactorSymbol(action)}
        onSelectLocation={(loc) => {
          setIsMetadataOpen(false);
          jumpToAnalysisLocation(loc);
        }}
      />

      <div className="AppCell AppCell--middle">
        <ConfigurationSummary
          configuration={projectConfig}
          view={projectModel.view}
          documentTitle={projectModel.metadata?.title?.text ?? null}
          undefinedCommandCount={projectModel.catalog?.usedUndefinedCommands.length ?? 0}
          onOpenSettings={() => setIsSetupOpen(true)}
          onOpenCatalog={() => setIsCatalogOpen(true)}
          onOpenMetadata={() => setIsMetadataOpen(true)}
          onOpenOperations={() => setIsOperationsOpen(true)}
          onOpenLog={() => setIsLogOpen(true)}
          logLabel={logButtonLabel}
          hasLogError={hasError}
          hasLogWarning={diagnosticsCount + findingsCount > 0 && !hasError}
        />
        <Codeview
          filename={displayedFilename}
          code={displayedCode}
          jumpToLine={jumpToLine}
          jumpRange={jumpRange}
          jumpToken={jumpToken}
        />
      </div>

      <div
        className={`AppCell AppCell--right ${astCollapsed ? 'AppCell--rightCollapsed' : ''}`}
        ref={astPaneRef}
      >
        {astCollapsed ? null : (
          <div
            className="AstPaneResizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize AST pane"
            tabIndex={-1}
            onPointerDown={(e) => {
              if (!astPaneRef.current) return;
              const startWidth = astPaneRef.current.getBoundingClientRect().width;
              resizeRef.current = { startX: e.clientX, startWidth, pointerId: e.pointerId };
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              const state = resizeRef.current;
              if (!state || state.pointerId !== e.pointerId) return;
              const dx = state.startX - e.clientX;
              const maxWidth = Math.max(260, window.innerWidth - 520 - 220);
              const next = Math.max(220, Math.min(maxWidth, Math.round(state.startWidth + dx)));
              setAstWidth(next);
            }}
            onPointerUp={(e) => {
              const state = resizeRef.current;
              if (!state || state.pointerId !== e.pointerId) return;
              resizeRef.current = null;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
            onPointerCancel={(e) => {
              const state = resizeRef.current;
              if (!state || state.pointerId !== e.pointerId) return;
              resizeRef.current = null;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
          />
        )}
        <NodeActionBar
          selectedNode={selectedNode}
          catalog={projectModel.catalog}
          customCommands={projectConfig.customCommands}
          onRemoveNode={() => {
            if (!projectModel.view || !selectedNode) return;
            const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'remove-node', selection: sel }],
              },
            });
            setIsEditPreviewOpen(true);
          }}
          onRenameEnvironment={(newName) => {
            if (!projectModel.view || !selectedNode) return;
            const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'rename-environment', selection: sel, name: newName }],
              },
            });
            setIsEditPreviewOpen(true);
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
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'rename-command', selection: sel, name: newName }],
              },
            });
            setIsEditPreviewOpen(true);
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
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'rename-section', selection: sel, sectionCommand, starred }],
              },
            });
            setIsEditPreviewOpen(true);
          }}
          onUnwrapNode={() => {
            if (!projectModel.view || !selectedNode) return;
            const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'unwrap-node', selection: sel }],
              },
            });
            setIsEditPreviewOpen(true);
          }}
          onUpsertCustomCommand={projectConfig.upsertCustomCommand}
          onWrapNode={(wrapperName) => {
            if (!projectModel.view || !selectedNode) return;
            const sel = selectProjectNodeAdapter(projectModel.view, selectedNode.occurrenceKey);
            operations.planTransformation({
              operation: 'edit-nodes',
              options: {
                target: 'selected',
                actions: [{ kind: 'wrap-node', selection: sel, name: wrapperName }],
              },
            });
            setIsEditPreviewOpen(true);
          }}
          onClearSelection={() => setSelectedNode(null)}
        />
        <ASTview
          key={`${selectedFile}:${projectModel.view?.id ?? ''}`}
          root={rootNode}
          selectedNodeKey={selectedNode?.occurrenceKey ?? null}
          structureMode={structureMode}
          onChangeStructureMode={setStructureMode}
          isConfiguredAvailable={projectModel.view?.status === 'ready'}
          viewIssue={projectModel.viewIssue}
          coarseOptions={projectConfig.coarseTreeOptions}
          onChangeCoarseOptions={projectConfig.setCoarseTreeOptions}
          onSelectNode={(node) => {
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
          }}
          collapsed={astCollapsed}
          onToggleCollapsed={() => setAstCollapsed((value) => !value)}
        />
      </div>
    </div>
  );
}

export default App;
