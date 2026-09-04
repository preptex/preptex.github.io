import {
  mergeProjects,
  parseProject,
  PrepTexError,
  PrepTexSyntaxError,
} from '@preptex/core';
import type {
  ParsedProject,
  PrepTexErrorCode,
  SourceFile,
  SyntaxDiagnostic,
  TransformOptions,
} from '@preptex/core';
import type { CoreOptionsUI } from '../model/useControl';
import type { FilesMap } from '../types/files';

export type ProcessingError =
  | {
      readonly kind: 'syntax';
      readonly message: string;
      readonly code: PrepTexErrorCode.SyntaxError;
      readonly diagnostic: SyntaxDiagnostic;
    }
  | { readonly kind: 'core'; readonly message: string; readonly code: PrepTexErrorCode }
  | { readonly kind: 'unexpected'; readonly message: string };

export function toProcessingError(error: unknown): ProcessingError {
  if (error instanceof PrepTexSyntaxError) {
    return { kind: 'syntax', message: error.message, code: error.code, diagnostic: error.diagnostic };
  }
  if (error instanceof PrepTexError) {
    return { kind: 'core', message: error.message, code: error.code };
  }
  return { kind: 'unexpected', message: error instanceof Error ? error.message : String(error) };
}

interface SnapshotBase {
  readonly sources: FilesMap;
  readonly version: number;
}

export type ProjectSnapshot = SnapshotBase & (
  | { readonly status: 'ready'; readonly project: ParsedProject }
  | { readonly status: 'error'; readonly error: ProcessingError }
);

/** Parse changed buffers only; rebuild after deletion or a failed parse. */
export function updateProjectSnapshot(
  previous: ProjectSnapshot | null,
  sources: FilesMap,
): ProjectSnapshot {
  const version = (previous?.version ?? 0) + 1;
  const files: readonly SourceFile[] = Object.entries(sources).map(([path, source]) => ({
    path, source, version,
  }));

  try {
    const hasRemovals = previous && Object.keys(previous.sources).some(
      (path) => !Object.prototype.hasOwnProperty.call(sources, path),
    );
    let project: ParsedProject;
    if (previous?.status === 'ready' && !hasRemovals) {
      const changed = files.filter((file) => previous.sources[file.path] !== file.source);
      project = changed.length
        ? mergeProjects(previous.project, parseProject(changed))
        : previous.project;
    } else {
      project = parseProject(files);
    }
    return { status: 'ready', sources, version, project };
  } catch (error: unknown) {
    return { status: 'error', sources, version, error: toProcessingError(error) };
  }
}

export function toTransformOptions(options: CoreOptionsUI): TransformOptions {
  return {
    suppressComments: options.suppressComments,
    inputHandling: options.inputHandling,
    // Omission preserves syntax; an empty array evaluates every condition as false.
    ...(options.handleIfConditions ? { enabledConditions: options.enabledConditions } : {}),
  };
}
