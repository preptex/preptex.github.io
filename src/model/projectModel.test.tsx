import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useFiles } from './useFiles';
import { useProjectConfiguration } from './useProjectConfiguration';
import { useProjectModel } from './useProjectModel';

describe('Milestone 3: Source Readiness, Configured View Resolution & Project Model', () => {
  function useProjectModelTest() {
    const files = useFiles({
      'main.tex': '\\newif\\iftest\\testtrue\\iftest A\\else B\\fi',
      'unrelated.tex': 'Unrelated content',
    });
    const config = useProjectConfiguration(files.filesByName, { entryPath: null });
    const model = useProjectModel(files.filesByName, files.sourceRevision, config);
    return { files, config, model };
  }

  it('provides usable source snapshot and inventories before an entry is chosen', () => {
    const { result } = renderHook(useProjectModelTest, { wrapper: StrictMode });

    expect(result.current.model.snapshot).not.toBeNull();
    expect(result.current.model.view).toBeNull(); // No entry chosen yet
    expect(result.current.model.isReady).toBe(false);

    // Source inventory is available
    const conditions = result.current.model.detectedConditions;
    expect(conditions).toContain('test');
  });

  it('resolves configured view when entry is selected and updates view status', () => {
    const { result } = renderHook(useProjectModelTest, { wrapper: StrictMode });

    act(() => {
      result.current.config.setEntryPath('main.tex');
    });

    expect(result.current.model.view).not.toBeNull();
    expect(result.current.model.view?.status).toBe('ready');
    expect(result.current.model.isReady).toBe(true);
  });

  it('reuses the source snapshot when only entry or condition policy changes', () => {
    const { result } = renderHook(useProjectModelTest, { wrapper: StrictMode });

    const initialSnapshotId = result.current.model.snapshot?.id;
    expect(initialSnapshotId).toBeDefined();

    // Change entry
    act(() => {
      result.current.config.setEntryPath('main.tex');
    });
    expect(result.current.model.snapshot?.id).toBe(initialSnapshotId);

    // Change condition policy to force false
    act(() => {
      result.current.config.setConditionPolicy({
        mode: 'source-with-overrides',
        overrides: { test: false },
      });
    });
    expect(result.current.model.snapshot?.id).toBe(initialSnapshotId);
    expect(result.current.model.view?.status).toBe('ready');
  });

  it('marks view as incomplete when condition is unknown, without breaking snapshot', () => {
    function useUnknownConditionTest() {
      const files = useFiles({
        'main.tex': '\\ifunknown FOO\\fi',
      });
      const config = useProjectConfiguration(files.filesByName, { entryPath: 'main.tex' });
      const model = useProjectModel(files.filesByName, files.sourceRevision, config);
      return { files, config, model };
    }

    const { result } = renderHook(useUnknownConditionTest, { wrapper: StrictMode });

    expect(result.current.model.snapshot).not.toBeNull();
    expect(result.current.model.view?.status).toBe('incomplete');
    expect(result.current.model.isReady).toBe(false);
  });
});
