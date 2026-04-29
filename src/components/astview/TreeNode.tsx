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
  return clamp(node.data || node.label || '');
}

function getNodeLine(node: LayoutNode): string {
  return typeof node.line === 'number' && Number.isFinite(node.line) ? `: l${node.line}` : '';
}

export default function TreeNode({ node, onSelectNode }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isFolder = Boolean(node.children?.length);
  const displayData = getDisplayData(node);

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
          <span className="AstTreeType">{node.kind}</span>
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
