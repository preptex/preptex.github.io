import { useCallback, useState } from 'react';
import type { UIArtifactItem } from '../types/artifacts';

export interface UseArtifactsResult {
  readonly artifacts: readonly UIArtifactItem[];
  readonly addArtifacts: (newItems: readonly {
    readonly path: string;
    readonly source: string;
    readonly topology?: UIArtifactItem['topology'];
    readonly remainingInputs?: readonly string[];
  }[]) => readonly UIArtifactItem[];
  readonly removeArtifact: (id: string) => void;
  readonly clearArtifacts: () => void;
  readonly getArtifact: (id: string) => UIArtifactItem | undefined;
}

let artifactCounter = 0;

export function useArtifacts(initial: readonly UIArtifactItem[] = []): UseArtifactsResult {
  const [artifacts, setArtifacts] = useState<readonly UIArtifactItem[]>(initial);

  const addArtifacts = useCallback((
    newItems: readonly {
      readonly path: string;
      readonly source: string;
      readonly topology?: UIArtifactItem['topology'];
      readonly remainingInputs?: readonly string[];
    }[],
  ): readonly UIArtifactItem[] => {
    const timestamp = Date.now();
    const created: readonly UIArtifactItem[] = newItems.map((item) => ({
      ...item,
      id: 'artifact-' + (++artifactCounter) + '-' + timestamp,
      timestamp,
    }));
    setArtifacts((prev) => [...prev, ...created]);
    return created;
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearArtifacts = useCallback(() => {
    setArtifacts([]);
  }, []);

  const getArtifact = useCallback((id: string) => {
    return artifacts.find((a) => a.id === id);
  }, [artifacts]);

  return {
    artifacts,
    addArtifacts,
    removeArtifact,
    clearArtifacts,
    getArtifact,
  };
}
