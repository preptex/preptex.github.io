import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TransformedFile } from '@preptex/core';
import type { FilesMap } from './types/files';
import './App.css';

import { ASTview, Codeview, ControlPanel, Filetree, LogPanel } from './components';
import { ProjectSetupDialog } from './components/ProjectSetupDialog';
import { ConfigurationSummary } from './components/ConfigurationSummary';
import { EditPreviewDialog } from './components/EditPreviewDialog';
import { NodeActionBar } from './components/NodeActionBar';
import { useFiles } from './model/useFiles';
import { useControl } from './model/useControl';
import { useCoreProcess } from './model/useCoreProcess';
import { useProjectConfiguration } from './model/useProjectConfiguration';
import { useProjectModel } from './model/useProjectModel';
import { useOperations } from './model/useOperations';
import { useArtifacts } from './model/useArtifacts';
import { TreeLayoutBuilder } from './components/astview/treebuilder';
import type { LayoutNode } from './types/LayoutNode';
import type { ConfiguredNode, GeneratedArtifact } from '@preptex/core';
import { selectProjectNodeAdapter, walkConfiguredNodesAdapter } from './services/core';
import { downloadBlob, downloadZipArchive } from './services/zip';

function App() {
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [jumpRange, setJumpRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [jumpToken, setJumpToken] = useState(0);
  const [bottomTab, setBottomTab] = useState<'control' | 'log'>('control');
  const [structureMode, setStructureMode] = useState<'configured' | 'source'>('configured');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const hasImportedRef = useRef(false);

  const [astCollapsed, setAstCollapsed] = useState(false);
  const [astWidth, setAstWidth] = useState(320);
  const astPaneRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);

  const [selectedNode, setSelectedNode] = useState<ConfiguredNode | null>(null);
  const [isEditPreviewOpen, setIsEditPreviewOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<GeneratedArtifact | null>(null);

  const {
    filesByName,
    fileNames,
    selectedFile,
    selectFile,
    uploadError,
    upsertFiles,
    upsertTextFiles,
    removeFile,
    sourceRevision,
  } = useFiles();

  const projectConfig = useProjectConfiguration(filesByName, { entryPath: selectedFile || null });
  const projectModel = useProjectModel(filesByName, sourceRevision, projectConfig);
  const operations = useOperations(projectModel.snapshot, projectModel.view);
  const { addArtifacts } = useArtifacts();

  // Open Project Setup once when files are first imported into an empty workspace
  useEffect(() => {
    if (fileNames.length > 0 && !hasImportedRef.current) {
      hasImportedRef.current = true;
      setIsSetupOpen(true);
    }
  }, [fileNames]);

  const { options, setOptions } = useControl();

  const code = filesByName[selectedFile] ?? '';
  const displayedFilename = selectedArtifact ? selectedArtifact.path : selectedFile;
  const displayedCode = selectedArtifact ? selectedArtifact.source : code;

  const effectiveEntry = projectConfig.entryPath || selectedFile;

  const {
    result: coreRun,
    transform,
    project,
    canTransform,
  } = useCoreProcess(effectiveEntry, filesByName, options);

  const rootNode: LayoutNode | null = useMemo(() => {
    if (structureMode === 'configured') {
      if (projectModel.view?.status === 'ready' && projectModel.view.root) {
        return new TreeLayoutBuilder().buildConfigured(projectModel.view.root);
      }
      const astRoot = project?.files.find((file) => file.path === selectedFile)?.root;
      if (astRoot) {
        return new TreeLayoutBuilder().build(astRoot);
      }
      return null;
    }

    // Source mode: raw tokens from scanned file
    const scannedFile = projectModel.snapshot?.files.find((file) => file.path === selectedFile);
    if (scannedFile && scannedFile.tokens.length > 0) {
      return new TreeLayoutBuilder().buildSourceTokens(selectedFile, scannedFile.tokens);
    }

    const astRoot = project?.files.find((file) => file.path === selectedFile)?.root;
    if (astRoot) {
      return new TreeLayoutBuilder().build(astRoot);
    }
    return null;
  }, [structureMode, projectModel.view, projectModel.snapshot, project, selectedFile]);

  const onDownload = (name: string) => {
    const text = filesByName[name] ?? '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const normalizeOutputName = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const hasExt = /\.[^./\\]+$/.test(trimmed);
    return hasExt ? trimmed : `${trimmed}.processed.tex`;
  };

  const writeOutputsToTree = (outputs: readonly TransformedFile[]) => {
    const overrideName = normalizeOutputName(options.outputName);
    let entryOutputName = '';
    const entries = outputs.map(({ path: name, source }) => {
      const isEntry = name === effectiveEntry;
      const newname =
        overrideName && isEntry ? overrideName : name.replace(/\.tex$/i, '') + '.processed.tex';
      if (isEntry) entryOutputName = newname;
      return [newname, source] as const;
    });
    const next: FilesMap = Object.fromEntries(entries);
    upsertTextFiles(next);
    if (entryOutputName) {
      selectFile(entryOutputName);
    }
  };

  const onTransform = () => {
    const outputs = transform();
    if (!outputs) {
      setBottomTab('log');
      return;
    }
    addArtifacts(outputs.map((out) => ({ path: out.path, source: out.source })));
    writeOutputsToTree(outputs);
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

  const appStyle: React.CSSProperties & { '--ast-pane-col': string } = {
    '--ast-pane-col': astPaneCol,
  };

  const findingsCount = operations.result?.findings.length ?? 0;
  const diagnosticsCount = coreRun.diagnostics.length;
  const hasError = Boolean(projectModel.error || operations.error || coreRun.error);
  const logTabLabel = hasError
    ? 'Log (error)'
    : diagnosticsCount + findingsCount > 0
    ? `Log (${diagnosticsCount + findingsCount})`
    : 'Log';

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

      <EditPreviewDialog
        isOpen={isEditPreviewOpen && Boolean(operations.pendingEditPlan)}
        onClose={() => setIsEditPreviewOpen(false)}
        editPlan={operations.pendingEditPlan}
        isStale={operations.isEditPlanStale}
        error={operations.transformationError}
        onDiscard={() => {
          operations.discardPendingEdits();
          setIsEditPreviewOpen(false);
        }}
        onApply={() => {
          operations.applyPendingEdits((updatedFiles) => {
            upsertTextFiles(updatedFiles);
            setSelectedNode(null);
            setIsEditPreviewOpen(false);
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

      <div className="AppCell AppCell--leftBottom">
        <div className="BottomTabs" role="tablist" aria-label="Bottom panel">
          <button
            type="button"
            role="tab"
            aria-selected={bottomTab === 'control'}
            aria-controls="bottom-panel-control"
            className={bottomTab === 'control' ? 'BottomTab BottomTab--active' : 'BottomTab'}
            onClick={() => setBottomTab('control')}
          >
            Control Panel
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={bottomTab === 'log'}
            aria-controls="bottom-panel-log"
            className={bottomTab === 'log' ? 'BottomTab BottomTab--active' : 'BottomTab'}
            onClick={() => setBottomTab('log')}
          >
            {logTabLabel}
          </button>
        </div>

        <div className={`BottomTabPanel BottomTabPanel--${bottomTab}`}>
          {bottomTab === 'control' ? (
            <div id="bottom-panel-control" role="tabpanel" aria-label="Control Panel">
              <ControlPanel
                options={options}
                onChange={setOptions}
                entryFile={effectiveEntry}
                availableIfConditions={
                  projectModel.detectedConditions.length > 0
                    ? projectModel.detectedConditions
                    : coreRun.declaredConditions
                }
                onTransform={onTransform}
                canTransform={canTransform}
                onRunReferences={() => {
                  operations.runReferences();
                  setBottomTab('log');
                }}
                canRunReferences={operations.checkReferencesCapability().eligible}
                referencesReason={operations.checkReferencesCapability().reasons[0]?.message}
                onRunCommandUsage={() => {
                  operations.runCommandUsage();
                  setBottomTab('log');
                }}
                canRunCommandUsage={operations.checkCommandUsageCapability().eligible}
                commandUsageReason={operations.checkCommandUsageCapability().reasons[0]?.message}
                isAnalyzing={operations.running}
                onPreviewCommentSuppression={(target, suppressCommentEnvironments) => {
                  operations.planTransformation({
                    operation: 'suppress-comments',
                    options: {
                      target,
                      suppressCommentEnvironments,
                    },
                  });
                  setIsEditPreviewOpen(true);
                }}
                onPreviewRemoveEnvironments={(names, target) => {
                  operations.planTransformation({
                    operation: 'remove-environments',
                    options: {
                      target,
                      names,
                    },
                  });
                  setIsEditPreviewOpen(true);
                }}
                onExportProject={(conditions, inputs) => {
                  operations.planTransformation({
                    operation: 'export-project',
                    options: {
                      conditions,
                      inputs,
                      suppressComments: options.suppressComments,
                    },
                  });
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
                  const blob = new Blob([art.source], { type: 'text/plain;charset=utf-8' });
                  downloadBlob(blob, art.path);
                }}
                onSelectArtifact={(art) => {
                  setSelectedArtifact(art);
                }}
              />
            </div>
          ) : (
            <div id="bottom-panel-log" role="tabpanel" aria-label="Log">
              <LogPanel
                diagnostics={coreRun.diagnostics}
                error={projectModel.error || operations.error || coreRun.error}
                findings={operations.result?.findings}
                isStale={operations.isStale}
                onSelectLocation={(location) => {
                  if (filesByName[location.path]) {
                    setSelectedArtifact(null);
                    selectFile(location.path);
                  }
                  setJumpRange(location.range);
                  setJumpToLine(location.range.line);
                  setJumpToken((val) => val + 1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="AppCell AppCell--middle">
        <ConfigurationSummary
          configuration={projectConfig}
          view={projectModel.view}
          onOpenSettings={() => setIsSetupOpen(true)}
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
          structureMode={structureMode}
          onChangeStructureMode={setStructureMode}
          isConfiguredAvailable={projectModel.view?.status === 'ready'}
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
