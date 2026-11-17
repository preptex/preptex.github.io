import type { ConditionPolicy } from '@preptex/core';
import { useEffect, useRef } from 'react';
import type { WorkspaceMenuId, WorkspaceViewId } from '../model/useWorkspaceLayout';
import './WorkspaceHeader.css';

export interface WorkspaceViewDescriptor {
  readonly id: WorkspaceViewId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly icon: string;
  readonly badge?: string | number | null;
  readonly tone?: 'default' | 'warning' | 'accent';
}

export interface WorkspaceHeaderProps {
  readonly activeView: WorkspaceViewId;
  readonly splitEnabled: boolean;
  readonly sidebarCollapsed: boolean;
  readonly openMenu: WorkspaceMenuId;
  readonly onSelectView: (view: WorkspaceViewId) => void;
  readonly onToggleSplit: () => void;
  readonly onToggleSidebar: () => void;
  readonly onToggleMenu: (menu: Exclude<WorkspaceMenuId, null>) => void;
  readonly onCloseMenu: () => void;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly backLabel: string | null;
  readonly forwardLabel: string | null;
  readonly onGoBack: () => void;
  readonly onGoForward: () => void;
  readonly entryPath: string | null;
  readonly selectedFile: string;
  readonly fileCount: number;
  readonly conditionPolicy: ConditionPolicy;
  readonly hasConditionals: boolean;
  readonly viewStatus: string | null;
  readonly pendingDiffCount: number;
  readonly diagnosticCount: number;
  readonly artifactCount: number;
  readonly onTriggerUploadFiles: () => void;
  readonly onTriggerUploadFolder: () => void;
  readonly onRequestNewFile: () => void;
  readonly onLoadDemo: () => void;
  readonly onOpenExport: () => void;
  readonly onDownloadProjectZip: () => void;
  readonly onDownloadActiveFile: () => void;
  readonly onResetWorkspace: () => void;
}

export default function WorkspaceHeader({
  activeView,
  splitEnabled,
  sidebarCollapsed,
  openMenu,
  onSelectView,
  onToggleSplit,
  onToggleSidebar,
  onToggleMenu,
  onCloseMenu,
  canGoBack,
  canGoForward,
  backLabel,
  forwardLabel,
  onGoBack,
  onGoForward,
  entryPath,
  selectedFile,
  fileCount,
  conditionPolicy,
  hasConditionals,
  viewStatus,
  pendingDiffCount,
  diagnosticCount,
  artifactCount,
  onTriggerUploadFiles,
  onTriggerUploadFolder,
  onRequestNewFile,
  onLoadDemo,
  onOpenExport,
  onDownloadProjectZip,
  onDownloadActiveFile,
  onResetWorkspace,
}: WorkspaceHeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, onCloseMenu]);

  const views: readonly WorkspaceViewDescriptor[] = [
    {
      id: 'code',
      label: 'Code',
      shortLabel: 'Code',
      description: 'Read and navigate TeX source files',
      icon: '{}',
    },
    {
      id: 'ast',
      label: 'AST',
      shortLabel: 'AST',
      description: 'Explore coarse, structural, and source trees',
      icon: '⌥',
      tone: viewStatus === 'blocked' ? 'warning' : 'default',
      badge: viewStatus === 'blocked' ? 'Setup' : null,
    },
    {
      id: 'transformations',
      label: 'Transformations',
      shortLabel: 'Transforms',
      description: 'Comments, environments, pipelines & export',
      icon: '⚡',
      badge: artifactCount > 0 ? artifactCount : null,
    },
    {
      id: 'catalog',
      label: 'Catalog',
      shortLabel: 'Catalog',
      description: 'Commands, environments, labels, citations & macros',
      icon: '⌘',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      shortLabel: 'Metadata',
      description: 'Title, authors, abstract & document fields',
      icon: '▤',
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      shortLabel: 'Diagnostics',
      description: 'Project errors, reference & command checks',
      icon: '⚑',
      badge: diagnosticCount > 0 ? diagnosticCount : null,
      tone: diagnosticCount > 0 ? 'warning' : 'default',
    },
    {
      id: 'diff',
      label: 'Diff Review',
      shortLabel: 'Diff',
      description: 'Review staged source changes before applying',
      icon: '±',
      badge: pendingDiffCount > 0 ? `${pendingDiffCount}` : null,
      tone: pendingDiffCount > 0 ? 'accent' : 'default',
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      description: 'Entry file, traversal, conditions & signatures',
      icon: '⚙',
    },
  ];

  const activeDescriptor = views.find((v) => v.id === activeView) ?? views[0];
  const quickTabs = views.filter((v) => v.id !== 'settings' && (v.id !== 'diff' || pendingDiffCount > 0 || activeView === 'diff'));

  const statusTone =
    fileCount === 0
      ? 'idle'
      : viewStatus === 'blocked'
      ? 'warning'
      : 'ready';

  const statusText =
    fileCount === 0
      ? 'Empty workspace'
      : !entryPath
      ? 'No entry file'
      : viewStatus === 'blocked'
      ? 'AST needs conditions'
      : conditionPolicy.mode === 'ignore'
      ? hasConditionals
        ? `${entryPath} · All branches`
        : `${entryPath} · Ready`
      : `${entryPath} · ${conditionPolicy.mode}`;

  return (
    <header className="WorkspaceHeader" ref={headerRef}>
      <div className="WorkspaceHeaderGroup WorkspaceHeaderLeft">
        <button
          type="button"
          className="HeaderIconButton"
          onClick={onToggleSidebar}
          aria-pressed={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Show file explorer' : 'Hide file explorer'}
          title={sidebarCollapsed ? 'Show file explorer' : 'Hide file explorer'}
        >
          <span aria-hidden="true">☰</span>
          <span className="HeaderButtonText">Files</span>
        </button>

        <span className="HeaderBrand">PrepTeX</span>

        <div className="HeaderMenuAnchor">
          <button
            type="button"
            className={`HeaderMenuButton${openMenu === 'file' ? ' is-open' : ''}`}
            onClick={() => onToggleMenu('file')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'file'}
          >
            File <span className="HeaderCaret" aria-hidden="true">▾</span>
          </button>

          {openMenu === 'file' ? (
            <div className="HeaderDropdown" role="menu" aria-label="File menu">
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                onClick={() => {
                  onCloseMenu();
                  onTriggerUploadFiles();
                }}
              >
                <span className="HeaderMenuItemMain">Upload files…</span>
                <span className="HeaderMenuItemHint">Add .tex sources</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                onClick={() => {
                  onCloseMenu();
                  onTriggerUploadFolder();
                }}
              >
                <span className="HeaderMenuItemMain">Upload folder…</span>
                <span className="HeaderMenuItemHint">Preserve subfolders</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                onClick={() => {
                  onCloseMenu();
                  onRequestNewFile();
                }}
              >
                <span className="HeaderMenuItemMain">New file…</span>
                <span className="HeaderMenuItemHint">Create in root or subfolder</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                onClick={() => {
                  onCloseMenu();
                  onLoadDemo();
                }}
              >
                <span className="HeaderMenuItemMain">Load demo project</span>
                <span className="HeaderMenuItemHint">Includes nested \input</span>
              </button>

              <div className="HeaderMenuDivider" role="separator" />

              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                disabled={fileCount === 0}
                onClick={() => {
                  onCloseMenu();
                  onOpenExport();
                }}
              >
                <span className="HeaderMenuItemMain">Export project…</span>
                <span className="HeaderMenuItemHint">Inline or preserve \input</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                disabled={fileCount === 0}
                onClick={() => {
                  onCloseMenu();
                  onDownloadProjectZip();
                }}
              >
                <span className="HeaderMenuItemMain">Download project ZIP</span>
                <span className="HeaderMenuItemHint">{fileCount} files</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem"
                disabled={!selectedFile}
                onClick={() => {
                  onCloseMenu();
                  onDownloadActiveFile();
                }}
              >
                <span className="HeaderMenuItemMain">Download current file</span>
                <span className="HeaderMenuItemHint">{selectedFile || 'None'}</span>
              </button>

              <div className="HeaderMenuDivider" role="separator" />

              <button
                type="button"
                role="menuitem"
                className="HeaderMenuItem HeaderMenuItem--danger"
                disabled={fileCount === 0}
                onClick={() => {
                  onCloseMenu();
                  onResetWorkspace();
                }}
              >
                <span className="HeaderMenuItemMain">Clear workspace</span>
                <span className="HeaderMenuItemHint">Remove all files</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="HeaderMenuAnchor">
          <button
            type="button"
            className={`HeaderMenuButton HeaderMenuButton--views${openMenu === 'views' ? ' is-open' : ''}`}
            onClick={() => onToggleMenu('views')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'views'}
            aria-label="Views"
          >
            <span>Views</span>
            <span className="HeaderActiveViewBadge">{activeDescriptor?.shortLabel ?? activeView}</span>
            <span className="HeaderCaret" aria-hidden="true">▾</span>
          </button>

          {openMenu === 'views' ? (
            <div className="ViewsDrawer" role="menu" aria-label="Views drawer">
              <div className="ViewsDrawerHeader">Workspace Views</div>
              <div className="ViewsDrawerList">
                {views.map((view) => {
                  const isActive = activeView === view.id;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`ViewsDrawerItem${isActive ? ' is-active' : ''}`}
                      onClick={() => onSelectView(view.id)}
                    >
                      <span className="ViewsDrawerIcon" aria-hidden="true">{view.icon}</span>
                      <span className="ViewsDrawerText">
                        <span className="ViewsDrawerTitleRow">
                          <span className="ViewsDrawerTitle">{view.label}</span>
                          {view.badge !== null && view.badge !== undefined ? (
                            <span className={`ViewsBadge ViewsBadge--${view.tone ?? 'default'}`}>
                              {view.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="ViewsDrawerDesc">{view.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="WorkspaceQuickTabs" aria-label="Workspace views">
        {quickTabs.map((view) => {
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              className={`QuickViewTab${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectView(view.id)}
            >
              <span>{view.shortLabel}</span>
              {view.badge !== null && view.badge !== undefined ? (
                <span className={`ViewsBadge ViewsBadge--${view.tone ?? 'default'}`}>{view.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="WorkspaceHeaderGroup WorkspaceHeaderRight">
        <div className="HeaderHistoryGroup" role="group" aria-label="Transformation history">
          <button
            type="button"
            className="HeaderIconButton"
            onClick={onGoBack}
            disabled={!canGoBack}
            aria-label={backLabel ? `Undo: ${backLabel}` : 'Undo transformation'}
            title={backLabel ? `Undo: ${backLabel}` : 'Nothing to undo'}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="HeaderIconButton"
            onClick={onGoForward}
            disabled={!canGoForward}
            aria-label={forwardLabel ? `Redo: ${forwardLabel}` : 'Redo transformation'}
            title={forwardLabel ? `Redo: ${forwardLabel}` : 'Nothing to redo'}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <button
          type="button"
          className={`HeaderIconButton HeaderSplitButton${splitEnabled ? ' is-active' : ''}`}
          onClick={onToggleSplit}
          aria-pressed={splitEnabled}
          aria-label="Split side-by-side view"
          title="Toggle side-by-side Code companion view"
        >
          <span aria-hidden="true">◫</span>
          <span className="HeaderButtonText">Split</span>
        </button>

        <button
          type="button"
          className={`HeaderStatusPill HeaderStatusPill--${statusTone}`}
          onClick={() => onSelectView(viewStatus === 'blocked' ? 'ast' : 'settings')}
          title={
            viewStatus === 'blocked'
              ? 'Open AST View to resolve conditional branches'
              : 'Open project settings'
          }
        >
          <span className="HeaderStatusDot" aria-hidden="true" />
          <span className="HeaderStatusLabel">{statusText}</span>
        </button>
      </div>
    </header>
  );
}
