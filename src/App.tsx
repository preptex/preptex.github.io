import React, { useMemo, useRef, useState } from 'react';
import './App.css';

import { ASTview, Codeview, ControlPanel, Filetree, LogPanel } from './components';
import { useFiles } from './model/useFiles';
import { useControl } from './model/useControl';
import { useCoreProcess } from './model/useCoreProcess';
import { TreeLayoutBuilder } from './components/astview/treebuilder';

function App() {
  const seedFiles = useMemo<Record<string, string>>(() => ({}), []);

  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [jumpToken, setJumpToken] = useState(0);
  const [bottomTab, setBottomTab] = useState<'control' | 'log'>('control');

  const [astCollapsed, setAstCollapsed] = useState(false);
  const [astWidth, setAstWidth] = useState(320);
  const astPaneRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);

  const {
    filesByName,
    fileNames,
    selectedFile,
    selectFile,
    mutation,
    upsertFiles,
    upsertTextFiles,
    removeFile,
  } = useFiles(seedFiles);

  const { options, setOptions } = useControl();

  const code = filesByName[selectedFile] ?? '';

  const {
    result: coreRun,
    transform,
    project,
    projectVersion,
  } = useCoreProcess(selectedFile, mutation, options);

  const rootNode = useMemo(() => {
    void projectVersion;
    const astRoot = project?.getRoots()?.[selectedFile];
    if (!astRoot) return null;
    return new TreeLayoutBuilder().build(astRoot);
  }, [projectVersion, selectedFile, project]);

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
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    // If user provided an extension, respect it. Otherwise default to .processed.tex
    const hasExt = /\.[^./\\]+$/.test(trimmed);
    return hasExt ? trimmed : `${trimmed}.processed.tex`;
  };

  const writeOutputsToTree = (outputs: Record<string, string>) => {
    const next: Record<string, string> = {};
    const overrideName = normalizeOutputName(options.outputName);
    let firstOutputName = '';
    for (const [name, text] of Object.entries(outputs)) {
      const isEntry = name === selectedFile;
      const newname =
        overrideName && isEntry ? overrideName : name.replace(/\.tex$/i, '') + '.processed.tex';
      next[newname] = text;
      if (!firstOutputName) firstOutputName = newname;
    }
    upsertTextFiles(next);
    if (firstOutputName) {
      selectFile(firstOutputName);
    }
  };

  const onTransform = () => {
    const outputs = transform(selectedFile);
    if (!outputs) return;
    writeOutputsToTree(outputs);
  };

  const onSelectFile = (name: string) => {
    setJumpToLine(undefined);
    selectFile(name);
  };

  const astPaneCol = astCollapsed ? '34px' : `${astWidth}px`;

  const onRemove = (name: string) => {
    removeFile(name);
  };

  return (
    <div className="App" style={{ ['--ast-pane-col' as any]: astPaneCol }}>
      <div className="AppCell AppCell--leftTop">
        <Filetree
          files={fileNames}
          selected={selectedFile}
          onSelect={onSelectFile}
          onDownload={onDownload}
          onRemove={onRemove}
          onUploadFiles={(fl) => upsertFiles(fl)}
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
            Log
          </button>
        </div>

        <div className={`BottomTabPanel BottomTabPanel--${bottomTab}`}>
          {bottomTab === 'control' ? (
            <div id="bottom-panel-control" role="tabpanel" aria-label="Control Panel">
              <ControlPanel
                options={options}
                onChange={setOptions}
                entryFile={selectedFile}
                availableIfConditions={coreRun?.declaredConditions ?? []}
                onTransform={onTransform}
              />
            </div>
          ) : (
            <div id="bottom-panel-log" role="tabpanel" aria-label="Log">
              <LogPanel notes={coreRun?.notes ?? []} error={coreRun?.error} />
            </div>
          )}
        </div>
      </div>

      <div className="AppCell AppCell--middle">
        <Codeview
          filename={selectedFile}
          code={code}
          jumpToLine={jumpToLine}
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
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
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
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
            onPointerCancel={(e) => {
              const state = resizeRef.current;
              if (!state || state.pointerId !== e.pointerId) return;
              resizeRef.current = null;
              try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
          />
        )}
        <ASTview
          root={rootNode}
          onSelectNode={(node) => {
            if (typeof node.line === 'number' && Number.isFinite(node.line)) {
              setJumpToLine(node.line);
              setJumpToken((value) => value + 1);
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
