import {
  applyProjectEditsAdapter,
  createProjectSnapshotAdapter,
  planTransformationAdapter,
  realizeProjectConditionsAdapter,
  resolveProjectViewAdapter,
  selectProjectNodeAdapter,
  validateProjectEditPlanAdapter,
  walkConfiguredNodesAdapter,
} from './core';

describe('Transformations and Node Operations Service Integration', () => {
  it('plans and applies comment suppression on realized view (INV-6)', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '% A comment\nHello World\n% Another comment\n',
      },
    ]);
    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'suppress-comments',
      options: { target: 'selected' },
    });

    expect(result.kind).toBe('transformation');
    expect(result.editPlan).not.toBeNull();
    expect(result.editPlan?.edits.length).toBeGreaterThan(0);

    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!, view);
    const mainFile = updated.files.find((f) => f.path === 'main.tex');
    expect(mainFile?.source).not.toContain('% A comment');
    expect(mainFile?.source).toContain('Hello World');
  });

  it('supports combined comment and comment environment suppression', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '% Line comment\n\\begin{comment}\nEnv comment\n\\end{comment}\nVisible text\n',
      },
    ]);
    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'suppress-comments',
      options: {
        target: 'selected',
        suppressCommentEnvironments: true,
      },
    });

    expect(result.editPlan).not.toBeNull();
    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!, view);
    const mainFile = updated.files.find((f) => f.path === 'main.tex');
    expect(mainFile?.source).not.toContain('% Line comment');
    expect(mainFile?.source).not.toContain('Env comment');
    expect(mainFile?.source).toContain('Visible text');
  });

  it('removes environments by name across realized view', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '\\begin{C}\nCustom debug info\n\\end{C}\n\\begin{document}\nKeep this\n\\end{document}\n',
      },
    ]);
    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'remove-environments',
      options: {
        target: 'selected',
        names: ['C'],
      },
    });

    expect(result.editPlan).not.toBeNull();
    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!, view);
    const mainFile = updated.files.find((f) => f.path === 'main.tex');
    expect(mainFile?.source).not.toContain('Custom debug info');
    expect(mainFile?.source).toContain('Keep this');
  });

  it('performs node removal, renaming and wrapping on configured view', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '\\documentclass{article}\n\\begin{document}\n\\begin{itemize}\n\\item First\n\\end{itemize}\n\\end{document}',
      },
    ]);

    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const allNodes = walkConfiguredNodesAdapter(view.root);
    const itemizeNode = allNodes.find(
      (n) => n.kind === 'environment' && (n as { name?: string }).name === 'itemize',
    );
    expect(itemizeNode).toBeDefined();

    const selection = selectProjectNodeAdapter(view, itemizeNode!.occurrenceKey);

    const renameResult = planTransformationAdapter(view, {
      operation: 'edit-nodes',
      options: {
        target: 'selected',
        actions: [{ kind: 'rename-environment', selection, name: 'enumerate' }],
      },
    });

    expect(renameResult.editPlan).not.toBeNull();
    const renamedSnapshot = applyProjectEditsAdapter(snapshot, renameResult.editPlan!, view);
    const renamedSource = renamedSnapshot.files.find((f) => f.path === 'main.tex')?.source;
    expect(renamedSource).toContain('\\begin{enumerate}');
    expect(renamedSource).toContain('\\end{enumerate}');
    expect(renamedSource).not.toContain('itemize');

    const wrapResult = planTransformationAdapter(view, {
      operation: 'edit-nodes',
      options: {
        target: 'selected',
        actions: [{ kind: 'wrap-node', selection, name: 'center' }],
      },
    });
    expect(wrapResult.editPlan).not.toBeNull();
    const wrappedSnapshot = applyProjectEditsAdapter(snapshot, wrapResult.editPlan!, view);
    const wrappedSource = wrappedSnapshot.files.find((f) => f.path === 'main.tex')?.source;
    expect(wrappedSource).toContain('\\begin{center}');
    expect(wrappedSource).toContain('\\begin{itemize}');
    expect(wrappedSource).toContain('\\end{center}');

    const removeResult = planTransformationAdapter(view, {
      operation: 'edit-nodes',
      options: {
        target: 'selected',
        actions: [{ kind: 'remove-node', selection }],
      },
    });
    expect(removeResult.editPlan).not.toBeNull();
    const removedSnapshot = applyProjectEditsAdapter(snapshot, removeResult.editPlan!, view);
    const removedSource = removedSnapshot.files.find((f) => f.path === 'main.tex')?.source;
    expect(removedSource).not.toContain('itemize');
    expect(removedSource).not.toContain('First');
  });

  it('validates edit plans and detects stale plans', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '% Comment\nText\n',
      },
    ]);
    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'suppress-comments',
      options: { target: 'selected' },
    });

    const editPlan = result.editPlan!;
    expect(editPlan).toBeDefined();

    const validation = validateProjectEditPlanAdapter(snapshot, editPlan, view);
    expect(validation.eligible).toBe(true);

    const modifiedSnapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 2,
        source: '% Different comment\nDifferent Text\n',
      },
    ]);

    const staleValidation = validateProjectEditPlanAdapter(modifiedSnapshot, editPlan, view);
    expect(staleValidation.eligible).toBe(false);
    expect(() => applyProjectEditsAdapter(modifiedSnapshot, editPlan, view)).toThrow();
  });

  it('realizes conditions standalone (Pipeline B) and exports realized project (Pipeline A)', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '\\newif\\iffoo\n\\footrue\n\\iffoo\nActive text\n\\else\nInactive text\n\\fi',
      },
    ]);

    const realized = realizeProjectConditionsAdapter(snapshot, {
      entryPath: 'main.tex',
      conditions: { mode: 'source' },
    });
    expect(realized.status).toBe('ready');
    expect(realized.artifacts[0]?.source).toContain('Active text');
    expect(realized.artifacts[0]?.source).not.toContain('Inactive text');

    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'export-project',
      options: {
        inputs: 'preserve',
        suppressComments: true,
      },
    });

    expect(result.artifacts.length).toBeGreaterThan(0);
    const artifact = result.artifacts[0];
    expect(artifact?.source).toContain('Active text');
    expect(artifact?.source).not.toContain('Inactive text');
    expect(snapshot.files.find((f) => f.path === 'main.tex')?.source).toContain('Inactive text');
  });
});
