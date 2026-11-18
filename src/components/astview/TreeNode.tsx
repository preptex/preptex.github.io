import { useEffect, useId, useRef, useState } from 'react';
import { LayoutNode } from '../../types/LayoutNode';

interface TreeNodeProps {
  node: LayoutNode;
  onSelectNode?: (node: LayoutNode) => void;
  selectedNodeKey?: string | null;
}

function clamp(value = '', max = 64): string {
  return value.length > max ? value.slice(0, Math.max(0, max - 3)) + '...' : value;
}

function getSectionLevelName(level?: number): string {
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

function getNodeTypeHint(node: LayoutNode): string {
  switch (node.kind) {
    case 'root':
      return 'document root';
    case 'section':
      return `${getSectionLevelName(node.sectionLevel)}${node.isStarred ? '*' : ''}`;
    case 'environment':
      return 'environment';
    case 'command':
      return node.isStarred ? 'starred command' : 'command';
    case 'argument':
      if (node.argumentInfo?.argKind === 'optional' || node.icon === '[]') {
        return 'optional argument';
      }
      if (node.argumentInfo?.argKind === 'mandatory' || node.icon === '{}') {
        return 'mandatory argument';
      }
      return 'argument';
    case 'math':
      return 'math';
    case 'group':
      return 'brace group';
    case 'text-block':
      return 'text block';
    case 'text':
      return 'text';
    case 'comment':
      return 'comment';
    case 'space':
      return 'whitespace';
    case 'token':
      return node.sublabel ? `token (${node.sublabel})` : 'token';
  }
}

interface NodeDisplayText {
  readonly name: string;
  readonly furtherData?: string;
}

function stripTrailingStar(value: string, isStarred?: boolean): string {
  return isStarred && value.endsWith('*') ? value.slice(0, -1) : value;
}

function getNodeDisplayText(node: LayoutNode): NodeDisplayText {
  switch (node.kind) {
    case 'root': {
      const name =
        node.label && node.label !== 'Root'
          ? node.label
          : node.path || 'Document';
      const furtherData =
        node.sublabel && node.sublabel !== 'document' && node.sublabel !== name
          ? node.sublabel
          : undefined;
      return { name: clamp(name), furtherData };
    }
    case 'section': {
      const fallback = getSectionLevelName(node.sectionLevel);
      const raw = stripTrailingStar(node.data || fallback, node.isStarred);
      const furtherData =
        node.previewText && node.previewText !== raw ? clamp(node.previewText) : undefined;
      return { name: clamp(raw), furtherData };
    }
    case 'environment': {
      const name = node.data || 'environment';
      const furtherData =
        node.previewText && node.previewText !== name ? clamp(node.previewText) : undefined;
      return { name: clamp(name), furtherData };
    }
    case 'command': {
      const raw = stripTrailingStar(node.data || 'command', node.isStarred);
      const name = raw.startsWith('\\') ? raw : `\\${raw}`;
      const furtherData = node.previewText ? clamp(node.previewText) : undefined;
      return { name: clamp(name), furtherData };
    }
    case 'argument': {
      if (node.previewText) {
        const slot =
          node.sublabel && node.sublabel !== node.previewText ? node.sublabel : undefined;
        return { name: clamp(node.previewText), furtherData: slot };
      }
      const fallbackName =
        node.sublabel || (node.data && node.data !== node.sublabel ? node.data : '') || 'argument';
      return { name: clamp(fallbackName) };
    }
    case 'math': {
      const name = node.previewText || node.data || 'math';
      const furtherData =
        node.previewText && node.label && node.label !== node.previewText
          ? clamp(node.label)
          : undefined;
      return { name: clamp(name), furtherData };
    }
    case 'group': {
      return { name: clamp(node.previewText || node.data || '{ … }') };
    }
    case 'text-block':
    case 'text': {
      return { name: clamp(node.previewText || node.data || node.label || 'text') };
    }
    case 'comment': {
      return { name: clamp(node.data || node.label || '%') };
    }
    case 'space':
    case 'token': {
      const name = node.data || node.label || node.kind;
      const furtherData =
        node.sublabel && node.sublabel !== node.kind && node.sublabel !== name
          ? node.sublabel
          : undefined;
      return { name: clamp(name), furtherData };
    }
  }
}

function getNodeLine(node: LayoutNode): string {
  return typeof node.line === 'number' && Number.isFinite(node.line) ? `l${node.line}` : '';
}

function getStarLabel(node: LayoutNode): string {
  return node.kind === 'command' ? 'Starred command' : 'Starred section';
}

function AstNodeLogo({ node }: { readonly node: LayoutNode }) {
  switch (node.kind) {
    case 'root':
      return (
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <path
            d="M4 2.25h5.25L12.75 5.75v8A.75.75 0 0 1 12 14.5H4a.75.75 0 0 1-.75-.75V3A.75.75 0 0 1 4 2.25Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M9 2.5v3.5h3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'section':
      return (
        <span className="AstTreeIconSection" aria-hidden="true">
          §{node.sectionLevel ?? ''}
        </span>
      );
    case 'environment':
      return (
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <rect
            x="2.5"
            y="2.75"
            width="11"
            height="10.5"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M5.5 6.25h5M5.5 9.75h3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'command':
      return <span aria-hidden="true">\</span>;
    case 'argument':
      return (
        <span aria-hidden="true">
          {node.argumentInfo?.argKind === 'optional' || node.icon === '[]' ? '[]' : '{}'}
        </span>
      );
    case 'math':
      return <span aria-hidden="true">∑</span>;
    case 'group':
      return <span aria-hidden="true">{'{}'}</span>;
    case 'text-block':
    case 'text':
      return (
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <path
            d="M3 4.25h10M3 8h10M3 11.75h6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'comment':
      return <span aria-hidden="true">%</span>;
    case 'space':
      return <span aria-hidden="true">␣</span>;
    case 'token':
      return <span aria-hidden="true">‹›</span>;
  }
}

interface HintCoords {
  readonly top: number;
  readonly left: number;
  readonly placeBelow: boolean;
}

export default function TreeNode({ node, onSelectNode, selectedNodeKey }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintCoords, setHintCoords] = useState<HintCoords | null>(null);
  const iconWrapRef = useRef<HTMLSpanElement | null>(null);
  const hintRef = useRef<HTMLSpanElement | null>(null);
  const hintId = useId();

  const isFolder = Boolean(node.children?.length);
  const { name, furtherData } = getNodeDisplayText(node);
  const typeHint = getNodeTypeHint(node);
  const lineMeta = getNodeLine(node);
  const isSelected = Boolean(selectedNodeKey && node.occurrenceKey === selectedNodeKey);

  const showTypeHint = () => {
    const el = iconWrapRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        const placeBelow = rect.top < 44;
        setHintCoords({
          top: placeBelow ? rect.bottom + 6 : rect.top - 6,
          left: rect.left,
          placeBelow,
        });
      } else {
        setHintCoords(null);
      }
    }
    setHintOpen(true);
  };

  const hideTypeHint = () => {
    setHintOpen(false);
  };

  useEffect(() => {
    if (!hintOpen) return;

    const hintEl = hintRef.current;
    if (hintEl && 'showPopover' in hintEl && typeof hintEl.showPopover === 'function') {
      try {
        hintEl.showPopover();
      } catch {
        // Browsers without top-layer popover support fall back cleanly to fixed/CSS positioning.
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHintOpen(false);
      }
    };
    const onScroll = () => {
      setHintOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      if (hintEl && 'hidePopover' in hintEl && typeof hintEl.hidePopover === 'function') {
        try {
          hintEl.hidePopover();
        } catch {
          // Ignore if already closed.
        }
      }
    };
  }, [hintOpen]);

  return (
    <div
      className="AstTreeNode"
      role="treeitem"
      aria-expanded={isFolder ? open : undefined}
      aria-selected={isSelected}
    >
      <div className={`AstTreeRow ${isSelected ? 'AstTreeRow--selected' : ''}`}>
        {isFolder ? (
          <button
            type="button"
            className="AstTreeRowToggle"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Collapse node' : 'Expand node'}
            title={open ? 'Collapse' : 'Expand'}
          >
            <span className="AstTreeChevron" aria-hidden="true">
              {open ? '⌄' : '›'}
            </span>
          </button>
        ) : (
          <span className="AstTreeChevron AstTreeChevron--spacer" aria-hidden="true" />
        )}

        <span
          ref={iconWrapRef}
          className={`AstTreeIconWrap${hintOpen ? ' AstTreeIconWrap--hint-open' : ''}`}
          onMouseEnter={showTypeHint}
          onMouseLeave={hideTypeHint}
        >
          <span
            className={`AstTreeIcon AstTreeIcon--${node.kind}`}
            aria-label={typeHint}
            aria-describedby={hintOpen ? hintId : undefined}
          >
            <AstNodeLogo node={node} />
          </span>
          <span
            ref={hintRef}
            id={hintId}
            role="tooltip"
            {...({ popover: 'hint' } as Record<string, string>)}
            className={`AstTreeTypeHint${hintCoords?.placeBelow ? ' AstTreeTypeHint--below' : ''}${
              hintOpen ? ' is-open' : ''
            }`}
            style={
              hintCoords
                ? {
                    position: 'fixed',
                    top: `${hintCoords.top}px`,
                    left: `${hintCoords.left}px`,
                    bottom: 'auto',
                    transform: hintCoords.placeBelow ? 'none' : 'translateY(-100%)',
                  }
                : undefined
            }
          >
            {typeHint}
          </span>
        </span>

        <button
          type="button"
          className="AstTreeRowMain"
          onClick={() => {
            onSelectNode?.(node);
          }}
        >
          <span className="AstTreeName">
            {name}
            {node.isStarred ? (
              <span className="AstTreeTypeStar" aria-label={getStarLabel(node)}>
                *
              </span>
            ) : null}
          </span>
          {furtherData ? <span className="AstTreeData">{furtherData}</span> : null}
          {lineMeta ? <span className="AstTreeLine">{lineMeta}</span> : null}
        </button>
      </div>

      {isFolder && open ? (
        <div className="AstTreeChildren">
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelectNode={onSelectNode}
              selectedNodeKey={selectedNodeKey}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
