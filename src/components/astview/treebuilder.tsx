import {
  ConditionBranchKind,
  isConfiguredContainerNode,
  isContainerNode,
  NodeType,
} from '@preptex/core';
import type {
  AstNode,
  ConfiguredNode,
  SectionLevel,
  SourceToken,
} from '@preptex/core';
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
  return names[level] ?? 'section';
}

function assertNever(node: never): never {
  throw new Error('Unsupported PrepTeX AST node: ' + JSON.stringify(node));
}

export class TreeLayoutBuilder {
  build(rootNode: AstNode): LayoutNode {
    return this.convert(rootNode);
  }

  buildConfigured(rootNode: ConfiguredNode): LayoutNode {
    return this.convertConfigured(rootNode);
  }

  buildSourceTokens(filePath: string, tokens: readonly SourceToken[]): LayoutNode {
    const children: LayoutNode[] = tokens.map((token, index) => {
      const line = token.range.line;
      return {
        id: `${filePath}-token-${index}-${token.range.start}`,
        type: this.mapTokenKindToNodeType(token.kind),
        kind: 'token',
        icon: this.iconForTokenKind(token.kind),
        line,
        range: token.range,
        path: filePath,
        label: token.value.trim() || token.kind,
        sublabel: token.kind,
        strokeWidth: 1,
        x: 0,
        y: 0,
        children: [],
      };
    });

    return {
      id: `${filePath}-source-root`,
      type: NodeType.Root,
      kind: 'root',
      icon: 'F',
      line: 1,
      path: filePath,
      label: filePath,
      sublabel: `${tokens.length} tokens`,
      strokeWidth: 1.5,
      strokeColor: '#000',
      x: 0,
      y: 0,
      children,
    };
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

  private convertConfigured(node: ConfiguredNode): LayoutNode {
    const primary = node.location.primary;
    const line = primary?.range.line ?? 1;
    const range = primary?.range;
    const path = primary?.path;

    const info = this.getConfiguredNodeInfo(node);
    const isRoot = node.kind === 'root';
    const isTopSection = node.kind === 'section' && node.level === 1;

    return {
      id: node.occurrenceKey,
      occurrenceKey: node.occurrenceKey,
      location: node.location,
      type: info.type,
      kind: info.kind,
      icon: info.icon,
      data: info.data,
      label: info.label,
      sublabel: info.sublabel,
      sectionLevel: info.sectionLevel,
      isStarred: info.isStarred,
      line,
      range,
      path,
      strokeWidth: isRoot || isTopSection ? 1.5 : 1,
      strokeColor: isRoot ? '#000' : undefined,
      x: 0,
      y: 0,
      children: isConfiguredContainerNode(node)
        ? node.children.map((child) => this.convertConfigured(child))
        : [],
    };
  }

  private getConfiguredNodeInfo(node: ConfiguredNode): NodeInfo & { type: NodeType } {
    switch (node.kind) {
      case 'root':
        return { type: NodeType.Root, kind: 'root', icon: 'R', label: 'Root', sublabel: 'document' };
      case 'environment':
        return {
          type: NodeType.Environment,
          kind: 'environment',
          icon: 'E',
          data: node.name,
          label: node.name || 'env',
          sublabel: 'environment',
        };
      case 'section':
        return {
          type: NodeType.Section,
          kind: 'section',
          icon: 'S',
          data: node.name,
          label: node.name || 'section',
          sublabel: getSectionLevelName(node.level) + (node.starred ? '*' : ''),
          sectionLevel: node.level,
          isStarred: node.starred,
        };
      case 'group':
        return { type: NodeType.Group, kind: 'group', icon: '{', label: 'group', sublabel: 'group' };
      case 'math':
        return {
          type: NodeType.Math,
          kind: 'math',
          icon: 'M',
          data: node.delimiter,
          label: node.delimiter,
          sublabel: 'math',
        };
      case 'token': {
        const token = node.token;
        const nodeType = this.mapTokenKindToNodeType(token.kind);
        const icon = this.iconForTokenKind(token.kind);
        const val = token.value.trim();
        return {
          type: nodeType,
          kind: 'token',
          icon,
          data: val,
          label: val || token.kind,
          sublabel: token.kind,
        };
      }
    }
  }

  private mapTokenKindToNodeType(tokenKind: SourceToken['kind']): NodeType {
    switch (tokenKind) {
      case 'text':
      case 'verbatim':
        return NodeType.Text;
      case 'space':
        return NodeType.NewLine;
      case 'command':
        return NodeType.Command;
      case 'comment':
        return NodeType.Comment;
      case 'math':
        return NodeType.Math;
      case 'open':
      case 'close':
        return NodeType.Group;
      default:
        return NodeType.Text;
    }
  }

  private iconForTokenKind(tokenKind: SourceToken['kind']): string {
    switch (tokenKind) {
      case 'text':
      case 'verbatim':
        return 'T';
      case 'space':
        return '␣';
      case 'command':
        return '\\';
      case 'comment':
        return '%';
      case 'math':
        return 'M';
      case 'open':
      case 'close':
        return '{';
      default:
        return '•';
    }
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
