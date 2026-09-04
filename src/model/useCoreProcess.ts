import { useCallback, useEffect, useState } from 'react';
import { transformProject } from '@preptex/core';
import type { ConditionName, ProjectFilePath, TransformedFile, WarningDiagnostic } from '@preptex/core';
import type { CoreOptionsUI } from './useControl';
import type { FilesMap } from '../types/files';
import { toProcessingError, toTransformOptions, updateProjectSnapshot } from '../services/core';
import type { ProcessingError, ProjectSnapshot } from '../services/core';

export interface CoreRunResult {
  readonly declaredConditions: readonly ConditionName[];
  readonly diagnostics: readonly WarningDiagnostic[];
  readonly error: ProcessingError | null;
}

interface TransformFailure {
  readonly sources: FilesMap;
  readonly entry: ProjectFilePath;
  readonly options: CoreOptionsUI;
  readonly error: ProcessingError;
}

export function useCoreProcess(entryFile: ProjectFilePath, files: FilesMap, options: CoreOptionsUI) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [failure, setFailure] = useState<TransformFailure | null>(null);

  useEffect(() => {
    setSnapshot((previous) => previous?.sources === files
      ? previous
      : updateProjectSnapshot(previous, files));
  }, [files]);

  // Never expose or transform a snapshot from an older set of source buffers.
  const current = snapshot?.sources === files ? snapshot : null;
  const project = current?.status === 'ready' ? current.project : null;
  const transformError = failure?.sources === files && failure.entry === entryFile
    && failure.options === options ? failure.error : null;
  const result: CoreRunResult = {
    declaredConditions: project?.declaredConditions ?? [],
    diagnostics: project?.diagnostics ?? [],
    error: current?.status === 'error' ? current.error : transformError,
  };
  const canTransform = Boolean(project?.files.some((file) => file.path === entryFile));

  const transform = useCallback((): readonly TransformedFile[] | null => {
    if (!project || !entryFile) return null;
    try {
      const output = transformProject(entryFile, project, toTransformOptions(options));
      setFailure(null);
      return output.files;
    } catch (error: unknown) {
      setFailure({ sources: files, entry: entryFile, options, error: toProcessingError(error) });
      return null;
    }
  }, [project, entryFile, files, options]);

  return { result, transform, project, canTransform } as const;
}
