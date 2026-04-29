import { LayoutNode } from '../../types/LayoutNode';
import TreeNode from './TreeNode';

interface ASTviewProps {
  root?: LayoutNode | null;
  onSelectNode?: (node: LayoutNode) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function ASTview({ root, onSelectNode, collapsed, onToggleCollapsed }: ASTviewProps) {
  return (
    <section
      className={`AstTree ${collapsed ? 'AstTree--collapsed' : ''}`}
      aria-label="AST tree"
    >
      <div className="AstTreeHeader">
        <h2>AST View</h2>
        <button
          type="button"
          className="AstTreeToggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand AST view' : 'Collapse AST view'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {collapsed ? null : (
        <div className="AstTreeList" role="tree">
          {root ? (
            <TreeNode node={root} onSelectNode={onSelectNode} />
          ) : (
            <div className="AstTreeEmpty">Select a file to inspect its structure.</div>
          )}
        </div>
      )}
    </section>
  );
}
