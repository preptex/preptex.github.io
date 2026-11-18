import { useCallback, useMemo, useReducer } from 'react';
import type { ProjectFilePath } from '@preptex/core';
import type { FilesMap } from '../types/files';
import { filterUploadedBatch } from '../utils/fileFilter';

export interface FileHistoryEntry {
  readonly filesByName: FilesMap;
  readonly selectedFile: ProjectFilePath;
  readonly label: string;
}

export interface FilesState {
  readonly filesByName: FilesMap;
  readonly fileVersions: Readonly<Record<ProjectFilePath, number>>;
  readonly sourceRevision: number;
  readonly selectedFile: ProjectFilePath;
  readonly uploadError: string | null;
  readonly uploadNotice: string | null;
  readonly past: readonly FileHistoryEntry[];
  readonly future: readonly FileHistoryEntry[];
}

export interface UpsertTextOptions {
  readonly recordHistory?: boolean;
  readonly label?: string;
}

export interface UpsertFilesOptions {
  readonly filterExtensions?: boolean;
}

const MAX_HISTORY_ENTRIES = 50;

type FilesAction =
  | { readonly type: 'select'; readonly path: ProjectFilePath }
  | {
      readonly type: 'upsert';
      readonly files: FilesMap;
      readonly recordHistory?: boolean;
      readonly label?: string;
      readonly notice?: string | null;
    }
  | { readonly type: 'remove'; readonly path: ProjectFilePath }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'reset' }
  | { readonly type: 'upload-error'; readonly message: string }
  | { readonly type: 'clear-upload-notice' };

export function normalizeUploadedBatch(incoming: FilesMap, existing: FilesMap): FilesMap {
  const cleanedEntries: [string, string][] = [];
  for (const [rawPath, source] of Object.entries(incoming)) {
    const normalized = rawPath.replace(/\\/g, '/').replace(/^(?:\.\/|\/)+/, '');
    if (normalized) cleanedEntries.push([normalized, source]);
  }
  if (cleanedEntries.length === 0) return {};

  const existingKeys = Object.keys(existing);
  if (existingKeys.length === 0 && cleanedEntries.length > 1) {
    const firstSegments = cleanedEntries.map(([p]) => {
      const idx = p.indexOf('/');
      return idx > 0 ? p.slice(0, idx) : '';
    });
    const sharedRoot = firstSegments[0];
    if (sharedRoot && firstSegments.every((seg) => seg === sharedRoot)) {
      const prefixLen = sharedRoot.length + 1;
      return Object.fromEntries(
        cleanedEntries.map(([p, src]) => [p.slice(prefixLen), src]),
      );
    }
  }

  return Object.fromEntries(cleanedEntries);
}

function restoreSnapshot(
  state: FilesState,
  target: FileHistoryEntry,
  nextPast: readonly FileHistoryEntry[],
  nextFuture: readonly FileHistoryEntry[],
): FilesState {
  const nextFileVersions: Record<ProjectFilePath, number> = {};
  for (const [path, src] of Object.entries(target.filesByName)) {
    const prevVersion = state.fileVersions[path] ?? 0;
    const changed = state.filesByName[path] !== src;
    nextFileVersions[path] = changed ? prevVersion + 1 : Math.max(1, prevVersion);
  }
  const hasSelected = Object.prototype.hasOwnProperty.call(target.filesByName, target.selectedFile);
  const selectedFile = hasSelected
    ? target.selectedFile
    : Object.prototype.hasOwnProperty.call(target.filesByName, state.selectedFile)
    ? state.selectedFile
    : Object.keys(target.filesByName)[0] ?? '';

  return {
    filesByName: { ...target.filesByName },
    fileVersions: nextFileVersions,
    sourceRevision: state.sourceRevision + 1,
    selectedFile,
    uploadError: null,
    uploadNotice: null,
    past: nextPast,
    future: nextFuture,
  };
}

function filesReducer(state: FilesState, action: FilesAction): FilesState {
  switch (action.type) {
    case 'select':
      return Object.prototype.hasOwnProperty.call(state.filesByName, action.path)
        ? { ...state, selectedFile: action.path }
        : state;
    case 'upsert': {
      const changed = Object.entries(action.files).filter(
        ([path, src]) => state.filesByName[path] !== src,
      );
      if (changed.length === 0 && Object.keys(action.files).length > 0) {
        return action.notice !== undefined
          ? { ...state, uploadError: null, uploadNotice: action.notice }
          : state;
      }
      const filesByName = { ...state.filesByName, ...action.files };
      const nextFileVersions = { ...state.fileVersions };
      for (const [path] of changed) {
        nextFileVersions[path] = (nextFileVersions[path] ?? 0) + 1;
      }
      const shouldRecord = Boolean(action.recordHistory && changed.length > 0);
      const past = shouldRecord
        ? [
            ...state.past.slice(-(MAX_HISTORY_ENTRIES - 1)),
            {
              filesByName: state.filesByName,
              selectedFile: state.selectedFile,
              label: action.label ?? 'Edit files',
            },
          ]
        : state.past;
      const future = shouldRecord ? [] : state.future;
      return {
        filesByName,
        fileVersions: nextFileVersions,
        sourceRevision: state.sourceRevision + 1,
        selectedFile: state.selectedFile || Object.keys(filesByName)[0] || '',
        uploadError: null,
        uploadNotice: action.notice ?? null,
        past,
        future,
      };
    }
    case 'remove': {
      if (!Object.prototype.hasOwnProperty.call(state.filesByName, action.path)) {
        return state;
      }
      const filesByName = Object.fromEntries(
        Object.entries(state.filesByName).filter(([path]) => path !== action.path),
      );
      const nextFileVersions = Object.fromEntries(
        Object.entries(state.fileVersions).filter(([path]) => path !== action.path),
      );
      return {
        filesByName,
        fileVersions: nextFileVersions,
        sourceRevision: state.sourceRevision + 1,
        selectedFile:
          state.selectedFile === action.path
            ? Object.keys(filesByName)[0] ?? ''
            : state.selectedFile,
        uploadError: null,
        uploadNotice: null,
        past: state.past,
        future: state.future,
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const prevEntry = state.past[state.past.length - 1];
      if (!prevEntry) return state;
      const redoEntry: FileHistoryEntry = {
        filesByName: state.filesByName,
        selectedFile: state.selectedFile,
        label: prevEntry.label,
      };
      return restoreSnapshot(
        state,
        prevEntry,
        state.past.slice(0, -1),
        [redoEntry, ...state.future],
      );
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const nextEntry = state.future[0];
      if (!nextEntry) return state;
      const undoEntry: FileHistoryEntry = {
        filesByName: state.filesByName,
        selectedFile: state.selectedFile,
        label: nextEntry.label,
      };
      return restoreSnapshot(
        state,
        nextEntry,
        [...state.past.slice(-(MAX_HISTORY_ENTRIES - 1)), undoEntry],
        state.future.slice(1),
      );
    }
    case 'reset':
      return {
        filesByName: {},
        fileVersions: {},
        sourceRevision: state.sourceRevision + 1,
        selectedFile: '',
        uploadError: null,
        uploadNotice: null,
        past: [],
        future: [],
      };
    case 'upload-error':
      return { ...state, uploadError: action.message, uploadNotice: null };
    case 'clear-upload-notice':
      return { ...state, uploadNotice: null };
  }
}

function readTextFile(file: File, overridePath?: string): Promise<readonly [ProjectFilePath, string]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read ' + file.name + '.'));
    reader.onabort = () => reject(new Error('Reading ' + file.name + ' was cancelled.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read ' + file.name + ' as text.'));
        return;
      }
      const path = (overridePath || file.webkitRelativePath || file.name).replace(/\\/g, '/');
      resolve([path, reader.result]);
    };
    reader.readAsText(file);
  });
}

export function useFiles(initial: FilesMap = {}) {
  const [state, dispatch] = useReducer(filesReducer, initial, (files): FilesState => {
    const fileVersions: Record<ProjectFilePath, number> = {};
    for (const path of Object.keys(files)) {
      fileVersions[path] = 1;
    }
    return {
      filesByName: { ...files },
      fileVersions,
      sourceRevision: 1,
      selectedFile: Object.keys(files)[0] ?? '',
      uploadError: null,
      uploadNotice: null,
      past: [],
      future: [],
    };
  });

  const fileNames = useMemo(() => Object.keys(state.filesByName), [state.filesByName]);
  const selectFile = useCallback((path: ProjectFilePath) => dispatch({ type: 'select', path }), []);
  const removeFile = useCallback((path: ProjectFilePath) => dispatch({ type: 'remove', path }), []);
  const resetFiles = useCallback(() => dispatch({ type: 'reset' }), []);
  const goBack = useCallback(() => dispatch({ type: 'undo' }), []);
  const goForward = useCallback(() => dispatch({ type: 'redo' }), []);
  const clearUploadNotice = useCallback(() => dispatch({ type: 'clear-upload-notice' }), []);

  const upsertTextFiles = useCallback((files: FilesMap, options?: UpsertTextOptions) => {
    dispatch({
      type: 'upsert',
      files,
      recordHistory: options?.recordHistory,
      label: options?.label,
    });
  }, []);

  const upsertFiles = useCallback(
    async (fileList: FileList | readonly File[], options?: UpsertFilesOptions): Promise<void> => {
      try {
        const rawFiles = Array.from(fileList);
        const shouldFilter =
          Boolean(options?.filterExtensions) ||
          rawFiles.some((f) => Boolean(f.webkitRelativePath && f.webkitRelativePath.includes('/')));

        let filesToRead: readonly File[] = rawFiles;
        let notice: string | null = null;
        if (shouldFilter && rawFiles.length > 0) {
          const filtered = filterUploadedBatch(
            rawFiles,
            (f) => (f.webkitRelativePath || f.name).replace(/\\/g, '/'),
          );
          filesToRead = filtered.accepted;
          if (filesToRead.length === 0) {
            dispatch({
              type: 'upload-error',
              message:
                'No supported TeX files (.tex, .cls, .sty, .bib, ...) found in the selected folder.',
            });
            return;
          }
          if (filtered.skippedCount > 0) {
            notice = `Imported ${filesToRead.length} TeX project file${filesToRead.length === 1 ? '' : 's'} (skipped ${filtered.skippedCount} non-TeX file${filtered.skippedCount === 1 ? '' : 's'}).`;
          }
        }

        const entries = await Promise.all(filesToRead.map((f) => readTextFile(f)));
        const normalized = normalizeUploadedBatch(Object.fromEntries(entries), state.filesByName);
        dispatch({ type: 'upsert', files: normalized, notice });
      } catch (error: unknown) {
        dispatch({
          type: 'upload-error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [state.filesByName],
  );

  const upsertFileItems = useCallback(
    async (
      items: ReadonlyArray<{
        readonly file: File;
        readonly relativePath: string;
        readonly fromDirectory?: boolean;
      }>,
    ): Promise<void> => {
      try {
        const dirItems = items.filter((item) => item.fromDirectory);
        const directItems = items.filter((item) => !item.fromDirectory);
        let itemsToRead = items;
        let notice: string | null = null;

        if (dirItems.length > 0) {
          const filtered = filterUploadedBatch(dirItems, (item) => item.relativePath);
          itemsToRead = [...directItems, ...filtered.accepted];
          if (itemsToRead.length === 0) {
            dispatch({
              type: 'upload-error',
              message:
                'No supported TeX files (.tex, .cls, .sty, .bib, ...) found in the dropped folder.',
            });
            return;
          }
          if (filtered.skippedCount > 0) {
            notice = `Imported ${itemsToRead.length} TeX project file${itemsToRead.length === 1 ? '' : 's'} (skipped ${filtered.skippedCount} non-TeX file${filtered.skippedCount === 1 ? '' : 's'}).`;
          }
        }

        const entries = await Promise.all(
          itemsToRead.map(({ file, relativePath }) => readTextFile(file, relativePath)),
        );
        const normalized = normalizeUploadedBatch(Object.fromEntries(entries), state.filesByName);
        dispatch({ type: 'upsert', files: normalized, notice });
      } catch (error: unknown) {
        dispatch({
          type: 'upload-error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [state.filesByName],
  );

  return {
    ...state,
    fileNames,
    canGoBack: state.past.length > 0,
    canGoForward: state.future.length > 0,
    backLabel: state.past[state.past.length - 1]?.label ?? null,
    forwardLabel: state.future[0]?.label ?? null,
    selectFile,
    upsertFiles,
    upsertFileItems,
    upsertTextFiles,
    removeFile,
    resetFiles,
    clearUploadNotice,
    goBack,
    goForward,
  } as const;
}
