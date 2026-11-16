import {
  buildCoarseViewTree,
  createProjectSnapshot,
  resolveProjectView,
} from '@preptex/core';
import { TreeLayoutBuilder } from './treebuilder';
import type { LayoutNode } from '../../types/LayoutNode';

function flatten(node: LayoutNode): readonly LayoutNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

test('buildConfigured converts starred sections, command tokens, environments, and math delimiters', () => {
  const snapshot = createProjectSnapshot([
    {
      path: 'main.tex',
      version: 1,
      source: '\\section*{Title}\n\\custom{text} $x$\n\\begin{itemize}\\item Hello\\end{itemize}',
    },
  ]);
  const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });
  expect(view.status).toBe('ready');
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const before = JSON.stringify(view.root);
  const layout = new TreeLayoutBuilder().buildConfigured(view.root);
  const nodes = flatten(layout);

  expect(layout.kind).toBe('root');
  expect(nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'section', isStarred: true, data: 'Title', line: 1 }),
    expect.objectContaining({ kind: 'command', data: 'custom', line: 2 }),
    expect.objectContaining({ kind: 'math', data: '$' }),
    expect.objectContaining({ kind: 'environment', data: 'itemize', path: 'main.tex', line: 3 }),
  ]));
  expect(nodes[0]?.occurrenceKey).toBeDefined();
  expect(JSON.stringify(view.root)).toBe(before);
  expect(Object.isFrozen(view.root.children)).toBe(true);
});

test('buildSourceTokens creates layout hierarchy for raw source tokens', () => {
  const snapshot = createProjectSnapshot([
    { path: 'main.tex', version: 1, source: 'Hello \\emph{world} % note' },
  ]);
  const scanned = snapshot.files[0];
  if (!scanned) throw new Error('Expected scanned file');

  const layout = new TreeLayoutBuilder().buildSourceTokens('main.tex', scanned.tokens);
  expect(layout.kind).toBe('root');
  expect(layout.path).toBe('main.tex');
  expect(layout.children.length).toBeGreaterThan(0);
  expect(layout.children[0]?.path).toBe('main.tex');
  expect(layout.children.some((c) => c.kind === 'command' && c.data === 'emph')).toBe(true);
  expect(layout.children.some((c) => c.kind === 'comment')).toBe(true);
});

test('buildCoarse maps coarse tree sections, environments, commands, and argument child nodes', () => {
  const snapshot = createProjectSnapshot([
    {
      path: 'main.tex',
      version: 1,
      source: '\\section{Intro}\nProse \\textbf{ignored} \\custom[opt]{Hello}\n\\begin{itemize}\\item One\\end{itemize}',
    },
  ]);
  const view = resolveProjectView(snapshot, {
    entryPath: 'main.tex',
    customCommands: [{ name: 'custom', optionalArgs: 1, mandatoryArgs: 1 }],
  });
  expect(view.status).toBe('ready');
  if (view.status !== 'ready') throw new Error('Expected ready view');

  const coarse = buildCoarseViewTree(view);
  const layout = new TreeLayoutBuilder().buildCoarse(coarse);
  const nodes = flatten(layout);

  expect(nodes.some((n) => n.kind === 'section' && n.data === 'Intro')).toBe(true);
  expect(nodes.some((n) => n.kind === 'command' && n.data === 'custom')).toBe(true);
  expect(nodes.some((n) => n.kind === 'argument' && n.sublabel === '[#1]')).toBe(true);
  expect(nodes.some((n) => n.kind === 'argument' && n.sublabel === '{#2}')).toBe(true);
  expect(nodes.some((n) => n.kind === 'environment' && n.data === 'itemize')).toBe(true);
  expect(nodes.some((n) => n.kind === 'command' && n.data === 'textbf')).toBe(false);
});
