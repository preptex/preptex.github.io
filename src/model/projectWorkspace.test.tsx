import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useFiles } from './useFiles';
import { useProjectConfiguration } from './useProjectConfiguration';
import { useArtifacts } from './useArtifacts';

describe('Milestone 2: Separation of Sources, Entry, Viewing, and Artifacts', () => {
  function useWorkspaceTest() {
    const files = useFiles({ 'main.tex': '\\input{part}', 'part.tex': 'Part content' });
    const config = useProjectConfiguration(files.filesByName, { entryPath: 'main.tex' });
    const artifacts = useArtifacts();
    return { files, config, artifacts };
  }

  it('selecting an included file changes viewing without changing entry', () => {
    const { result } = renderHook(useWorkspaceTest, { wrapper: StrictMode });

    expect(result.current.config.entryPath).toBe('main.tex');
    expect(result.current.files.selectedFile).toBe('main.tex');

    // User clicks part.tex to view it
    act(() => {
      result.current.files.selectFile('part.tex');
    });

    // Viewing changed, but entry remains main.tex
    expect(result.current.files.selectedFile).toBe('part.tex');
    expect(result.current.config.entryPath).toBe('main.tex');
  });

  it('adding artifacts does not mutate source files or source revision', () => {
    const { result } = renderHook(useWorkspaceTest, { wrapper: StrictMode });

    const initialRevision = result.current.files.sourceRevision;
    const initialSourceCount = Object.keys(result.current.files.filesByName).length;

    act(() => {
      result.current.artifacts.addArtifacts([
        {
          path: 'main.tex', // same virtual path as source
          source: 'Transformed content',
          topology: 'self-contained-profile',
        },
      ]);
    });

    // Artifacts list updated
    expect(result.current.artifacts.artifacts).toHaveLength(1);
    expect(result.current.artifacts.artifacts[0]?.source).toBe('Transformed content');

    // Sources and revision remain untouched
    expect(result.current.files.sourceRevision).toBe(initialRevision);
    expect(Object.keys(result.current.files.filesByName)).toHaveLength(initialSourceCount);
    expect(result.current.files.filesByName['main.tex']).toBe('\\input{part}');
  });

  it('removing entry file sets entry to null and does not silently pick another source', () => {
    const { result } = renderHook(useWorkspaceTest, { wrapper: StrictMode });

    expect(result.current.config.entryPath).toBe('main.tex');

    act(() => {
      result.current.files.removeFile('main.tex');
    });

    expect(result.current.config.entryPath).toBeNull();
    // Viewing file shifted to remaining file
    expect(result.current.files.selectedFile).toBe('part.tex');
  });

  it('clearing all source files resets entry and configuration', () => {
    const { result } = renderHook(useWorkspaceTest, { wrapper: StrictMode });

    act(() => {
      result.current.files.resetFiles();
    });

    expect(result.current.config.entryPath).toBeNull();
    expect(result.current.files.fileNames).toHaveLength(0);
  });

  it('tracks monotonic sourceRevision and per-file versions on modifications', () => {
    const { result } = renderHook(useWorkspaceTest, { wrapper: StrictMode });

    const initialRevision = result.current.files.sourceRevision;
    const initialPartVersion = result.current.files.fileVersions['part.tex'];

    act(() => {
      result.current.files.upsertTextFiles({ 'part.tex': 'Part content updated' });
    });

    expect(result.current.files.sourceRevision).toBeGreaterThan(initialRevision);
    expect(result.current.files.fileVersions['part.tex']).toBeGreaterThan(initialPartVersion ?? 0);
  });

  it('supports undo/redo history navigation while keeping sourceRevision and fileVersions monotonic', () => {
    function useHistoryTest() {
      return useFiles({ 'main.tex': '% comment\nHello' });
    }
    const { result } = renderHook(useHistoryTest, { wrapper: StrictMode });

    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(false);

    const rev0 = result.current.sourceRevision;
    const ver0 = result.current.fileVersions['main.tex'] ?? 0;

    act(() => {
      result.current.upsertTextFiles(
        { 'main.tex': 'Hello' },
        { recordHistory: true, label: 'Suppress comments' },
      );
    });

    const rev1 = result.current.sourceRevision;
    const ver1 = result.current.fileVersions['main.tex'] ?? 0;
    expect(result.current.filesByName['main.tex']).toBe('Hello');
    expect(result.current.canGoBack).toBe(true);
    expect(result.current.backLabel).toBe('Suppress comments');
    expect(rev1).toBeGreaterThan(rev0);
    expect(ver1).toBeGreaterThan(ver0);

    act(() => {
      result.current.goBack();
    });

    const rev2 = result.current.sourceRevision;
    const ver2 = result.current.fileVersions['main.tex'] ?? 0;
    expect(result.current.filesByName['main.tex']).toBe('% comment\nHello');
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(true);
    expect(result.current.forwardLabel).toBe('Suppress comments');
    expect(rev2).toBeGreaterThan(rev1);
    expect(ver2).toBeGreaterThan(ver1);

    act(() => {
      result.current.goForward();
    });

    const rev3 = result.current.sourceRevision;
    const ver3 = result.current.fileVersions['main.tex'] ?? 0;
    expect(result.current.filesByName['main.tex']).toBe('Hello');
    expect(result.current.canGoBack).toBe(true);
    expect(result.current.canGoForward).toBe(false);
    expect(rev3).toBeGreaterThan(rev2);
    expect(ver3).toBeGreaterThan(ver2);
  });

  it('strips common single root wrapper folder from uploaded relative paths and recommends subfolder entry', async () => {
    const { normalizeUploadedBatch } = await import('./useFiles');
    const { recommendEntry } = await import('./useProjectConfiguration');

    const normalized = normalizeUploadedBatch(
      {
        'paper/main.tex': '\\documentclass{article}\\begin{document}\\input{intro/history.tex}\\end{document}',
        'paper/intro/history.tex': 'History section',
      },
      {},
    );

    expect(Object.keys(normalized)).toEqual(['main.tex', 'intro/history.tex']);
    expect(recommendEntry(normalized)).toBe('main.tex');
  });
});
