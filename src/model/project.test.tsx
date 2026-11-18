import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useFiles, useProjectConfiguration } from '@preptex/ui';
import { useProjectModel } from './useProjectModel';
import { useOperations } from './useOperations';

function useTestProject() {
  const files = useFiles({ 'main.tex': 'Hello' });
  const config = useProjectConfiguration(files.filesByName, { entryPath: 'main.tex' });
  const model = useProjectModel(files.filesByName, files.sourceRevision, config, files.fileVersions);
  const operations = useOperations(model.snapshot, model.view);
  return { files, config, model, operations };
}

test('initial files and consecutive mutations stay in sync under StrictMode', () => {
  const { result } = renderHook(useTestProject, { wrapper: StrictMode });
  expect(result.current.model.isReady).toBe(true);
  act(() => {
    result.current.files.upsertTextFiles({ 'a.tex': 'A' });
    result.current.files.upsertTextFiles({ 'b.tex': 'B' });
  });
  expect(result.current.model.snapshot?.files.map((f) => f.path)).toEqual([
    'a.tex',
    'b.tex',
    'main.tex',
  ]);
  expect(result.current.files.selectedFile).toBe('main.tex');
  act(() => result.current.files.removeFile('main.tex'));
  expect(result.current.files.selectedFile).toBe('a.tex');
  expect(result.current.model.snapshot?.files.map((f) => f.path)).toEqual(['a.tex', 'b.tex']);
});

test('structural error blocks view and recovers when source is fixed', () => {
  const { result } = renderHook(useTestProject);
  act(() => result.current.files.upsertTextFiles({ 'main.tex': '\\begin{document}' }));
  expect(result.current.model.snapshot).not.toBeNull();
  expect(result.current.model.isReady).toBe(false);
  expect(result.current.model.viewIssue?.code).toBe('structural-error');

  act(() => result.current.files.upsertTextFiles({ 'main.tex': 'Recovered', 'other.tex': 'Other' }));
  expect(result.current.model.isReady).toBe(true);

  let exportedSources: readonly { path: string; source: string }[] = [];
  act(() => {
    const res = result.current.operations.planTransformation({
      operation: 'export-project',
      options: { inputs: 'preserve' },
    });
    exportedSources = res?.artifacts.map((a) => ({ path: a.path, source: a.source })) ?? [];
  });
  expect(exportedSources).toEqual([{ path: 'main.tex', source: 'Recovered' }]);
});

test('missing input emits a non-halting warning in recursive mode and clears after uploading the dependency', () => {
  const { result } = renderHook(useTestProject);
  act(() => {
    result.current.files.upsertTextFiles({ 'main.tex': '\\input{part}' });
  });

  // Default inputs: 'command' keeps the view ready with no missing-input warning.
  expect(result.current.config.inputs).toBe('command');
  expect(result.current.model.isReady).toBe(true);
  expect(result.current.model.issues.some((i) => i.code === 'missing-input')).toBe(false);

  // Switching to recursive mode follows \input and warns without halting when part.tex is absent.
  act(() => {
    result.current.config.setInputMode('recursive');
  });
  expect(result.current.model.isReady).toBe(true);
  expect(result.current.model.viewIssue).toBeNull();
  expect(result.current.model.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'missing-input', severity: 'warning' }),
    ]),
  );

  act(() => result.current.files.upsertTextFiles({ 'part.tex': 'Part' }));
  expect(result.current.model.isReady).toBe(true);
  expect(result.current.model.viewIssue).toBeNull();
  expect(result.current.model.issues.some((i) => i.code === 'missing-input')).toBe(false);

  let exportedSources: readonly { path: string; source: string }[] = [];
  act(() => {
    const res = result.current.operations.planTransformation({
      operation: 'export-project',
      options: { inputs: 'inline' },
    });
    exportedSources = res?.artifacts.map((a) => ({ path: a.path, source: a.source })) ?? [];
  });
  expect(exportedSources).toEqual([{ path: 'main.tex', source: 'Part' }]);
});

test('uploads complete file batches and keeps a selection made while reading', async () => {
  const { result } = renderHook(useTestProject);
  await act(async () => {
    const upload = result.current.files.upsertFiles([new File(['Uploaded'], 'new.tex')]);
    result.current.files.upsertTextFiles({ 'selected.tex': 'Selected' });
    result.current.files.selectFile('selected.tex');
    await upload;
  });
  expect(result.current.files.selectedFile).toBe('selected.tex');
  expect(result.current.files.filesByName['new.tex']).toBe('Uploaded');
  expect(result.current.model.snapshot?.files.map((f) => f.path)).toEqual([
    'main.tex',
    'new.tex',
    'selected.tex',
  ]);
});
