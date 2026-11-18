import { fireEvent, render, screen } from '@testing-library/react';
import TreeNode from './TreeNode';
import type { LayoutNode } from '../../types/LayoutNode';

function makeNode(overrides: Partial<LayoutNode>): LayoutNode {
  return {
    id: 'n1',
    kind: 'section',
    line: 1,
    icon: 'S',
    x: 0,
    y: 0,
    strokeWidth: 1,
    children: [],
    ...overrides,
  };
}

describe('TreeNode', () => {
  test('renders node name prominently, omits redundant type text, and shows small further data when relevant', () => {
    const sectionNode = makeNode({
      id: 'sec',
      kind: 'section',
      sectionLevel: 2,
      data: 'Background',
      isStarred: true,
      line: 12,
    });

    const { rerender } = render(<TreeNode node={sectionNode} />);

    const nameEl = screen.getByText('Background');
    expect(nameEl).toHaveClass('AstTreeName');
    expect(screen.getByText('§2')).toBeInTheDocument();
    expect(screen.getByLabelText('Starred section')).toBeInTheDocument();
    expect(screen.getByText('l12')).toHaveClass('AstTreeLine');
    expect(screen.queryByText('section')).toBeNull();

    // Command with relevant further data (\input target path)
    rerender(
      <TreeNode
        node={makeNode({
          id: 'cmd',
          kind: 'command',
          data: 'input',
          previewText: 'chapters/intro.tex',
          line: 5,
        })}
      />,
    );
    expect(screen.getByText('\\input')).toHaveClass('AstTreeName');
    expect(screen.getByText('chapters/intro.tex')).toHaveClass('AstTreeData');

    // Argument shows preview text as primary name and slot tag as small further data
    rerender(
      <TreeNode
        node={makeNode({
          id: 'arg',
          kind: 'argument',
          icon: '[]',
          sublabel: '[#1]',
          previewText: 'opt',
          argumentInfo: { slot: 0, argKind: 'optional', delimiter: 'bracket', opaque: false },
          line: 8,
        })}
      />,
    );
    expect(screen.getByText('opt')).toHaveClass('AstTreeName');
    expect(screen.getByText('[#1]')).toHaveClass('AstTreeData');
  });

  test('shows node type hint box when hovering over the logo and hides on leave or Escape', () => {
    render(
      <TreeNode
        node={makeNode({
          id: 'env',
          kind: 'environment',
          data: 'itemize',
          line: 20,
        })}
      />,
    );

    const logo = screen.getByLabelText('environment');
    const hint = screen.getByRole('tooltip', { hidden: true });
    expect(hint).toHaveTextContent('environment');
    expect(hint).not.toHaveClass('is-open');

    fireEvent.mouseEnter(logo);
    expect(hint).toHaveClass('is-open');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(hint).not.toHaveClass('is-open');

    fireEvent.mouseEnter(logo);
    expect(hint).toHaveClass('is-open');
    fireEvent.mouseLeave(logo);
    expect(hint).not.toHaveClass('is-open');
  });
});
