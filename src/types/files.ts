import type { ProjectFilePath } from '@preptex/core';

/** Immutable source buffers, keyed by forward-slash virtual project paths. */
export type FilesMap = Readonly<Record<ProjectFilePath, string>>;
