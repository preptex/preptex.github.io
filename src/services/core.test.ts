import {
  DiagnosticSeverity, InputHandlingMode, PrepTexErrorCode, transformProject,
} from '@preptex/core';
import { DEFAULT_CORE_OPTIONS } from '../model/useControl';
import { toProcessingError, toTransformOptions, updateProjectSnapshot } from './core';
import type { ProjectSnapshot } from './core';

function ready(snapshot: ProjectSnapshot) {
  if (snapshot.status !== 'ready') throw new Error(snapshot.error.message);
  return snapshot.project;
}

test('merges changed files immutably and retains unchanged parsed files', () => {
  const initial = updateProjectSnapshot(null, { 'main.tex': 'Hello', 'other.tex': 'Other' });
  const initialProject = ready(initial);
  const updated = updateProjectSnapshot(initial, { 'main.tex': 'Updated', 'other.tex': 'Other' });
  const project = ready(updated);
  expect(project).not.toBe(initialProject);
  expect(project.files.find((f) => f.path === 'other.tex')).toBe(initialProject.files[1]);
  expect(project.files.find((f) => f.path === 'main.tex')?.version).toBeGreaterThan(
    initialProject.files[0]?.version ?? 0,
  );
  expect(Object.isFrozen(project.files)).toBe(true);
  expect(Object.isFrozen(project.files[0]?.root.children)).toBe(true);
  expect(transformProject('main.tex', initialProject).files[0]?.source).toBe('Hello');
  expect(transformProject('main.tex', project).files[0]?.source).toBe('Updated');
});

test('deletions rebuild the snapshot, including deletion of the last file', () => {
  const initial = updateProjectSnapshot(null, { 'main.tex': 'Hello', 'other.tex': 'Other' });
  const removed = updateProjectSnapshot(initial, { 'other.tex': 'Other' });
  expect(ready(removed).files.map((f) => f.path)).toEqual(['other.tex']);
  expect(ready(updateProjectSnapshot(removed, {})).files).toEqual([]);
});

test('syntax errors retain their structured location and recover from the complete sources', () => {
  const initial = updateProjectSnapshot(null, { 'main.tex': 'Hello' });
  const failed = updateProjectSnapshot(initial, { 'main.tex': 'Hello', 'bad.tex': '\\begin{document}' });
  expect(failed.status).toBe('error');
  if (failed.status !== 'error' || failed.error.kind !== 'syntax') throw new Error('Expected syntax error');
  expect(failed.error.code).toBe(PrepTexErrorCode.SyntaxError);
  expect(failed.error.diagnostic.path).toBe('bad.tex');
  expect(failed.error.diagnostic.range.line).toBeGreaterThanOrEqual(1);
  expect(failed.error.diagnostic.severity).toBe(DiagnosticSeverity.Error);
  expect(ready(updateProjectSnapshot(failed, { 'main.tex': 'Changed' })).files).toHaveLength(1);
});

test('preserves original line endings in source snapshots and output', () => {
  const source = 'Hello\r\nworld\r\n';
  const snapshot = updateProjectSnapshot(null, { 'main.tex': source });
  expect(transformProject('main.tex', ready(snapshot)).files[0]?.source).toBe(source);
});

test.each([
  [InputHandlingMode.Preserve, [{ path: 'main.tex', source: 'Hello \\input{part}' }]],
  [InputHandlingMode.Flatten, [{ path: 'main.tex', source: 'Hello world' }]],
  [InputHandlingMode.Separate, [
    { path: 'main.tex', source: 'Hello \\input{part}' },
    { path: 'part.tex', source: 'world' },
    { path: 'unused.tex', source: 'unused' },
  ]],
])('uses the public %s input mode', (inputHandling, expected) => {
  const project = ready(updateProjectSnapshot(null, {
    'main.tex': 'Hello \\input{part}', 'part.tex': 'world', 'unused.tex': 'unused',
  }));
  const output = transformProject('main.tex', project, toTransformOptions({
    ...DEFAULT_CORE_OPTIONS, inputHandling,
  }));
  expect(output.files).toEqual(expected);
  expect(Object.isFrozen(output.files)).toBe(true);
});

test('condition handling distinguishes omitted, empty, and enabled conditions', () => {
  const source = '\\newif\\ifdraft\n\\ifdraft YES\\else NO\\fi';
  const project = ready(updateProjectSnapshot(null, { 'main.tex': source }));
  expect(project.declaredConditions).toEqual(['draft']);
  const preserve = toTransformOptions(DEFAULT_CORE_OPTIONS);
  expect(preserve).not.toHaveProperty('enabledConditions');
  expect(transformProject('main.tex', project, preserve).files[0]?.source).toBe(source);
  const disabled = toTransformOptions({ ...DEFAULT_CORE_OPTIONS, handleIfConditions: true });
  expect(disabled.enabledConditions).toEqual([]);
  expect(transformProject('main.tex', project, disabled).files[0]?.source).toContain('NO');
  expect(transformProject('main.tex', project, disabled).files[0]?.source).not.toContain('YES');
  const enabled = toTransformOptions({
    ...DEFAULT_CORE_OPTIONS, handleIfConditions: true, enabledConditions: ['draft'],
  });
  expect(transformProject('main.tex', project, enabled).files[0]?.source).toContain('YES');
  expect(transformProject('main.tex', project, enabled).files[0]?.source).not.toContain('NO');
});

test('suppresses comments without changing the parsed input', () => {
  const source = 'Hello\n% hidden\nworld';
  const project = ready(updateProjectSnapshot(null, { 'main.tex': source }));
  const output = transformProject('main.tex', project, toTransformOptions({
    ...DEFAULT_CORE_OPTIONS, suppressComments: true,
  }));
  expect(output.files[0]?.source).not.toContain('hidden');
  expect(transformProject('main.tex', project).files[0]?.source).toBe(source);
});

test.each([
  ['missing.tex', 'Hello', PrepTexErrorCode.MissingEntry],
  ['main.tex', '\\input{missing}', PrepTexErrorCode.MissingInput],
  ['main.tex', '\\input{main}', PrepTexErrorCode.CircularInput],
])('preserves typed transform errors: %s / %s', (entry, source, code) => {
  const project = ready(updateProjectSnapshot(null, { 'main.tex': source }));
  expect.assertions(1);
  let caught: unknown;
  try {
    transformProject(entry, project, { inputHandling: InputHandlingMode.Flatten });
  } catch (error: unknown) {
    caught = error;
  }
  expect(toProcessingError(caught)).toMatchObject({ kind: 'core', code });
});

test('distinguishes invalid API arguments and unexpected failures', () => {
  const invalid = updateProjectSnapshot(null, { '../escape.tex': 'Hello' });
  expect(invalid).toMatchObject({ status: 'error', error: { code: PrepTexErrorCode.InvalidArgument } });
  expect(toProcessingError(new Error('Unexpected failure'))).toEqual({
    kind: 'unexpected', message: 'Unexpected failure',
  });
});
