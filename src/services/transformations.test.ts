import {
  applyProjectEditsAdapter,
  createProjectSnapshotAdapter,
  planTransformationAdapter,
  resolveProjectViewAdapter,
  selectProjectNodeAdapter,
  validateProjectEditPlanAdapter,
  walkConfiguredNodesAdapter,
} from './core';

describe('Transformations and Node Operations Service Integration', () => {
  it('plans and applies comment suppression on source', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '% A comment\nHello World\n% Another comment\n',
      },
    ]);

    const result = planTransformationAdapter(snapshot, {
      operation: 'suppress-comments',
      options: { target: 'source' },
    });

    expect(result.kind).toBe('transformation');
    expect(result.editPlan).not.toBeNull();
    expect(result.editPlan?.edits.length).toBeGreaterThan(0);

    // Apply edits
    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!);
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

    const result = planTransformationAdapter(snapshot, {
      operation: 'suppress-comments',
      options: {
        target: 'source',
        suppressCommentEnvironments: true,
      },
    });

    expect(result.editPlan).not.toBeNull();
    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!);
    const mainFile = updated.files.find((f) => f.path === 'main.tex');
    expect(mainFile?.source).not.toContain('% Line comment');
    expect(mainFile?.source).not.toContain('Env comment');
    expect(mainFile?.source).toContain('Visible text');
  });

  it('removes environments by name across source scope (UI-27)', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '\\begin{C}\nCustom debug info\n\\end{C}\n\\begin{document}\nKeep this\n\\end{document}\n',
      },
    ]);

    const result = planTransformationAdapter(snapshot, {
      operation: 'remove-environments',
      options: {
        target: 'source',
        names: ['C'],
      },
    });

    expect(result.editPlan).not.toBeNull();
    const updated = applyProjectEditsAdapter(snapshot, result.editPlan!);
    const mainFile = updated.files.find((f) => f.path === 'main.tex');
    expect(mainFile?.source).not.toContain('Custom debug info');
    expect(mainFile?.source).toContain('Keep this');
  });

  it('performs node removal, renaming and wrapping on configured view (UI-26, UI-29, UI-30)', () => {
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

    // Find the itemize environment node
    const allNodes = walkConfiguredNodesAdapter(view.root);
    const itemizeNode = allNodes.find(
      (n) => n.kind === 'environment' && (n as { name?: string }).name === 'itemize',
    );
    expect(itemizeNode).toBeDefined();

    const selection = selectProjectNodeAdapter(view, itemizeNode!.occurrenceKey);

    // 1. Test rename environment: itemize -> enumerate
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

    // 2. Test wrap node in center environment
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

    // 3. Test remove node
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

    const result = planTransformationAdapter(snapshot, {
      operation: 'suppress-comments',
      options: { target: 'source' },
    });

    const editPlan = result.editPlan!;
    expect(editPlan).toBeDefined();

    // Validation against the original snapshot is eligible
    const validation = validateProjectEditPlanAdapter(snapshot, editPlan);
    expect(validation.eligible).toBe(true);

    // Create a modified snapshot (different version / content)
    const modifiedSnapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 2,
        source: '% Different comment\nDifferent Text\n',
      },
    ]);

    // Validation against modified snapshot fails or applying throws
    const staleValidation = validateProjectEditPlanAdapter(modifiedSnapshot, editPlan);
    expect(staleValidation.eligible).toBe(false);
    expect(() => applyProjectEditsAdapter(modifiedSnapshot, editPlan)).toThrow();
  });

  it('materializes conditions and inlines inputs without altering sources', () => {
    const snapshot = createProjectSnapshotAdapter([
      {
        path: 'main.tex',
        version: 1,
        source: '\\newif\\iffoo\n\\footrue\n\\iffoo\nActive text\n\\else\nInactive text\n\\fi',
      },
    ]);

    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    const result = planTransformationAdapter(view, {
      operation: 'materialize',
      options: {
        inputs: 'preserve',
        suppressComments: true,
      },
    });

    expect(result.artifacts.length).toBeGreaterThan(0);
    const artifact = result.artifacts[0];
    expect(artifact?.source).toContain('Active text');
    expect(artifact?.source).not.toContain('Inactive text');
    // Source files in snapshot remain completely unchanged
    expect(snapshot.files.find((f) => f.path === 'main.tex')?.source).toContain('Inactive text');
  });
});
