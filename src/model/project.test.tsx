import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { InputHandlingMode, PrepTexErrorCode } from '@preptex/core';
import { useFiles } from './useFiles';
import { useCoreProcess } from './useCoreProcess';
import { useControl } from './useControl';

function useTestProject() {
  const files = useFiles({ 'main.tex': 'Hello' });
  const control = useControl();
  const core = useCoreProcess(files.selectedFile, files.filesByName, control.options);
  return { files, control, core };
}

test('initial files and consecutive mutations stay in sync under StrictMode', () => {
  const { result } = renderHook(useTestProject, { wrapper: StrictMode });
  expect(result.current.core.canTransform).toBe(true);
  act(() => {
    result.current.files.upsertTextFiles({ 'a.tex': 'A' });
    result.current.files.upsertTextFiles({ 'b.tex': 'B' });
  });
  expect(result.current.core.project?.files.map((f) => f.path)).toEqual(['a.tex', 'b.tex', 'main.tex']);
  expect(result.current.files.selectedFile).toBe('main.tex');
  act(() => result.current.files.removeFile('main.tex'));
  expect(result.current.files.selectedFile).toBe('a.tex');
  expect(result.current.core.project?.files.map((f) => f.path)).toEqual(['a.tex', 'b.tex']);
});

test('a failed parse disables transforms and recovery parses every current buffer', () => {
  const { result } = renderHook(useTestProject);
  act(() => result.current.files.upsertTextFiles({ 'main.tex': '\\begin{document}' }));
  expect(result.current.core.project).toBeNull();
  expect(result.current.core.canTransform).toBe(false);
  expect(result.current.core.result.error?.kind).toBe('syntax');
  expect(result.current.core.transform()).toBeNull();
  act(() => result.current.files.upsertTextFiles({ 'main.tex': 'Recovered', 'other.tex': 'Other' }));
  expect(result.current.core.canTransform).toBe(true);
  act(() => {
    expect(result.current.core.transform()).toEqual([{ path: 'main.tex', source: 'Recovered' }]);
  });
  expect(result.current.core.result.error).toBeNull();
});

test('a missing input error clears after uploading the dependency', () => {
  const { result } = renderHook(useTestProject);
  act(() => {
    result.current.files.upsertTextFiles({ 'main.tex': '\\input{part}' });
    result.current.control.setOptions((options) => ({ ...options, inputHandling: InputHandlingMode.Flatten }));
  });
  act(() => { expect(result.current.core.transform()).toBeNull(); });
  expect(result.current.core.result.error).toMatchObject({ code: PrepTexErrorCode.MissingInput });
  act(() => result.current.files.upsertTextFiles({ 'part.tex': 'Part' }));
  expect(result.current.core.result.error).toBeNull();
  act(() => {
    expect(result.current.core.transform()).toEqual([{ path: 'main.tex', source: 'Part' }]);
  });
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
  expect(result.current.core.project?.files.map((f) => f.path)).toEqual(['main.tex', 'new.tex', 'selected.tex']);
});
