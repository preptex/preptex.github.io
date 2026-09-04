import type { NodeId, NodeType, SectionLevel } from '@preptex/core';

export const LAYOUT_NODE_KINDS = [
  'root', 'section', 'environment', 'condition', 'if', 'else', 'text',
  'newline', 'comment', 'command', 'math', 'group', 'input',
] as const;

export type LayoutNodeKind = typeof LAYOUT_NODE_KINDS[number];

export function isLayoutNodeKind(value: string): value is LayoutNodeKind {
  return LAYOUT_NODE_KINDS.some((kind) => kind === value);
}

/** Website display data; never attach layout or UI state to the core AST. */
export interface LayoutNode {
  readonly type: NodeType;
  readonly kind: LayoutNodeKind;
  readonly data?: string;
  /** One-based source line in the selected input file. */
  readonly line: number;
  readonly icon: string;
  readonly x: number;
  readonly y: number;
  readonly label?: string;
  readonly sublabel?: string;
  readonly sectionLevel?: SectionLevel;
  readonly isStarred?: boolean;
  readonly id: NodeId;
  readonly strokeWidth: number;
  readonly strokeColor?: string;
  readonly children: readonly LayoutNode[];
}
