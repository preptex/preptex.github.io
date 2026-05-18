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

function getSectionLevelName(level: number): string {
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
      sectionLevel: info.sectionLevel,
      isStarred: info.isStarred,
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
    isStarred?: boolean;
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
        const sectionName = getSectionLevelName(s.level);
        const isDocumentSection = s.level === 0 && s.name === 'document';
        return {
          kind: 'section',
          icon: 'S',
          data: isDocumentSection ? undefined : s.name,
          label: isDocumentSection ? sectionName : s.name || 'section',
          sublabel: isDocumentSection ? undefined : `${sectionName}${s.is_starred ? '*' : ''}`,
          sectionLevel: s.level,
          isStarred: Boolean(s.is_starred),
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
          label: `\\${c.name}${c.is_starred ? '*' : ''}`,
          sublabel: `command${c.is_starred ? '*' : ''}`,
          isStarred: Boolean(c.is_starred),
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
