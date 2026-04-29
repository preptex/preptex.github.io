import { LayoutNode } from '../../types/LayoutNode';
import TreeNode from './TreeNode';

interface ASTviewProps {
  root?: LayoutNode | null;
  onSelectNode?: (node: LayoutNode) => void;
}

export default function ASTview({ root, onSelectNode }: ASTviewProps) {
  return (
    <section className="AstTree" aria-label="AST tree">
      <h2>AST View</h2>
      <div className="AstTreeList" role="tree">
        {root ? (
          <TreeNode node={root} onSelectNode={onSelectNode} />
        ) : (
          <div className="AstTreeEmpty">Select a file to inspect its structure.</div>
        )}
      </div>
    </section>
  );
}
