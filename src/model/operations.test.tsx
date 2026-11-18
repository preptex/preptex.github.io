import { act, renderHook } from '@testing-library/react';
import { useFiles } from './useFiles';
import { useProjectConfiguration } from './useProjectConfiguration';
import { useProjectModel } from './useProjectModel';
import { useOperations } from './useOperations';

describe('Independent Analysis & Two-Pipeline Operations', () => {
  function useOperationsTest(initialFiles: Record<string, string>) {
    const files = useFiles(initialFiles);
    const config = useProjectConfiguration(files.filesByName, { entryPath: 'main.tex' });
    const model = useProjectModel(files.filesByName, files.sourceRevision, config, files.fileVersions);
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

    act(() => {
      result.current.files.upsertTextFiles({ 'main.tex': '\\label{target:absent}\\ref{target:absent}' });
    });

    expect(result.current.operations.isStale).toBe(true);
  });

  it('reports ineligibility when view is not ready', () => {
    function useUnconfiguredTest() {
      const files = useFiles({ 'main.tex': 'Hello' });
      const config = useProjectConfiguration(files.filesByName, { entryPath: null });
      const model = useProjectModel(files.filesByName, files.sourceRevision, config, files.fileVersions);
      const operations = useOperations(model.snapshot, model.view);
      return { model, operations };
    }

    const { result } = renderHook(useUnconfiguredTest);
    expect(result.current.model.isReady).toBe(false);

    const capability = result.current.operations.checkReferencesCapability();
    expect(capability.eligible).toBe(false);
    expect(capability.reasons[0]?.code).toBe('view-not-ready');
  });

  it('plans comment suppression on realized view and applies edits to sources', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '% A comment\nHello World\n',
      }),
    );

    act(() => {
      result.current.operations.planTransformation({
        operation: 'suppress-comments',
        options: { target: 'selected' },
      });
    });

    expect(result.current.operations.transformationResult).not.toBeNull();
    expect(result.current.operations.pendingEditPlan).not.toBeNull();
    expect(result.current.operations.isEditPlanStale).toBe(false);

    act(() => {
      result.current.operations.applyPendingEdits((updatedFiles) => {
        result.current.files.upsertTextFiles(updatedFiles);
      });
    });

    expect(result.current.files.filesByName['main.tex']).not.toContain('% A comment');
    expect(result.current.files.filesByName['main.tex']).toContain('Hello World');
    expect(result.current.operations.pendingEditPlan).toBeNull();
  });

  it('realizes conditions standalone (Pipeline B) even when structural view is blocked (INV-3)', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '\\newif\\ifcam\\camtrue\n\\ifcam\n{ \\begin{unclosed}\nKeep me\n\\else\nDrop me\n\\fi',
      }),
    );

    // Structural view is blocked due to unclosed brace/environment
    expect(result.current.model.view?.status).toBe('blocked');
    expect(result.current.model.isReady).toBe(false);

    // Pipeline B condition realization succeeds independently
    act(() => {
      result.current.operations.realizeConditions(
        {
          entryPath: 'main.tex',
          traversal: 'project',
          conditions: { mode: 'source' },
          inputs: 'preserve',
          stripDeclarationsAndSetters: true,
        },
        'preview-edits',
      );
    });

    expect(result.current.operations.conditionRealization?.status).toBe('ready');
    expect(result.current.operations.pendingEditPlan).not.toBeNull();
    expect(result.current.operations.isEditPlanStale).toBe(false);

    act(() => {
      result.current.operations.applyPendingEdits((updatedFiles) => {
        result.current.files.upsertTextFiles(updatedFiles);
      });
    });

    expect(result.current.files.filesByName['main.tex']).toBe('{ \\begin{unclosed}\nKeep me\n');
  });

  it('detects stale edit plans when source changes before apply', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '% A comment\nHello World\n',
      }),
    );

    act(() => {
      result.current.operations.planTransformation({
        operation: 'suppress-comments',
        options: { target: 'selected' },
      });
    });

    expect(result.current.operations.isEditPlanStale).toBe(false);

    act(() => {
      result.current.files.upsertTextFiles({ 'main.tex': 'Completely different' });
    });

    expect(result.current.operations.isEditPlanStale).toBe(true);

    act(() => {
      result.current.operations.applyPendingEdits((updatedFiles) => {
        result.current.files.upsertTextFiles(updatedFiles);
      });
    });

    expect(result.current.operations.transformationError).not.toBeNull();
  });

  it('discards pending edit plans without applying', () => {
    const { result } = renderHook(() =>
      useOperationsTest({
        'main.tex': '% A comment\nHello World\n',
      }),
    );

    act(() => {
      result.current.operations.planTransformation({
        operation: 'suppress-comments',
        options: { target: 'selected' },
      });
    });

    expect(result.current.operations.pendingEditPlan).not.toBeNull();

    act(() => {
      result.current.operations.discardPendingEdits();
    });

    expect(result.current.operations.pendingEditPlan).toBeNull();
    expect(result.current.files.filesByName['main.tex']).toContain('% A comment');
  });

  it('supports ignore condition policy with subfolder inputs and whole-document target=source transformations', () => {
    function useIgnoreModeTest() {
      const files = useFiles({
        'main.tex':
          '\\newcommand{\\oldcmd}[1]{[#1]}\n\\ifunknown\n% Branch A comment\n\\oldcmd{one}\n\\else\n% Branch B comment\n\\oldcmd{two}\n\\fi\n\\input{intro/history.tex}\n',
        'intro/history.tex': '\\begin{draftnote}Internal\\end{draftnote}History text',
      });
      const config = useProjectConfiguration(files.filesByName, {
        entryPath: 'main.tex',
        conditionPolicy: { mode: 'ignore' },
      });
      const model = useProjectModel(files.filesByName, files.sourceRevision, config, files.fileVersions);
      const operations = useOperations(model.snapshot, model.view);
      return { files, config, model, operations };
    }

    const { result } = renderHook(useIgnoreModeTest);

    expect(result.current.model.hasConditionals).toBe(true);
    expect(result.current.model.isReady).toBe(true);
    expect(result.current.model.catalog).not.toBeNull();

    act(() => {
      result.current.operations.planTransformation({
        operation: 'suppress-comments',
        options: { target: 'source' },
      });
    });

    expect(result.current.operations.pendingEditPlan).not.toBeNull();
    act(() => {
      result.current.operations.applyPendingEdits((updatedFiles) => {
        result.current.files.upsertTextFiles(updatedFiles, { recordHistory: true, label: 'Suppress comments' });
      });
    });

    expect(result.current.files.filesByName['main.tex']).not.toContain('% Branch A comment');
    expect(result.current.files.filesByName['main.tex']).not.toContain('% Branch B comment');
    expect(result.current.files.filesByName['main.tex']).toContain('\\oldcmd{one}');
    expect(result.current.files.filesByName['main.tex']).toContain('\\oldcmd{two}');

    act(() => {
      result.current.operations.planTransformation({
        operation: 'remove-environments',
        options: { names: ['draftnote'], target: 'source' },
      });
    });

    act(() => {
      result.current.operations.applyPendingEdits((updatedFiles) => {
        result.current.files.upsertTextFiles(updatedFiles, { recordHistory: true, label: 'Remove draftnote' });
      });
    });

    expect(result.current.files.filesByName['intro/history.tex']).toBe('History text');
  });

  test('supports entry-only command scope vs recursive scope and expand-inputs with non-halting missing-input warnings', () => {
    function useInputRevisionTest() {
      const files = useFiles({
        'main.tex': '% Entry comment\n\\input{chapters/part}\n\\input{missing_part}\n',
        'chapters/part.tex': '% Part comment\nIncluded paragraph',
      });
      const config = useProjectConfiguration(files.filesByName, {
        entryPath: 'main.tex',
        conditionPolicy: { mode: 'ignore' },
      });
      const model = useProjectModel(files.filesByName, files.sourceRevision, config, files.fileVersions);
      const operations = useOperations(model.snapshot, model.view);
      return { files, config, model, operations };
    }

    const { result } = renderHook(useInputRevisionTest);

    // Entry-only suppression ('file-only' matches default 'command' input mode).
    act(() => {
      result.current.operations.planTransformation({
        operation: 'suppress-comments',
        options: { target: 'source', entryPath: 'main.tex', traversal: 'file-only' },
      });
    });
    expect(result.current.operations.pendingEditPlan?.edits).toHaveLength(1);
    expect(result.current.operations.pendingEditPlan?.edits[0]?.path).toBe('main.tex');

    // Expand inputs single pass replaces chapters/part and emits missing-input warning without halting.
    act(() => {
      result.current.operations.planTransformation({
        operation: 'expand-inputs',
        options: { mode: 'single', target: 'source', entryPath: 'main.tex' },
      });
    });

    expect(result.current.operations.transformationError).toBeNull();
    expect(result.current.operations.transformationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-input', severity: 'warning' }),
      ]),
    );
    expect(result.current.operations.pendingEditPlan?.edits).toEqual([
      expect.objectContaining({
        kind: 'replace',
        path: 'main.tex',
        expected: '\\input{chapters/part}',
        replacement: expect.stringContaining('% Part comment\nIncluded paragraph'),
      }),
    ]);
  });
});
