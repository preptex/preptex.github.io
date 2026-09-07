import type { GeneratedArtifact } from '@preptex/core';

export interface UIArtifactItem {
  readonly id: string;
  readonly path: string;
  readonly source: string;
  readonly timestamp: number;
  readonly topology?: GeneratedArtifact['topology'];
  readonly remainingInputs?: readonly string[];
}
