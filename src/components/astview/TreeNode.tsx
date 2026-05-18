import { useState } from 'react';
import { LayoutNode } from '../../types/LayoutNode';

interface TreeNodeProps {
  node: LayoutNode;
  onSelectNode?: (node: LayoutNode) => void;
}

function clamp(value = '', max = 64): string {
  return value.length > max ? value.slice(0, Math.max(0, max - 3)) + '...' : value;
}

function getDisplayData(node: LayoutNode): string {
  return clamp(node.data || '');
}

function getNodeLine(node: LayoutNode): string {
  return typeof node.line === 'number' && Number.isFinite(node.line) ? `: l${node.line}` : '';
}

function getSectionLevelName(level?: number): string {
  switch (level) {
    case 0:
      return 'document';
    case 1:
      return 'section';
    case 2:
      return 'subsection';
    case 3:
      return 'subsubsection';
    case 4:
      return 'paragraph';
    case 5:
      return 'subparagraph';
    default:
      return 'section';
  }
}

function getDisplayType(node: LayoutNode): string {
  if (node.kind === 'section') return getSectionLevelName(node.sectionLevel);
  return node.kind;
}

function getStarLabel(node: LayoutNode): string {
  return node.kind === 'command' ? 'Starred command' : 'Starred section';
}

export default function TreeNode({ node, onSelectNode }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isFolder = Boolean(node.children?.length);
  const displayData = getDisplayData(node);
  const displayType = getDisplayType(node);

  return (
    <div
      className="AstTreeNode"
      role="treeitem"
      aria-expanded={isFolder ? open : undefined}
      aria-selected={false}
    >
      <div className="AstTreeRow">
        {isFolder ? (
          <button
            type="button"
            className="AstTreeRowToggle"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Collapse node' : 'Expand node'}
            title={open ? 'Collapse' : 'Expand'}
          >
            <span className="AstTreeChevron" aria-hidden="true">
              {open ? '⌄' : '›'}
            </span>
          </button>
        ) : (
          <span className="AstTreeChevron AstTreeChevron--spacer" aria-hidden="true" />
        )}

        <button
          type="button"
          className="AstTreeRowMain"
          onClick={() => {
            onSelectNode?.(node);
          }}
        >
          <span className={`AstTreeIcon AstTreeIcon--${node.kind}`} aria-hidden="true">
            {node.icon}
          </span>
          <span className="AstTreeType">
            {displayType}
            {node.isStarred ? (
              <span className="AstTreeTypeStar" aria-label={getStarLabel(node)}>
                *
              </span>
            ) : null}
          </span>
          {displayData ? <span className="AstTreeData">{displayData}</span> : null}
          <span className="AstTreeLine">{getNodeLine(node)}</span>
        </button>
      </div>

      {isFolder && open ? (
        <div className="AstTreeChildren">
          {node.children?.map((child) => (
            <TreeNode key={child.id} node={child} onSelectNode={onSelectNode} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
