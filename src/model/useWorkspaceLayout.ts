import { useCallback, useState } from 'react';

export type WorkspaceViewId =
  | 'code'
  | 'ast'
  | 'transformations'
  | 'catalog'
  | 'metadata'
  | 'diagnostics'
  | 'diff'
  | 'settings';

export type WorkspaceMenuId = 'file' | 'edit' | 'views' | null;

export interface WorkspaceLayoutState {
  readonly activeView: WorkspaceViewId;
  readonly previousView: WorkspaceViewId;
  readonly splitEnabled: boolean;
  readonly sidebarCollapsed: boolean;
  readonly openMenu: WorkspaceMenuId;
}

export function useWorkspaceLayout(initialView: WorkspaceViewId = 'code') {
  const [state, setState] = useState<WorkspaceLayoutState>({
    activeView: initialView,
    previousView: initialView,
    splitEnabled: false,
    sidebarCollapsed: false,
    openMenu: null,
  });

  const selectView = useCallback((view: WorkspaceViewId) => {
    setState((prev) => ({
      ...prev,
      previousView: prev.activeView !== 'diff' ? prev.activeView : prev.previousView,
      activeView: view,
      openMenu: null,
    }));
  }, []);

  const returnFromDiff = useCallback((fallback: WorkspaceViewId = 'code') => {
    setState((prev) => ({
      ...prev,
      activeView: prev.previousView === 'diff' ? fallback : prev.previousView,
      openMenu: null,
    }));
  }, []);

  const toggleSplit = useCallback(() => {
    setState((prev) => ({ ...prev, splitEnabled: !prev.splitEnabled, openMenu: null }));
  }, []);

  const setSplitEnabled = useCallback((splitEnabled: boolean) => {
    setState((prev) => ({ ...prev, splitEnabled }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setState((prev) => ({ ...prev, sidebarCollapsed }));
  }, []);

  const setOpenMenu = useCallback((openMenu: WorkspaceMenuId) => {
    setState((prev) => ({ ...prev, openMenu }));
  }, []);

  const toggleMenu = useCallback((menu: Exclude<WorkspaceMenuId, null>) => {
    setState((prev) => ({ ...prev, openMenu: prev.openMenu === menu ? null : menu }));
  }, []);

  return {
    ...state,
    selectView,
    returnFromDiff,
    toggleSplit,
    setSplitEnabled,
    toggleSidebar,
    setSidebarCollapsed,
    setOpenMenu,
    toggleMenu,
  } as const;
}
