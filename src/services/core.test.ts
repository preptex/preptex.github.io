import { PrepTexErrorCode } from '@preptex/core';
import type { ConditionPolicy } from '@preptex/core';
import {
  createProjectSnapshotAdapter,
  planTransformationAdapter,
  realizeProjectConditionsAdapter,
  resolveProjectViewAdapter,
  toProcessingError,
  updateProjectSnapshotAdapter,
} from './core';

test('updates changed files immutably and retains unchanged file scans', () => {
  const initial = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source: 'Hello' },
    { path: 'other.tex', version: 1, source: 'Other' },
  ]);
  const updated = updateProjectSnapshotAdapter(initial, [
    { kind: 'upsert', file: { path: 'main.tex', version: 2, source: 'Updated' } },
  ]);
  expect(updated).not.toBe(initial);
  expect(updated.files.find((f) => f.path === 'other.tex')).toBe(
    initial.files.find((f) => f.path === 'other.tex'),
  );
  expect(updated.files.find((f) => f.path === 'main.tex')?.version).toBe(2);
  expect(Object.isFrozen(updated.files)).toBe(true);
});

test('deletions update the snapshot, including deletion of the last file', () => {
  const initial = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source: 'Hello' },
    { path: 'other.tex', version: 1, source: 'Other' },
  ]);
  const removed = updateProjectSnapshotAdapter(initial, [
    { kind: 'remove', path: 'main.tex' },
  ]);
  expect(removed.files.map((f) => f.path)).toEqual(['other.tex']);
  const empty = updateProjectSnapshotAdapter(removed, [
    { kind: 'remove', path: 'other.tex' },
  ]);
  expect(empty.files).toEqual([]);
});

test('structural errors are captured on ProjectView without breaking snapshot', () => {
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source: 'Hello' },
    { path: 'bad.tex', version: 1, source: '\\begin{document}' },
  ]);
  expect(snapshot.files).toHaveLength(2);

  const badView = resolveProjectViewAdapter(snapshot, { entryPath: 'bad.tex' });
  expect(badView.status).toBe('blocked');
  if (badView.status !== 'blocked') throw new Error('Expected blocked view');
  expect(badView.reason.code).toBe('structural-error');
  expect(badView.reason.location?.path).toBe('bad.tex');
  expect(badView.reason.location?.range.line).toBeGreaterThanOrEqual(1);

  const healthyView = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
  expect(healthyView.status).toBe('ready');
});

test('preserves original line endings in source snapshots and exported artifacts', () => {
  const source = 'Hello\r\nworld\r\n';
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source },
  ]);
  const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
  expect(view.status).toBe('ready');
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const exported = planTransformationAdapter(view, {
    operation: 'export-project',
    options: { inputs: 'preserve' },
  });
  expect(exported.artifacts[0]?.source).toBe(source);
});

test.each([
  ['preserve' as const, [
    { path: 'main.tex', source: 'Hello \\input{part}' },
    { path: 'part.tex', source: 'world' },
  ]],
  ['inline' as const, [
    { path: 'main.tex', source: 'Hello world' },
  ]],
])('exports realized project using %s input mode', (inputs, expected) => {
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source: 'Hello \\input{part}' },
    { path: 'part.tex', version: 1, source: 'world' },
    { path: 'unused.tex', version: 1, source: 'unused' },
  ]);
  const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
  expect(view.status).toBe('ready');
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const output = planTransformationAdapter(view, {
    operation: 'export-project',
    options: { inputs },
  });
  expect(output.artifacts.map((a) => ({ path: a.path, source: a.source }))).toEqual(expected);
  expect(Object.isFrozen(output.artifacts)).toBe(true);
});

test('condition policies distinguish source, source-with-overrides, manual, and none', () => {
  const source = '\\newif\\ifdraft\n\\ifdraft YES\\else NO\\fi';
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source },
  ]);

  const checkPolicy = (conditions: Exclude<ConditionPolicy, { mode: 'none' }>) =>
    realizeProjectConditionsAdapter(snapshot, {
      entryPath: 'main.tex',
      conditions,
    }).artifacts[0]?.source;

  expect(checkPolicy({ mode: 'source' })).toBe('NO');
  expect(checkPolicy({ mode: 'source-with-overrides', overrides: { draft: true } })).toBe('YES');
  expect(checkPolicy({ mode: 'manual', values: { draft: false } })).toBe('NO');

  const noneView = resolveProjectViewAdapter(snapshot, {
    entryPath: 'main.tex',
    conditions: { mode: 'none' },
  });
  expect(noneView.status).toBe('blocked');
  if (noneView.status !== 'blocked') throw new Error('Expected blocked view');
  expect(noneView.reason.code).toBe('unrealized-condition');
});

test('suppresses comments in exported artifacts without altering source snapshot', () => {
  const source = 'Hello\n% hidden\nworld';
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source },
  ]);
  const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
  expect(view.status).toBe('ready');
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const output = planTransformationAdapter(view, {
    operation: 'export-project',
    options: { inputs: 'preserve', suppressComments: true },
  });
  expect(output.artifacts[0]?.source).not.toContain('hidden');
  expect(snapshot.files[0]?.source).toBe(source);
});

test.each([
  ['missing.tex', 'Hello', 'missing-entry'],
  ['main.tex', '\\input{main}', 'input-cycle'],
] as const)('reports located blocking view issue codes: %s / %s -> %s', (entryPath, source, code) => {
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source },
  ]);
  const view = resolveProjectViewAdapter(snapshot, { entryPath, inputs: 'recursive' });
  expect(view.status).not.toBe('ready');
  if (view.status === 'ready') throw new Error('Expected non-ready view');
  expect(view.reason.code).toBe(code);
});

test('treats missing \\input as a non-halting warning in recursive mode and leaves view ready in command mode', () => {
  const snapshot = createProjectSnapshotAdapter([
    { path: 'main.tex', version: 1, source: 'Intro\n\\input{missing}\nOutro' },
  ]);

  const commandView = resolveProjectViewAdapter(snapshot, {
    entryPath: 'main.tex',
    inputs: 'command',
  });
  expect(commandView.status).toBe('ready');
  expect(commandView.coverage.issues).toHaveLength(0);

  const recursiveView = resolveProjectViewAdapter(snapshot, {
    entryPath: 'main.tex',
    inputs: 'recursive',
  });
  expect(recursiveView.status).toBe('ready');
  expect(recursiveView.coverage.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'missing-input',
        severity: 'warning',
      }),
    ]),
  );
});

test('distinguishes invalid API arguments and unexpected failures', () => {
  let caught: unknown;
  try {
    createProjectSnapshotAdapter([{ path: '../escape.tex', version: 1, source: 'Hello' }]);
  } catch (err: unknown) {
    caught = err;
  }
  expect(toProcessingError(caught)).toMatchObject({
    kind: 'core',
    code: PrepTexErrorCode.InvalidArgument,
  });
  expect(toProcessingError(new Error('Unexpected failure'))).toEqual({
    kind: 'unexpected',
    message: 'Unexpected failure',
  });
});
