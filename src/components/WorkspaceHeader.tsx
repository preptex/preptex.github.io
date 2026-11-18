import type { ConditionPolicy } from '@preptex/core';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
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
  readonly onDownloadProjectZip: () => void;
  readonly onDownloadActiveFile: () => void;
  readonly onResetWorkspace: () => void;
}

const MENUBAR_ORDER: readonly Exclude<WorkspaceMenuId, null>[] = ['file', 'edit', 'views'];

function PrepTeXBrandLogo() {
  return (
    <svg
      className="HeaderLogoSvg"
      viewBox="0 0 36 36"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="33" height="33" rx="8" fill="#EFF6FF" stroke="#BFDBFE" />
      <text
        x="4.5"
        y="25"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="21"
        fontWeight="800"
        fill="#2563EB"
      >
        {'{}'}
      </text>
      <circle cx="26.5" cy="26.5" r="7" fill="#16A34A" stroke="#FFFFFF" strokeWidth="1.5" />
      <path
        d="M23.5 26.7 L25.6 28.8 L29.7 24.7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  onDownloadProjectZip,
  onDownloadActiveFile,
  onResetWorkspace,
}: WorkspaceHeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef<Record<Exclude<WorkspaceMenuId, null>, HTMLButtonElement | null>>({
    file: null,
    edit: null,
    views: null,
  });
  const menuRefs = useRef<Record<Exclude<WorkspaceMenuId, null>, HTMLDivElement | null>>({
    file: null,
    edit: null,
    views: null,
  });
  const [focusedMenuTab, setFocusedMenuTab] = useState<Exclude<WorkspaceMenuId, null>>('file');

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        const trigger = triggerRefs.current[openMenu];
        onCloseMenu();
        trigger?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, onCloseMenu]);

  const getEnabledMenuItems = (menuId: Exclude<WorkspaceMenuId, null>): HTMLButtonElement[] => {
    const container = menuRefs.current[menuId];
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      (btn) => !btn.disabled && btn.getAttribute('aria-disabled') !== 'true',
    );
  };

  const focusMenuItem = (menuId: Exclude<WorkspaceMenuId, null>, index: number) => {
    const items = getEnabledMenuItems(menuId);
    if (items.length === 0) return;
    const bounded = ((index % items.length) + items.length) % items.length;
    items[bounded]?.focus();
  };

  const switchTopMenu = (current: Exclude<WorkspaceMenuId, null>, delta: -1 | 1, reopen: boolean) => {
    const idx = MENUBAR_ORDER.indexOf(current);
    const next = MENUBAR_ORDER[(idx + delta + MENUBAR_ORDER.length) % MENUBAR_ORDER.length]!;
    setFocusedMenuTab(next);
    if (reopen && openMenu !== next) {
      onToggleMenu(next);
    }
    window.requestAnimationFrame(() => {
      triggerRefs.current[next]?.focus();
    });
  };

  const handleTriggerKeyDown = (
    menuId: Exclude<WorkspaceMenuId, null>,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      switchTopMenu(menuId, 1, openMenu !== null);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      switchTopMenu(menuId, -1, openMenu !== null);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (openMenu !== menuId) {
        setFocusedMenuTab(menuId);
        onToggleMenu(menuId);
      }
      window.requestAnimationFrame(() => focusMenuItem(menuId, 0));
    }
  };

  const handleMenuKeyDown = (
    menuId: Exclude<WorkspaceMenuId, null>,
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const items = getEnabledMenuItems(menuId);
    const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(menuId, currentIdx < 0 ? 0 : currentIdx + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(menuId, currentIdx < 0 ? items.length - 1 : currentIdx - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(menuId, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(menuId, items.length - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      switchTopMenu(menuId, 1, true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      switchTopMenu(menuId, -1, true);
    }
  };

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
      icon: '§',
      tone: viewStatus === 'blocked' ? 'warning' : 'default',
      badge: viewStatus === 'blocked' ? 'Setup' : null,
    },
    {
      id: 'transformations',
      label: 'Transformations',
      shortLabel: 'Transforms',
      description: 'Modify code in place or output new files',
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
      description: 'Project issues, reference & command checks',
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
      description: 'Entry file, \\input mode, conditions & signatures',
      icon: '⚙',
    },
  ];

  const activeDescriptor = views.find((v) => v.id === activeView) ?? views[0];

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
        <div className="HeaderBrandGroup">
          <PrepTeXBrandLogo />
          <span className="HeaderBrand">PrepTeX</span>
        </div>

        <div className="HeaderMenubar" role="menubar" aria-label="Application menu">
          {/* File menu */}
          <div className="HeaderMenuAnchor">
            <button
              ref={(el) => {
                triggerRefs.current.file = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={focusedMenuTab === 'file' ? 0 : -1}
              className={`HeaderMenubarTrigger${openMenu === 'file' ? ' is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'file'}
              onClick={() => {
                setFocusedMenuTab('file');
                onToggleMenu('file');
              }}
              onPointerEnter={() => {
                if (openMenu && openMenu !== 'file') {
                  setFocusedMenuTab('file');
                  onToggleMenu('file');
                }
              }}
              onKeyDown={(e) => handleTriggerKeyDown('file', e)}
            >
              <span>File</span>
            </button>

            {openMenu === 'file' ? (
              <div
                ref={(el) => {
                  menuRefs.current.file = el;
                }}
                className="HeaderDropdown"
                role="menu"
                aria-label="File menu"
                onKeyDown={(e) => handleMenuKeyDown('file', e)}
              >
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
                  <span className="HeaderMenuItemHint">Filter TeX files</span>
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
                  <span className="HeaderMenuItemHint">Root or subfolder</span>
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
                  <span className="HeaderMenuItemHint">Sample project</span>
                </button>

                <hr className="HeaderMenuDivider" />

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

                <hr className="HeaderMenuSeparator" />

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
                  <span className="HeaderMenuItemHint">Remove all</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Edit menu (contains Undo/Redo arrows & editing views) */}
          <div className="HeaderMenuAnchor">
            <button
              ref={(el) => {
                triggerRefs.current.edit = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={focusedMenuTab === 'edit' ? 0 : -1}
              className={`HeaderMenubarTrigger${openMenu === 'edit' ? ' is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'edit'}
              aria-label="Edit"
              onClick={() => {
                setFocusedMenuTab('edit');
                onToggleMenu('edit');
              }}
              onPointerEnter={() => {
                if (openMenu && openMenu !== 'edit') {
                  setFocusedMenuTab('edit');
                  onToggleMenu('edit');
                }
              }}
              onKeyDown={(e) => handleTriggerKeyDown('edit', e)}
            >
              <span>Edit</span>
              {canGoBack ? <span className="HeaderDotIndicator" aria-hidden="true" /> : null}
            </button>

            {openMenu === 'edit' ? (
              <div
                ref={(el) => {
                  menuRefs.current.edit = el;
                }}
                className="HeaderDropdown"
                role="menu"
                aria-label="Edit menu"
                onKeyDown={(e) => handleMenuKeyDown('edit', e)}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="HeaderMenuItem"
                  disabled={!canGoBack}
                  aria-label={backLabel ? `Undo: ${backLabel}` : 'Undo transformation'}
                  onClick={() => {
                    onCloseMenu();
                    onGoBack();
                  }}
                >
                  <span className="HeaderMenuItemMain">
                    <span className="HeaderMenuArrow" aria-hidden="true">←</span> Undo
                  </span>
                  <span className="HeaderMenuItemHint">{backLabel || 'Nothing to undo'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="HeaderMenuItem"
                  disabled={!canGoForward}
                  aria-label={forwardLabel ? `Redo: ${forwardLabel}` : 'Redo transformation'}
                  onClick={() => {
                    onCloseMenu();
                    onGoForward();
                  }}
                >
                  <span className="HeaderMenuItemMain">
                    <span className="HeaderMenuArrow" aria-hidden="true">→</span> Redo
                  </span>
                  <span className="HeaderMenuItemHint">{forwardLabel || 'Nothing to redo'}</span>
                </button>

                <hr className="HeaderMenuSeparator" />

                <button
                  type="button"
                  role="menuitem"
                  className="HeaderMenuItem"
                  onClick={() => onSelectView('transformations')}
                >
                  <span className="HeaderMenuItemMain">Transformations…</span>
                  <span className="HeaderMenuItemHint">Modify or output files</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="HeaderMenuItem"
                  onClick={() => onSelectView('diff')}
                >
                  <span className="HeaderMenuItemMain">Diff Review…</span>
                  <span className="HeaderMenuItemHint">
                    {pendingDiffCount > 0 ? `${pendingDiffCount} pending` : 'Staged edits'}
                  </span>
                </button>

                <hr className="HeaderMenuSeparator" />

                <button
                  type="button"
                  role="menuitem"
                  className="HeaderMenuItem"
                  onClick={() => onSelectView('settings')}
                >
                  <span className="HeaderMenuItemMain">Project Settings…</span>
                  <span className="HeaderMenuItemHint">Entry &amp; rules</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* View menu (single unified drawer for all views + layout toggles) */}
          <div className="HeaderMenuAnchor">
            <button
              ref={(el) => {
                triggerRefs.current.views = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={focusedMenuTab === 'views' ? 0 : -1}
              className={`HeaderMenubarTrigger HeaderMenubarTrigger--view${
                openMenu === 'views' ? ' is-open' : ''
              }`}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'views'}
              aria-label="View"
              onClick={() => {
                setFocusedMenuTab('views');
                onToggleMenu('views');
              }}
              onPointerEnter={() => {
                if (openMenu && openMenu !== 'views') {
                  setFocusedMenuTab('views');
                  onToggleMenu('views');
                }
              }}
              onKeyDown={(e) => handleTriggerKeyDown('views', e)}
            >
              <span>View</span>
              <span className="HeaderActiveViewBadge">
                {activeDescriptor?.shortLabel ?? activeView}
              </span>
              <span className="HeaderCaret" aria-hidden="true">▾</span>
            </button>

            {openMenu === 'views' ? (
              <div
                ref={(el) => {
                  menuRefs.current.views = el;
                }}
                className="ViewsDrawer"
                role="menu"
                aria-label="Views drawer"
                onKeyDown={(e) => handleMenuKeyDown('views', e)}
              >
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

                <hr className="HeaderMenuSeparator" />

                <div className="ViewsDrawerLayoutGroup">
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={splitEnabled}
                    className="HeaderMenuItem HeaderMenuItem--check"
                    onClick={() => {
                      onToggleSplit();
                      onCloseMenu();
                    }}
                  >
                    <span className="HeaderMenuItemMain">Split Code Companion</span>
                    <span className="HeaderMenuItemHint">Side-by-side</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={!sidebarCollapsed}
                    className="HeaderMenuItem HeaderMenuItem--check"
                    onClick={() => {
                      onToggleSidebar();
                      onCloseMenu();
                    }}
                  >
                    <span className="HeaderMenuItemMain">File Explorer</span>
                    <span className="HeaderMenuItemHint">Left sidebar</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="WorkspaceHeaderGroup WorkspaceHeaderRight">
        {pendingDiffCount > 0 && activeView !== 'diff' ? (
          <button
            type="button"
            className="HeaderAlertPill HeaderAlertPill--accent"
            onClick={() => onSelectView('diff')}
          >
            {pendingDiffCount} pending {pendingDiffCount === 1 ? 'diff' : 'diffs'}
          </button>
        ) : null}

        {diagnosticCount > 0 && activeView !== 'diagnostics' ? (
          <button
            type="button"
            className="HeaderAlertPill HeaderAlertPill--warning"
            onClick={() => onSelectView('diagnostics')}
          >
            {diagnosticCount} diagnostic{diagnosticCount === 1 ? '' : 's'}
          </button>
        ) : null}

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
