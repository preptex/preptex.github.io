import {
  AstNode,
  CommentNode,
  CommandNode,
  ConditionBranchNode,
  ConditionDeclarationNode,
  ConditionNode,
  EnvironmentNode,
  InputNode,
  MathNode,
  NodeType,
  SectionNode,
  TextNode,
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
      kind: info.kind,
      data: info.data,
      line: node.line,
      icon: info.icon,
      x: 0,
      y: 0,
      label: info.label,
      sublabel: info.sublabel,
      children,
    };
  }

  private getNodeInfo(data: AstNode): {
    kind: string;
    icon: string;
    data?: string;
    label?: string;
    sublabel?: string;
    sectionLevel?: number;
  } {
    switch (data.type) {
      case NodeType.Root:
        return {
          kind: 'root',
          icon: 'R',
          label: 'Root',
          sublabel: 'document',
        };

      case NodeType.Text: {
        const t = data as TextNode;
        return {
          kind: 'text',
          icon: 'T',
          data: t.value.trim(),
          label: t.value.trim(),
          sublabel: 'text',
        };
      }

      case NodeType.Comment: {
        const c = data as CommentNode;
        return {
          kind: 'comment',
          icon: '%',
          data: c.value.trim(),
          label: c.value.trim(),
          sublabel: 'comment',
        };
      }

      case NodeType.Section: {
        const s = data as SectionNode;
        return {
          kind: 'section',
          icon: 'S',
          data: s.name,
          label: s.name || 'section',
          sublabel: `section L${s.level}`,
          sectionLevel: s.level,
        };
      }

      case NodeType.Environment: {
        const e = data as EnvironmentNode;
        return {
          kind: 'environment',
          icon: 'E',
          data: e.name,
          label: e.name || 'env',
          sublabel: 'environment',
        };
      }

      case NodeType.Command: {
        const c = data as CommandNode;
        return {
          kind: 'command',
          icon: '\\',
          data: c.name,
          label: `\\${c.name}`,
          sublabel: 'command',
        };
      }

      case NodeType.Condition: {
        const c = data as ConditionNode;
        return {
          kind: 'condition',
          icon: '?',
          data: c.name,
          label: c.name,
          sublabel: 'if',
        };
      }

      case NodeType.ConditionBranch: {
        const b = data as ConditionBranchNode;
        return {
          kind: b.branch.toLowerCase(),
          icon: b.branch === 'If' ? 'I' : 'L',
          data: b.name,
          label: b.branch,
          sublabel: b.name,
        };
      }

      case NodeType.ConditionDeclaration: {
        const d = data as ConditionDeclarationNode;
        return {
          kind: 'condition',
          icon: 'D',
          data: d.name || d.value,
          label: d.name,
          sublabel: 'declare',
        };
      }

      case NodeType.Math: {
        const m = data as MathNode;
        return {
          kind: 'math',
          icon: 'M',
          data: m.delim,
          label: m.delim,
          sublabel: 'math',
        };
      }

      case NodeType.Group:
        return {
          kind: 'group',
          icon: '{',
          label: 'group',
          sublabel: 'group',
        };

      case NodeType.Input: {
        const i = data as InputNode;
        return {
          kind: 'input',
          icon: '@',
          data: i.path || i.value,
          label: i.path || i.value,
          sublabel: 'input',
        };
      }

      default:
        return {
          kind: String(data.type).toLowerCase(),
          icon: '*',
        };
    }
  }
}
