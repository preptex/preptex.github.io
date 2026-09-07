import type { ProjectFilePath } from '@preptex/core';

/** Immutable source buffers, keyed by forward-slash virtual project paths. */
export type FilesMap = Readonly<Record<ProjectFilePath, string>>;

/** Tagged viewed item identity to distinguish source files from generated artifacts */
export type ViewedItem =
  | { readonly kind: 'source'; readonly path: ProjectFilePath }
  | { readonly kind: 'artifact'; readonly artifactId: string; readonly path: ProjectFilePath };
