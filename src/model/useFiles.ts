import { useCallback, useMemo, useReducer } from 'react';
import type { ProjectFilePath } from '@preptex/core';
import type { FilesMap } from '../types/files';

interface FilesState {
  readonly filesByName: FilesMap;
  readonly selectedFile: ProjectFilePath;
  readonly uploadError: string | null;
}

type FilesAction =
  | { readonly type: 'select'; readonly path: ProjectFilePath }
  | { readonly type: 'upsert'; readonly files: FilesMap }
  | { readonly type: 'remove'; readonly path: ProjectFilePath }
  | { readonly type: 'upload-error'; readonly message: string };

function filesReducer(state: FilesState, action: FilesAction): FilesState {
  switch (action.type) {
    case 'select':
      return Object.prototype.hasOwnProperty.call(state.filesByName, action.path)
        ? { ...state, selectedFile: action.path } : state;
    case 'upsert': {
      const filesByName = { ...state.filesByName, ...action.files };
      return {
        filesByName,
        selectedFile: state.selectedFile || Object.keys(filesByName)[0] || '',
        uploadError: null,
      };
    }
    case 'remove': {
      const filesByName = Object.fromEntries(
        Object.entries(state.filesByName).filter(([path]) => path !== action.path),
      );
      return {
        ...state,
        filesByName,
        selectedFile: state.selectedFile === action.path
          ? Object.keys(filesByName)[0] ?? '' : state.selectedFile,
      };
    }
    case 'upload-error':
      return { ...state, uploadError: action.message };
  }
}

function readTextFile(file: File): Promise<readonly [ProjectFilePath, string]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read ' + file.name + '.'));
    reader.onabort = () => reject(new Error('Reading ' + file.name + ' was cancelled.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read ' + file.name + ' as text.'));
        return;
      }
      const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
      resolve([path, reader.result]);
    };
    reader.readAsText(file);
  });
}

export function useFiles(initial: FilesMap = {}) {
  const [state, dispatch] = useReducer(filesReducer, initial, (files): FilesState => ({
    filesByName: { ...files }, selectedFile: Object.keys(files)[0] ?? '', uploadError: null,
  }));
  const fileNames = useMemo(() => Object.keys(state.filesByName), [state.filesByName]);
  const selectFile = useCallback((path: ProjectFilePath) => dispatch({ type: 'select', path }), []);
  const removeFile = useCallback((path: ProjectFilePath) => dispatch({ type: 'remove', path }), []);
  const upsertTextFiles = useCallback((files: FilesMap) => {
    dispatch({ type: 'upsert', files });
  }, []);

  const upsertFiles = useCallback(async (fileList: FileList | readonly File[]): Promise<void> => {
    try {
      const entries = await Promise.all(Array.from(fileList).map(readTextFile));
      dispatch({ type: 'upsert', files: Object.fromEntries(entries) });
    } catch (error: unknown) {
      dispatch({ type: 'upload-error', message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  return { ...state, fileNames, selectFile, upsertFiles, upsertTextFiles, removeFile } as const;
}
