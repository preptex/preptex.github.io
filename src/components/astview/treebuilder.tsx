import { isConfiguredContainerNode } from '@preptex/core';
import type { ConfiguredNode, SourceToken } from '@preptex/core';
import type { LayoutNode, LayoutNodeKind, LayoutSectionLevel } from '../../types/LayoutNode';

interface ConfiguredNodeInfo {
  readonly kind: LayoutNodeKind;
  readonly icon: string;
  readonly data?: string;
  readonly label?: string;
  readonly sublabel?: string;
  readonly sectionLevel?: LayoutSectionLevel;
  readonly isStarred?: boolean;
}

function getSectionLevelName(level: LayoutSectionLevel): string {
  const names: Record<LayoutSectionLevel, string> = {
    1: 'section',
    2: 'subsection',
    3: 'subsubsection',
    4: 'paragraph',
    5: 'subparagraph',
  };
  return names[level];
}

function assertNever(node: never): never {
  throw new Error('Unsupported PrepTeX ConfiguredNode: ' + JSON.stringify(node));
}

export class TreeLayoutBuilder {
  buildConfigured(rootNode: ConfiguredNode): LayoutNode {
    return this.convertConfigured(rootNode);
  }

  buildSourceTokens(filePath: string, tokens: readonly SourceToken[]): LayoutNode {
    const children: LayoutNode[] = tokens.map((token, index) => {
      const kind = this.mapTokenKindToLayoutKind(token.kind);
      const val = token.kind === 'command' ? token.name : token.value.trim();
      return {
        id: `${filePath}-token-${index}-${token.range.start}`,
        kind,
        icon: this.iconForTokenKind(token.kind),
        data: val || undefined,
        line: token.range.line,
        range: token.range,
        path: filePath,
        label: token.kind === 'command' ? `\\${token.name}` : token.value.trim() || token.kind,
        sublabel: token.kind,
        strokeWidth: 1,
        x: 0,
        y: 0,
        children: [],
      };
    });

    return {
      id: `${filePath}-source-root`,
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

  private getConfiguredNodeInfo(node: ConfiguredNode): ConfiguredNodeInfo {
    switch (node.kind) {
      case 'root':
        return { kind: 'root', icon: 'R', label: 'Root', sublabel: 'document' };
      case 'environment':
        return {
          kind: 'environment',
          icon: 'E',
          data: node.name,
          label: node.name || 'env',
          sublabel: 'environment',
        };
      case 'section':
        return {
          kind: 'section',
          icon: 'S',
          data: node.name,
          label: node.name || 'section',
          sublabel: getSectionLevelName(node.level) + (node.starred ? '*' : ''),
          sectionLevel: node.level,
          isStarred: node.starred,
        };
      case 'command':
        return {
          kind: 'command',
          icon: '\\',
          data: node.name,
          label: `\\${node.name}${node.starred ? '*' : ''}`,
          sublabel: 'command',
          isStarred: node.starred,
        };
      case 'group':
        return { kind: 'group', icon: '{', label: 'group', sublabel: 'group' };
      case 'math':
        return {
          kind: 'math',
          icon: 'M',
          data: node.delimiter,
          label: node.delimiter,
          sublabel: 'math',
        };
      case 'token': {
        const token = node.token;
        const kind = this.mapTokenKindToLayoutKind(token.kind);
        const icon = this.iconForTokenKind(token.kind);
        const data = token.kind === 'command' ? token.name : token.value.trim();
        return {
          kind,
          icon,
          data: data || undefined,
          label: token.kind === 'command' ? `\\${token.name}` : token.value.trim() || token.kind,
          sublabel: token.kind,
        };
      }
      default:
        return assertNever(node);
    }
  }

  private mapTokenKindToLayoutKind(tokenKind: SourceToken['kind']): LayoutNodeKind {
    switch (tokenKind) {
      case 'command':
        return 'command';
      case 'comment':
        return 'comment';
      case 'text':
        return 'text';
      case 'space':
        return 'space';
      case 'math':
        return 'math';
      case 'open':
      case 'close':
        return 'token';
    }
  }

  private iconForTokenKind(tokenKind: SourceToken['kind']): string {
    switch (tokenKind) {
      case 'text':
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
    }
  }
}
