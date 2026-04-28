import {
  AstNode,
  CommandNode,
  ConditionBranchNode,
  ConditionDeclarationNode,
  ConditionNode,
  EnvironmentNode,
  NodeType,
  SectionNode,
} from '@preptex/core';
import { LayoutNode } from '../../types/LayoutNode';

function sectionStrokeWidth(node?: AstNode): { strokeWidth: number; strokeColor?: string } {
  if (!node || ![NodeType.Root, NodeType.Section].includes(node.type)) return { strokeWidth: 1 };
  if (node.type === NodeType.Root || (node as SectionNode).level === 0) {
    return { strokeWidth: 1.5, strokeColor: '#000' };
  }
  if ((node as SectionNode).level <= 3) return { strokeWidth: 1.5, strokeColor: '#AAAAAAff' };
  return { strokeWidth: 1 };
}

export class TreeLayoutBuilder {
  build(rootNode: AstNode): LayoutNode {
    return this.convert(rootNode);
  }

  private convert(node: AstNode): LayoutNode {
    const info = this.getNodeInfo(node);
    const strokeInfo = sectionStrokeWidth(node);
    const children = Array.isArray((node as any).children)
      ? ((node as any).children as AstNode[]).map((child) => this.convert(child))
      : [];

    return {
      ...strokeInfo,
      id: node.id,
      type: node.type,
      x: 0,
      y: 0,
      label: info.label,
      sublabel: info.sublabel,
      children,
    };
  }

  private getNodeInfo(data: AstNode): { label?: string; sublabel?: string; sectionLevel?: number } {
    switch (data.type) {
      case NodeType.Section: {
        const s = data as SectionNode;
        return {
          label: s.name || 'section',
          sublabel: `section L${s.level}`,
          sectionLevel: s.level,
        };
      }

      case NodeType.Environment: {
        const e = data as EnvironmentNode;
        return {
          label: e.name || 'env',
          sublabel: 'environment',
        };
      }

      case NodeType.Command: {
        const c = data as CommandNode;
        return {
          label: `\\${c.name}`,
          sublabel: 'command',
        };
      }

      case NodeType.Condition: {
        const c = data as ConditionNode;
        return {
          label: c.name,
          sublabel: 'if',
        };
      }

      case NodeType.ConditionBranch: {
        const b = data as ConditionBranchNode;
        return {
          label: b.branch,
          sublabel: b.name,
        };
      }

      case NodeType.ConditionDeclaration: {
        const d = data as ConditionDeclarationNode;
        return {
          label: d.name,
          sublabel: 'declare',
        };
      }

      default:
        return {};
    }
  }
}
