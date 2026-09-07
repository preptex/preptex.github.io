import { useMemo } from 'react';
import type { ProjectView, ProjectSourceIndex, SourceLookupHit } from '@preptex/core';
import { createProjectSourceIndexAdapter, lookupProjectSourceAdapter } from '../services/core';

export function useSourceIndex(view: ProjectView | null) {
  const index = useMemo<ProjectSourceIndex | null>(() => {
    if (!view || view.status !== 'ready') return null;
    try {
      return createProjectSourceIndexAdapter(view);
    } catch {
      return null;
    }
  }, [view]);

  const lookup = useMemo(() => {
    return (path: string, offset: number): readonly SourceLookupHit[] => {
      if (!index) return [];
      try {
        return lookupProjectSourceAdapter(index, { path, start: offset });
      } catch {
        return [];
      }
    };
  }, [index]);

  return { index, lookup };
}
