import type { GeneratedArtifact, ProjectFilePath } from '@preptex/core';
import type { FilesMap } from '../types/files';

/**
 * Normalizes a user-supplied virtual output folder path (`out`, `build/clean`).
 * Returns `''` when omitted, or `null` if the path contains invalid traversal segments.
 */
export function normalizeOutputFolder(raw: string): string | null {
  const normalized = raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  const segments = normalized.split('/');
  if (segments.some((seg) => !seg || seg === '.' || seg === '..')) {
    return null;
  }
  return normalized;
}

function buildSiblingPath(
  path: ProjectFilePath,
  taken: ReadonlySet<string>,
): ProjectFilePath {
  const slashIdx = path.lastIndexOf('/');
  const dir = slashIdx >= 0 ? path.slice(0, slashIdx + 1) : '';
  const base = slashIdx >= 0 ? path.slice(slashIdx + 1) : path;
  const dotIdx = base.lastIndexOf('.');
  const stem = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  const ext = dotIdx > 0 ? base.slice(dotIdx) : '.tex';

  let candidate = `${dir}${stem}.transformed${ext}`;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${dir}${stem}.transformed-${counter}${ext}`;
    counter += 1;
  }
  return candidate;
}

export interface BuildNewFileOutputsArgs {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly existingFiles: FilesMap;
  readonly changedPaths?: ReadonlySet<string>;
  readonly entryPath?: ProjectFilePath | null;
  readonly outputFolder: string;
}

export interface BuildNewFileOutputsResult {
  readonly files: FilesMap;
  readonly primaryPath: ProjectFilePath | null;
}

/**
 * Maps generated artifacts into new virtual workspace paths, either inside a
 * target subfolder (preserving relative project structure) or as sibling
 * `*.transformed.tex` files when no folder is provided.
 */
export function buildNewFileOutputs({
  artifacts,
  existingFiles,
  changedPaths,
  entryPath,
  outputFolder,
}: BuildNewFileOutputsArgs): BuildNewFileOutputsResult {
  if (artifacts.length === 0) {
    return { files: {}, primaryPath: null };
  }

  const folder = normalizeOutputFolder(outputFolder);
  if (folder === null) {
    return { files: {}, primaryPath: null };
  }

  const out: Record<string, string> = {};
  let primaryPath: ProjectFilePath | null = null;

  if (folder.length > 0) {
    for (const art of artifacts) {
      const targetPath = `${folder}/${art.path}`;
      out[targetPath] = art.source;
      if (entryPath && art.path === entryPath) {
        primaryPath = targetPath;
      }
      if (!primaryPath) {
        primaryPath = targetPath;
      }
    }
    return { files: out, primaryPath };
  }

  // No folder specified: emit transformed sibling files for changed/single artifacts
  const selected =
    artifacts.length === 1
      ? artifacts
      : changedPaths && changedPaths.size > 0
      ? artifacts.filter((art) => changedPaths.has(art.path))
      : artifacts;
  const effectiveArtifacts = selected.length > 0 ? selected : artifacts.slice(0, 1);

  const taken = new Set(Object.keys(existingFiles));
  for (const art of effectiveArtifacts) {
    const targetPath = buildSiblingPath(art.path, taken);
    taken.add(targetPath);
    out[targetPath] = art.source;
    if (entryPath && art.path === entryPath) {
      primaryPath = targetPath;
    }
    if (!primaryPath) {
      primaryPath = targetPath;
    }
  }

  return { files: out, primaryPath };
}
