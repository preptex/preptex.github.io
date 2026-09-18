import { useCallback, useEffect, useState } from 'react';
import type { ConditionPolicy, ProjectFilePath } from '@preptex/core';
import type { FilesMap } from '../types/files';

export interface ProjectConfigurationState {
  readonly entryPath: ProjectFilePath | null;
  readonly traversal: 'project' | 'file-only';
  readonly conditionPolicy: ConditionPolicy;
  readonly revision: number;
}

export const DEFAULT_CONFIGURATION: ProjectConfigurationState = {
  entryPath: null,
  traversal: 'project',
  conditionPolicy: { mode: 'source' },
  revision: 1,
};

export function recommendEntry(files: FilesMap): ProjectFilePath | null {
  const paths = Object.keys(files);
  if (paths.length === 0) return null;
  if (paths.includes('main.tex')) return 'main.tex';
  const texFiles = paths.filter((p) => p.endsWith('.tex'));
  return texFiles[0] ?? paths[0] ?? null;
}

export function useProjectConfiguration(
  files?: FilesMap,
  initial: Partial<ProjectConfigurationState> = {},
) {
  const [state, setState] = useState<ProjectConfigurationState>({
    ...DEFAULT_CONFIGURATION,
    ...initial,
  });

  const setEntryPath = useCallback((entryPath: ProjectFilePath | null) => {
    setState((prev) => ({
      ...prev,
      entryPath,
      revision: prev.revision + 1,
    }));
  }, []);

  const setTraversal = useCallback((traversal: 'project' | 'file-only') => {
    setState((prev) => ({
      ...prev,
      traversal,
      revision: prev.revision + 1,
    }));
  }, []);

  const setConditionPolicy = useCallback((conditionPolicy: ConditionPolicy) => {
    setState((prev) => ({
      ...prev,
      conditionPolicy,
      revision: prev.revision + 1,
    }));
  }, []);

  const commitConfiguration = useCallback((
    update: Partial<Omit<ProjectConfigurationState, 'revision'>>,
  ) => {
    setState((prev) => ({
      ...prev,
      ...update,
      revision: prev.revision + 1,
    }));
  }, []);

  const syncWithFiles = useCallback((targetFiles: FilesMap) => {
    setState((prev) => {
      // If no files remain, reset entry
      if (Object.keys(targetFiles).length === 0) {
        if (prev.entryPath === null) return prev;
        return { ...prev, entryPath: null, revision: prev.revision + 1 };
      }
      // If entry was deleted, clear it to null (do not silently switch to another file)
      if (prev.entryPath !== null && !Object.prototype.hasOwnProperty.call(targetFiles, prev.entryPath)) {
        return { ...prev, entryPath: null, revision: prev.revision + 1 };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (files !== undefined) {
      syncWithFiles(files);
    }
  }, [files, syncWithFiles]);

  const resetConfiguration = useCallback(() => {
    setState({ ...DEFAULT_CONFIGURATION });
  }, []);

  return {
    ...state,
    setEntryPath,
    setTraversal,
    setConditionPolicy,
    commitConfiguration,
    syncWithFiles,
    resetConfiguration,
  } as const;
}
