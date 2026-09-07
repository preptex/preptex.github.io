import {
  createProjectSnapshot,
  parseDocument,
  resolveProjectView,
} from '@preptex/core';
import { TreeLayoutBuilder } from './treebuilder';
import type { LayoutNode } from '../../types/LayoutNode';

function flatten(node: LayoutNode): readonly LayoutNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

test('converts readonly AST variants, including newlines, stars, and math delimiters', () => {
  const { root } = parseDocument('\\section*{Title}\n\\custom*{text} $x$');
  const before = JSON.stringify(root);
  const layout = new TreeLayoutBuilder().build(root);
  const nodes = flatten(layout);
  expect(nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'section', isStarred: true, data: 'Title', line: 1 }),
    expect.objectContaining({ kind: 'command', isStarred: true, data: 'custom', line: 2 }),
    expect.objectContaining({ kind: 'newline' }),
    expect.objectContaining({ kind: 'math', data: '$' }),
  ]));
  expect(JSON.stringify(root)).toBe(before);
  expect(Object.isFrozen(root.children)).toBe(true);
});

test('buildConfigured converts ConfiguredNode with original location and occurrenceKey', () => {
  const snapshot = createProjectSnapshot([
    {
      path: 'main.tex',
      version: 1,
      source: '\\begin{itemize}\\item Hello\\end{itemize}',
    },
  ]);
  const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const layout = new TreeLayoutBuilder().buildConfigured(view.root);
  const nodes = flatten(layout);

  expect(layout.kind).toBe('root');
  expect(nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'environment',
      data: 'itemize',
      path: 'main.tex',
      line: 1,
    }),
  ]));
  expect(nodes[0]?.occurrenceKey).toBeDefined();
});

test('buildSourceTokens creates layout hierarchy for raw source tokens', () => {
  const snapshot = createProjectSnapshot([
    { path: 'main.tex', version: 1, source: 'Hello world' },
  ]);
  const scanned = snapshot.files[0];
  if (!scanned) throw new Error('Expected scanned file');

  const layout = new TreeLayoutBuilder().buildSourceTokens('main.tex', scanned.tokens);
  expect(layout.kind).toBe('root');
  expect(layout.path).toBe('main.tex');
  expect(layout.children.length).toBeGreaterThan(0);
  expect(layout.children[0]?.path).toBe('main.tex');
});
