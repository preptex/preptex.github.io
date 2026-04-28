import { useState } from 'react';
import { LayoutNode } from '../../types/LayoutNode';

interface TreeNodeProps {
  node: LayoutNode;
  depth: number;
}

function clamp(value: string, max = 48): string {
  return value.length > max ? value.slice(0, Math.max(0, max - 3)) + '...' : value;
}

function getNodeName(node: LayoutNode): string {
  return node.label || node.type;
}

function getNodeMeta(node: LayoutNode): string {
  return node.sublabel || node.type;
}

export default function TreeNode({ node, depth }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isFolder = Boolean(node.children?.length);

  return (
    <div
      className="AstTreeNode"
      role="treeitem"
      aria-expanded={isFolder ? open : undefined}
      aria-selected={false}
    >
      <button
        type="button"
        className="AstTreeRow"
        onClick={() => {
          if (isFolder) setOpen((value) => !value);
        }}
      >
        <span className="AstTreeIndent" style={{ width: depth * 14 }} aria-hidden="true" />
        <span className="AstTreeChevron" aria-hidden="true">
          {isFolder ? (open ? 'v' : '>') : ''}
        </span>
        <span className="AstTreeName">{clamp(getNodeName(node))}</span>
        <span className="AstTreeMeta">{clamp(getNodeMeta(node), 28)}</span>
      </button>

      {isFolder && open
        ? node.children?.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))
        : null}
    </div>
  );
}
