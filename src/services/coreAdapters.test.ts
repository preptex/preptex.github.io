import {
  DiagnosticCode,
  DiagnosticSeverity,
  PrepTexError,
  PrepTexErrorCode,
  PrepTexSyntaxError,
  ProjectOperationError,
} from '@preptex/core';
import type {
  SourceFile,
  OperationFailure,
} from '@preptex/core';
import {
  applyProjectEditsAdapter,
  checkOperationCapabilityAdapter,
  createProjectSnapshotAdapter,
  createProjectSourceIndexAdapter,
  getSelectedNodeAdapter,
  inspectProjectAdapter,
  inspectProjectEnvironmentsAdapter,
  lookupProjectSourceAdapter,
  planTransformationAdapter,
  resolveProjectViewAdapter,
  runAnalysisAdapter,
  selectProjectNodeAdapter,
  sourceOffsetAtAdapter,
  toProcessingError,
  updateProjectSnapshotAdapter,
  walkConfiguredNodesAdapter,
} from './core';

describe('Milestone 1: Core Service Adapters (@preptex/core@0.3.0)', () => {
  describe('Source Snapshots & Updates', () => {
    it('creates an immutable snapshot with lossless text and UTF-16 line endings', () => {
      const crlfSource = 'Line 1\r\nLine 2\r\n';
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: crlfSource },
        { path: 'sub/part.tex', version: 1, source: '\\label{sec:part}Content' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      expect(snapshot.id).toBeDefined();
      expect(snapshot.files).toHaveLength(2);
      expect(snapshot.files[0]?.source).toBe(crlfSource);
      expect(Object.isFrozen(snapshot.files)).toBe(true);
    });

    it('performs atomic updates (upsert and removal) advancing versions', () => {
      const initialFiles: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: 'Initial' },
        { path: 'temp.tex', version: 1, source: 'To delete' },
      ];
      const snapshot = createProjectSnapshotAdapter(initialFiles);
      const updated = updateProjectSnapshotAdapter(snapshot, [
        { kind: 'upsert', file: { path: 'main.tex', version: 2, source: 'Updated' } },
        { kind: 'remove', path: 'temp.tex' },
      ]);
      expect(updated.files).toHaveLength(1);
      expect(updated.files[0]?.path).toBe('main.tex');
      expect(updated.files[0]?.source).toBe('Updated');
      expect(updated.files[0]?.version).toBe(2);
    });
  });

  describe('Source Inventory', () => {
    it('extracts definitions, labels, and references without an entry or view', () => {
      const files: readonly SourceFile[] = [
        {
          path: 'main.tex',
          version: 1,
          source: '\\newcommand{\\mycmd}{value}\\label{lbl:main}\\ref{lbl:main}',
        },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const inventory = inspectProjectAdapter(snapshot);
      const kinds = inventory.facts.map((f) => f.kind);
      expect(kinds).toContain('definition');
      expect(kinds).toContain('label');
      expect(kinds).toContain('reference');
    });

    it('inventories environments across all branches without requiring view', () => {
      const files: readonly SourceFile[] = [
        {
          path: 'main.tex',
          version: 1,
          source: '\\begin{itemize}\\item A\\end{itemize}\\begin{enumerate}\\item B\\end{enumerate}',
        },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const envInventory = inspectProjectEnvironmentsAdapter(snapshot);
      expect(envInventory.environments).toHaveLength(2);
      expect(envInventory.environments.map((e) => e.name)).toEqual(['itemize', 'enumerate']);
    });
  });

  describe('Configured View Resolution', () => {
    it('resolves a ready view with entry and active inputs', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: 'Hello \\input{part}' },
        { path: 'part.tex', version: 1, source: 'World' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      expect(view.status).toBe('ready');
      if (view.status !== 'ready') throw new Error('Expected ready view');
      const nodes = walkConfiguredNodesAdapter(view.root);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('follows source conditions and supports force true/false overrides', () => {
      const source = '\\newif\\iftest\\testtrue\\iftest TRUE-BRANCH\\else FALSE-BRANCH\\fi';
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source },
      ];
      const snapshot = createProjectSnapshotAdapter(files);

      // Follow source: test is set to true
      const viewFollow = resolveProjectViewAdapter(snapshot, {
        entryPath: 'main.tex',
        conditions: { mode: 'source' },
      });
      expect(viewFollow.status).toBe('ready');

      // Override: force false
      const viewForceFalse = resolveProjectViewAdapter(snapshot, {
        entryPath: 'main.tex',
        conditions: {
          mode: 'source-with-overrides',
          overrides: { test: false },
        },
      });
      expect(viewForceFalse.status).toBe('ready');
    });

    it('identifies incomplete views for unresolved conditions', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: '\\ifunknown UNKNOWN\\fi' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, {
        entryPath: 'main.tex',
        conditions: { mode: 'source' },
      });
      expect(view.status).toBe('incomplete');
    });
  });

  describe('Independent Analyses', () => {
    it('runs references analysis and reports findings', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: '\\ref{missing:target}' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      expect(view.status).toBe('ready');
      if (view.status !== 'ready') throw new Error('Expected ready view');

      const capability = checkOperationCapabilityAdapter(view, {
        operation: 'references',
      });
      expect(capability.eligible).toBe(true);
      const analysis = runAnalysisAdapter(view, { operation: 'references' });
      expect(analysis.findings.length).toBeGreaterThan(0);
      expect(analysis.findings[0]?.code).toBe('missing-reference');
    });
  });

  describe('Node Operations & Indexed Lookup', () => {
    it('creates source index and converts line/column to UTF-16 offsets', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: 'Line1\nLine2\nLine3' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      const index = createProjectSourceIndexAdapter(view);
      const offset = sourceOffsetAtAdapter(index, 'main.tex', 2, 0);
      expect(offset).toBe(6); // 'Line1\n' is 6 characters
    });

    it('looks up nodes by source offset', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: '\\begin{center}Center\\end{center}' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      const index = createProjectSourceIndexAdapter(view);
      const hits = lookupProjectSourceAdapter(index, { path: 'main.tex', start: 5 });
      expect(hits.length).toBeGreaterThan(0);
    });

    it('selects and resolves a node from view', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: '\\begin{itemize}\\item A\\end{itemize}' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      expect(view.status).toBe('ready');
      if (view.status !== 'ready') throw new Error('Expected ready view');

      const nodes = walkConfiguredNodesAdapter(view.root);
      const itemize = nodes.find(
        (n) => n.kind === 'environment' && n.syntax.opening?.name === 'itemize',
      );
      expect(itemize).toBeDefined();
      if (!itemize) throw new Error('Expected itemize node');

      const sel = selectProjectNodeAdapter(view, itemize.occurrenceKey);
      const resolved = getSelectedNodeAdapter(view, sel);
      expect(resolved).toBe(itemize);
    });

    it('plans and applies an edit-nodes rename operation', () => {
      const files: readonly SourceFile[] = [
        { path: 'main.tex', version: 1, source: '\\begin{itemize}\\item A\\end{itemize}' },
      ];
      const snapshot = createProjectSnapshotAdapter(files);
      const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
      expect(view.status).toBe('ready');
      if (view.status !== 'ready') throw new Error('Expected ready view');

      const nodes = walkConfiguredNodesAdapter(view.root);
      const itemize = nodes.find(
        (n) => n.kind === 'environment' && n.syntax.opening?.name === 'itemize',
      );
      expect(itemize).toBeDefined();
      if (!itemize) throw new Error('Expected itemize node');

      const sel = selectProjectNodeAdapter(view, itemize.occurrenceKey);
      const planResult = planTransformationAdapter(view, {
        operation: 'edit-nodes',
        options: {
          target: 'selected',
          actions: [
            { kind: 'rename-environment', selection: sel, name: 'enumerate' },
          ],
        },
      });
      expect(planResult.editPlan).toBeDefined();
      if (!planResult.editPlan) throw new Error('Expected edit plan');

      const updatedSnapshot = applyProjectEditsAdapter(
        snapshot,
        planResult.editPlan,
        view,
      );
      expect(updatedSnapshot.files[0]?.source).toContain('\\begin{enumerate}');
      expect(updatedSnapshot.files[0]?.source).toContain('\\end{enumerate}');
    });
  });

  describe('Error Normalization', () => {
    it('normalizes ProjectOperationError preserving failure details', () => {
      const failure: OperationFailure = {
        code: 'unavailable',
        message: 'View is incomplete',
        locations: [],
      };
      const opError = new ProjectOperationError(failure);
      const normalized = toProcessingError(opError);
      expect(normalized.kind).toBe('operation');
      if (normalized.kind !== 'operation') throw new Error('Expected operation error');
      expect(normalized.failure.code).toBe('unavailable');
      expect(normalized.message).toContain('View is incomplete');
    });

    it('normalizes PrepTexSyntaxError preserving diagnostic details', () => {
      const syntaxError = new PrepTexSyntaxError('Syntax error', {
        code: DiagnosticCode.SyntaxError,
        severity: DiagnosticSeverity.Error,
        message: 'Unbalanced brace',
        path: 'main.tex',
        range: { line: 1, start: 0, end: 5 },
      });
      const normalized = toProcessingError(syntaxError);
      expect(normalized.kind).toBe('syntax');
      if (normalized.kind !== 'syntax') throw new Error('Expected syntax error');
      expect(normalized.diagnostic.path).toBe('main.tex');
      expect(normalized.diagnostic.range.line).toBe(1);
    });

    it('normalizes PrepTexError preserving code', () => {
      const coreError = new PrepTexError('Missing entry', PrepTexErrorCode.MissingEntry);
      const normalized = toProcessingError(coreError);
      expect(normalized.kind).toBe('core');
      if (normalized.kind !== 'core') throw new Error('Expected core error');
      expect(normalized.code).toBe(PrepTexErrorCode.MissingEntry);
    });

    it('normalizes unexpected errors', () => {
      const unexpected = new Error('Random JS error');
      const normalized = toProcessingError(unexpected);
      expect(normalized).toEqual({ kind: 'unexpected', message: 'Random JS error' });
    });
  });
});
