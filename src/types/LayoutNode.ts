export interface LayoutNode {
  type: string;
  /** Normalized display type, e.g. section, text, if, else. */
  kind: string;
  /** Normalized node payload displayed after the type. */
  data?: string;
  /** 1-based source line number. */
  line?: number;
  /** Small temporary visual marker for the node type. */
  icon: string;
  x: number;
  y: number;
  /** Primary label to display inside the node (e.g. section/env name). */
  label?: string;
  /** Secondary label line (optional). */
  sublabel?: string;
  /** LaTeX section nesting level, where 0 is document and 5 is subparagraph. */
  sectionLevel?: number;
  /** True when the source command or section used the starred form. */
  isStarred?: boolean;
  id: number;
  strokeWidth: number;
  strokeColor?: string;
  children?: LayoutNode[];
}
