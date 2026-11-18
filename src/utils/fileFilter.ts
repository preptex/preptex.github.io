export const RELEVANT_TEX_EXTENSIONS: ReadonlySet<string> = new Set([
  '.tex',
  '.ltx',
  '.sty',
  '.cls',
  '.clo',
  '.def',
  '.cfg',
  '.fd',
  '.dtx',
  '.ins',
  '.bib',
  '.bst',
  '.bbx',
  '.cbx',
  '.lbx',
  '.tikz',
  '.pgf',
]);

export const IGNORED_FOLDER_SEGMENTS: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  '__macosx',
  '.ds_store',
]);

export function getFileExtension(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  const baseName = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
  const dotIdx = baseName.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === baseName.length - 1) return '';
  return baseName.slice(dotIdx).toLowerCase();
}

export function isRelevantProjectFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^(?:\.\/|\/)+/, '');
  if (!normalized) return false;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  for (const segment of segments) {
    if (IGNORED_FOLDER_SEGMENTS.has(segment.toLowerCase())) {
      return false;
    }
  }

  const ext = getFileExtension(normalized);
  return RELEVANT_TEX_EXTENSIONS.has(ext);
}

export interface FilteredUploadBatch<T> {
  readonly accepted: readonly T[];
  readonly skippedCount: number;
  readonly skippedPaths: readonly string[];
}

export function filterUploadedBatch<T>(
  items: readonly T[],
  getPath: (item: T) => string,
): FilteredUploadBatch<T> {
  const accepted: T[] = [];
  const skippedPaths: string[] = [];

  for (const item of items) {
    const path = getPath(item);
    if (isRelevantProjectFile(path)) {
      accepted.push(item);
    } else {
      skippedPaths.push(path);
    }
  }

  return {
    accepted,
    skippedCount: skippedPaths.length,
    skippedPaths,
  };
}
