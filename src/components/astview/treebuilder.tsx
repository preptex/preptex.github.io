import { ConditionBranchKind, isContainerNode, NodeType } from '@preptex/core';
import type { AstNode, SectionLevel } from '@preptex/core';
import type { LayoutNode, LayoutNodeKind } from '../../types/LayoutNode';

interface NodeInfo {
  readonly kind: LayoutNodeKind;
  readonly icon: string;
  readonly data?: string;
  readonly label?: string;
  readonly sublabel?: string;
  readonly sectionLevel?: SectionLevel;
  readonly isStarred?: boolean;
}

function sectionStrokeWidth(node: AstNode): { strokeWidth: number; strokeColor?: string } {
  if (node.type === NodeType.Root || (node.type === NodeType.Section && node.level === 0)) {
    return { strokeWidth: 1.5, strokeColor: '#000' };
  }
  if (node.type === NodeType.Section && node.level <= 3) {
    return { strokeWidth: 1.5, strokeColor: '#AAAAAAff' };
  }
  return { strokeWidth: 1 };
}

function getSectionLevelName(level: SectionLevel): string {
  const names: Record<SectionLevel, string> = {
    0: 'document', 1: 'section', 2: 'subsection',
    3: 'subsubsection', 4: 'paragraph', 5: 'subparagraph',
  };
  return names[level];
}

function assertNever(node: never): never {
  throw new Error('Unsupported PrepTeX AST node.');
}

export class TreeLayoutBuilder {
  build(rootNode: AstNode): LayoutNode {
    return this.convert(rootNode);
  }

  private convert(node: AstNode): LayoutNode {
    return {
      ...sectionStrokeWidth(node),
      ...this.getNodeInfo(node),
      id: node.id,
      type: node.type,
      line: node.line,
      x: 0,
      y: 0,
      children: isContainerNode(node) ? node.children.map((child) => this.convert(child)) : [],
    };
  }

  private getNodeInfo(node: AstNode): NodeInfo {
    switch (node.type) {
      case NodeType.Root:
        return { kind: 'root', icon: 'R', label: 'Root', sublabel: 'document' };
      case NodeType.Text:
        return { kind: 'text', icon: 'T', data: node.value.trim(), label: node.value.trim(), sublabel: 'text' };
      case NodeType.NewLine:
        return { kind: 'newline', icon: '↵', label: 'newline' };
      case NodeType.Comment:
        return { kind: 'comment', icon: '%', data: node.value.trim(), label: node.value.trim(), sublabel: 'comment' };
      case NodeType.Section: {
        const sectionName = getSectionLevelName(node.level);
        const isDocument = node.level === 0 && node.name === 'document';
        return {
          kind: 'section',
          icon: 'S',
          data: isDocument ? undefined : node.name,
          label: isDocument ? sectionName : node.name || 'section',
          sublabel: isDocument ? undefined : sectionName + (node.starred ? '*' : ''),
          sectionLevel: node.level,
          isStarred: node.starred,
        };
      }
      case NodeType.Environment:
        return { kind: 'environment', icon: 'E', data: node.name, label: node.name || 'env', sublabel: 'environment' };
      case NodeType.Command:
        return {
          kind: 'command', icon: '\\', data: node.name,
          label: '\\' + node.name + (node.starred ? '*' : ''),
          sublabel: 'command' + (node.starred ? '*' : ''), isStarred: node.starred,
        };
      case NodeType.Condition:
        return { kind: 'condition', icon: '?', data: node.name, label: node.name, sublabel: 'if' };
      case NodeType.ConditionBranch:
        return {
          kind: node.branch === ConditionBranchKind.If ? 'if' : 'else',
          icon: node.branch === ConditionBranchKind.If ? 'I' : 'L',
          data: node.name, label: node.branch, sublabel: node.name,
        };
      case NodeType.ConditionDeclaration:
        return { kind: 'condition', icon: 'D', data: node.name || node.value, label: node.name, sublabel: 'declare' };
      case NodeType.Math:
        return { kind: 'math', icon: 'M', data: node.delimiter, label: node.delimiter, sublabel: 'math' };
      case NodeType.Group:
        return { kind: 'group', icon: '{', label: 'group', sublabel: 'group' };
      case NodeType.Input:
        return { kind: 'input', icon: '@', data: node.path, label: node.path, sublabel: 'input' };
      default:
        return assertNever(node);
    }
  }
}
