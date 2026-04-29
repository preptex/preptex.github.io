import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutNode } from '../../types/LayoutNode';
import TreeNode from './TreeNode';

interface ASTviewProps {
  root?: LayoutNode | null;
  onSelectNode?: (node: LayoutNode) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const STORAGE_KEY = 'preptex.astview.options.v4';

const DEFAULT_NODE_KINDS = [
  'root',
  'section',
  'environment',
  'condition',
  'if',
  'else',
  'text',
  'comment',
  'command',
  'math',
  'group',
  'input',
];

const DEFAULT_VISIBLE_NODE_KINDS = [
  'root',
  'section',
  'environment',
  'condition',
  'if',
  'else',
  'input',
  'text',
];
const DEFAULT_VISIBLE_COMMANDS = ['label', 'ref', 'cite', 'input', 'include', 'bibliography'];

type AstViewOptions = {
  visibleKinds: string[];
  commandCards: string[];
  selectedCommands: string[];
  userCommands: string[];
};

function normalizeCommandName(value: string): string {
  return value.trim().replace(/^\\+/, '').toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeCommandName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function loadOptions(): AstViewOptions {
  const fallback: AstViewOptions = {
    visibleKinds: DEFAULT_VISIBLE_NODE_KINDS,
    commandCards: DEFAULT_VISIBLE_COMMANDS,
    selectedCommands: DEFAULT_VISIBLE_COMMANDS,
    userCommands: [],
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AstViewOptions>;
    const commandCards = unique([...(parsed.commandCards ?? []), ...DEFAULT_VISIBLE_COMMANDS]);
    const selectedCommands = unique(parsed.selectedCommands ?? DEFAULT_VISIBLE_COMMANDS).filter(
      (name) => commandCards.includes(name),
    );

    return {
      visibleKinds: parsed.visibleKinds?.length ? parsed.visibleKinds : fallback.visibleKinds,
      commandCards,
      selectedCommands,
      userCommands: unique(parsed.userCommands ?? []).filter((name) => commandCards.includes(name)),
    };
  } catch {
    return fallback;
  }
}

function filterTree(node: LayoutNode, options: AstViewOptions): LayoutNode | null {
  const commandName = normalizeCommandName(node.data || node.label || '');
  const isVisibleCommand =
    node.kind !== 'command' || options.selectedCommands.includes(commandName);
  const isVisibleKind = options.visibleKinds.includes(node.kind);
  const shouldRender = isVisibleKind && isVisibleCommand;

  if (!shouldRender) return null;

  const visibleChildren = node.children
    ?.map((child) => filterTree(child, options))
    .filter((child): child is LayoutNode => Boolean(child));

  return {
    ...node,
    children: visibleChildren,
  };
}

export default function ASTview({ root, onSelectNode, collapsed, onToggleCollapsed }: ASTviewProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState<AstViewOptions>(() => loadOptions());
  const [newCommand, setNewCommand] = useState('');
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    if (!optionsOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && optionsRef.current?.contains(target)) return;
      setOptionsOpen(false);
    };

    window.addEventListener('pointerdown', closeOnOutsideClick);
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [optionsOpen]);

  const filteredRoot = useMemo(() => (root ? filterTree(root, options) : null), [root, options]);

  const toggleKind = (kind: string) => {
    setOptions((current) => {
      const visibleKinds = current.visibleKinds.includes(kind)
        ? current.visibleKinds.filter((item) => item !== kind)
        : [...current.visibleKinds, kind];
      return { ...current, visibleKinds };
    });
  };

  const toggleCommand = (command: string) => {
    setOptions((current) => {
      const selectedCommands = current.selectedCommands.includes(command)
        ? current.selectedCommands.filter((item) => item !== command)
        : [...current.selectedCommands, command];
      return { ...current, selectedCommands: unique(selectedCommands) };
    });
  };

  const deleteUserCommand = (event: MouseEvent<HTMLSpanElement>, command: string) => {
    event.stopPropagation();
    setOptions((current) => ({
      ...current,
      commandCards: current.commandCards.filter((item) => item !== command),
      selectedCommands: current.selectedCommands.filter((item) => item !== command),
      userCommands: current.userCommands.filter((item) => item !== command),
    }));
  };

  const addCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = normalizeCommandName(newCommand);
    if (!command) return;
    setOptions((current) => ({
      ...current,
      commandCards: unique([...current.commandCards, command]),
      selectedCommands: unique([...current.selectedCommands, command]),
      userCommands: unique([...current.userCommands, command]),
    }));
    setNewCommand('');
  };

  const resetToDefault = () => {
    setOptions((current) => ({
      ...current,
      visibleKinds: DEFAULT_VISIBLE_NODE_KINDS,
      selectedCommands: DEFAULT_VISIBLE_COMMANDS,
    }));
  };

  return (
    <section className={`AstTree ${collapsed ? 'AstTree--collapsed' : ''}`} aria-label="AST tree">
      <div className="AstTreeHeader">
        <h2>AST View</h2>
        <div className="AstTreeActions">
          {!collapsed ? (
            <div className="AstTreeOptionsWrap" ref={optionsRef}>
              <button
                type="button"
                className={`AstTreeToolButton ${optionsOpen ? 'AstTreeToolButton--active' : ''}`}
                onClick={() => setOptionsOpen((value) => !value)}
                aria-label="AST view options"
                aria-expanded={optionsOpen}
                title="Options"
              >
                &#9881;
              </button>

              {optionsOpen ? (
                <div className="AstTreeOptions" role="dialog" aria-label="AST view options">
                  <div className="AstTreeOptionsHeader">
                    <div className="AstTreeOptionsTitle">Options</div>
                    <button
                      type="button"
                      className="AstTreeOptionsReset"
                      onClick={resetToDefault}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="AstTreeOptionsSection">
                    <div className="AstTreeOptionsTitle">Node Types</div>
                    <div className="AstTreeOptionCards">
                      {DEFAULT_NODE_KINDS.map((kind) => {
                        const selected = options.visibleKinds.includes(kind);
                        return (
                          <button
                            key={kind}
                            type="button"
                            className={`AstTreeOptionCard ${
                              selected ? 'AstTreeOptionCard--selected' : ''
                            }`}
                            onClick={() => toggleKind(kind)}
                          >
                            {kind}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="AstTreeOptionsSection">
                    <div className="AstTreeOptionsTitle">Commands</div>
                    <div className="AstTreeOptionCards">
                      {options.commandCards.map((command) => {
                        const selected = options.selectedCommands.includes(command);
                        const userDefined = options.userCommands.includes(command);
                        return (
                          <button
                            key={command}
                            type="button"
                            className={`AstTreeOptionCard AstTreeCommandCard ${
                              selected ? 'AstTreeOptionCard--selected' : ''
                            }`}
                            onClick={() => toggleCommand(command)}
                          >
                            {userDefined ? (
                              <span
                                className="AstTreeCommandDelete"
                                onClick={(event) => deleteUserCommand(event, command)}
                                aria-label={`Delete ${command}`}
                              >
                                x
                              </span>
                            ) : null}
                            <span>\{command}</span>
                          </button>
                        );
                      })}
                    </div>
                    <form className="AstTreeCommandForm" onSubmit={addCommand}>
                      <input
                        value={newCommand}
                        onChange={(event) => setNewCommand(event.target.value)}
                        placeholder="Add command..."
                        aria-label="Add command"
                      />
                      <button type="submit">Add</button>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="AstTreeToggle"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand AST view' : 'Collapse AST view'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '>' : '<'}
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <div className="AstTreeList" role="tree">
          {filteredRoot ? (
            <TreeNode node={filteredRoot} onSelectNode={onSelectNode} />
          ) : (
            <div className="AstTreeEmpty">
              {root
                ? 'No nodes match the current AST view options.'
                : 'Select a file to inspect its structure.'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
