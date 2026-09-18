import { act, renderHook } from '@testing-library/react';
import { useFiles } from './useFiles';
import { useProjectConfiguration } from './useProjectConfiguration';
import { useProjectModel } from './useProjectModel';
import { useOperations } from './useOperations';

describe('Milestone 5: Independent Analysis Operations', () => {
  function useOperationsTest(initialFiles: Record<string, string>) {
    const files = useFiles(initialFiles);
    const config = useProjectConfiguration(files.filesByName, { entryPath: 'main.tex' });
    const model = useProjectModel(files.filesByName, files.sourceRevision, config);
    const operations = useOperations(model.snapshot, model.view);
    return { files, config, model, operations };
  }

  it('runs reference analysis and discovers missing references', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '\\ref{target:absent}',
      }),
    );

    expect(result.current.model.isReady).toBe(true);

    const capability = result.current.operations.checkReferencesCapability();
    expect(capability.eligible).toBe(true);

    act(() => {
      result.current.operations.runReferences();
    });

    expect(result.current.operations.result).not.toBeNull();
    expect(result.current.operations.result?.findings.length).toBeGreaterThan(0);
    expect(result.current.operations.result?.findings[0]?.code).toBe('missing-reference');
    expect(result.current.operations.isStale).toBe(false);
  });

  it('runs reference analysis and discovers no findings when targets exist', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '\\label{target:present}\\ref{target:present}',
      }),
    );

    expect(result.current.model.isReady).toBe(true);

    act(() => {
      result.current.operations.runReferences();
    });

    expect(result.current.operations.result).not.toBeNull();
    expect(result.current.operations.result?.findings).toHaveLength(0);
  });

  it('marks results stale when source snapshot changes', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '\\ref{target:absent}',
      }),
    );

    act(() => {
      result.current.operations.runReferences();
    });
    expect(result.current.operations.isStale).toBe(false);

    // Modify source files
    act(() => {
      result.current.files.upsertTextFiles({ 'main.tex': '\\label{target:absent}\\ref{target:absent}' });
    });

    expect(result.current.operations.isStale).toBe(true);
  });

  it('reports ineligibility when view is not ready', () => {
    function useUnconfiguredTest() {
      const files = useFiles({ 'main.tex': 'Hello' });
      const config = useProjectConfiguration(files.filesByName, { entryPath: null });
      const model = useProjectModel(files.filesByName, files.sourceRevision, config);
      const operations = useOperations(model.snapshot, model.view);
      return { model, operations };
    }

    const { result } = renderHook(useUnconfiguredTest);
    expect(result.current.model.isReady).toBe(false);

    const capability = result.current.operations.checkReferencesCapability();
    expect(capability.eligible).toBe(false);
    expect(capability.reasons[0]?.code).toBe('view-not-ready');
  });
});
