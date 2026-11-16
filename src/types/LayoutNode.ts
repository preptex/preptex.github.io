import type { CoarseNode, NodeLocation, SourceRange } from '@preptex/core';

export const LAYOUT_NODE_KINDS = [
  'root',
  'section',
  'environment',
  'group',
  'math',
  'command',
  'argument',
  'text-block',
  'comment',
  'text',
  'space',
  'token',
] as const;

export type LayoutNodeKind = typeof LAYOUT_NODE_KINDS[number];

export type LayoutSectionLevel = 1 | 2 | 3 | 4 | 5;

export function isLayoutNodeKind(value: string): value is LayoutNodeKind {
  return LAYOUT_NODE_KINDS.some((kind) => kind === value);
}

/** Website display data; never attach layout or UI state to the core AST. */
export interface LayoutNode {
  readonly kind: LayoutNodeKind;
  readonly data?: string;
  /** One-based source line in the selected input file. */
  readonly line: number;
  readonly range?: SourceRange;
  readonly path?: string;
  readonly icon: string;
  readonly x: number;
  readonly y: number;
  readonly label?: string;
  readonly sublabel?: string;
  readonly sectionLevel?: LayoutSectionLevel;
  readonly isStarred?: boolean;
  readonly editableName?: boolean;
  readonly argumentInfo?: CoarseNode['argumentInfo'];
  readonly previewText?: string;
  readonly id: string;
  readonly occurrenceKey?: string;
  readonly location?: NodeLocation;
  readonly strokeWidth: number;
  readonly strokeColor?: string;
  readonly children: readonly LayoutNode[];
}
