import React, { useMemo, useRef, useState } from 'react';
import type { TransformedFile } from '@preptex/core';
import type { FilesMap } from './types/files';
import './App.css';

import { ASTview, Codeview, ControlPanel, Filetree, LogPanel } from './components';
import { useFiles } from './model/useFiles';
import { useControl } from './model/useControl';
import { useCoreProcess } from './model/useCoreProcess';
import { TreeLayoutBuilder } from './components/astview/treebuilder';

function App() {
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
    uploadError,
    upsertFiles,
    upsertTextFiles,
    removeFile,
  } = useFiles();

  const { options, setOptions } = useControl();

  const code = filesByName[selectedFile] ?? '';

  const {
    result: coreRun,
    transform,
    project,
    canTransform,
  } = useCoreProcess(selectedFile, filesByName, options);

  const rootNode = useMemo(() => {
    const astRoot = project?.files.find((file) => file.path === selectedFile)?.root;
    if (!astRoot) return null;
    return new TreeLayoutBuilder().build(astRoot);
  }, [selectedFile, project]);

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
    // If user provided an extension, respect it. Otherwise default to .processed.tex
    const hasExt = /\.[^./\\]+$/.test(trimmed);
    return hasExt ? trimmed : `${trimmed}.processed.tex`;
  };

  const writeOutputsToTree = (outputs: readonly TransformedFile[]) => {
    const overrideName = normalizeOutputName(options.outputName);
    let entryOutputName = '';
    const entries = outputs.map(({ path: name, source }) => {
      const isEntry = name === selectedFile;
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

  const appStyle: React.CSSProperties & { '--ast-pane-col': string } = {
    '--ast-pane-col': astPaneCol,
  };

  return (
    <div className="App" style={appStyle}>
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
            Log{coreRun.error ? ' (error)' : coreRun.diagnostics.length ? ` (${coreRun.diagnostics.length})` : ''}
          </button>
        </div>

        <div className={`BottomTabPanel BottomTabPanel--${bottomTab}`}>
          {bottomTab === 'control' ? (
            <div id="bottom-panel-control" role="tabpanel" aria-label="Control Panel">
              <ControlPanel
                options={options}
                onChange={setOptions}
                entryFile={selectedFile}
                availableIfConditions={coreRun.declaredConditions}
                onTransform={onTransform}
                canTransform={canTransform}
              />
            </div>
          ) : (
            <div id="bottom-panel-log" role="tabpanel" aria-label="Log">
              <LogPanel diagnostics={coreRun.diagnostics} error={coreRun.error} />
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
        <ASTview
          key={selectedFile}
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
