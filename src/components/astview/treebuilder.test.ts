import { parseDocument } from '@preptex/core';
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
