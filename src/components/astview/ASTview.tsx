import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutNode } from '../../types/LayoutNode';
import TreeNode from './TreeNode';

interface ASTviewProps {
  root?: LayoutNode | null;
  onSelectNode?: (node: LayoutNode) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const STORAGE_KEY = 'preptex.astview.options.v5';

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
  'condition',
  'if',
  'else',
  'input',
];
const DEFAULT_COMMANDS = ['title', 'author', 'label', 'ref', 'cite', 'includegraphics'];
const DEFAULT_VISIBLE_COMMANDS = ['title', 'author', 'label'];
const DEFAULT_ENVIRONMENTS = [
  'document',
  'abstract',
  'figure',
  'table',
  'tabular',
  'itemize',
  'enumerate',
  'equation',
  'align',
];
const DEFAULT_VISIBLE_ENVIRONMENTS = ['document', 'abstract', 'figure', 'table', 'tabular'];

type AstViewOptions = {
  visibleKinds: string[];
  commandCards: string[];
  selectedCommands: string[];
  userCommands: string[];
  environmentCards: string[];
  selectedEnvironments: string[];
  userEnvironments: string[];
};

function normalizeOptionName(value: string): string {
  return value.trim().replace(/^\\+/, '').toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeOptionName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function loadOptions(): AstViewOptions {
  const fallback: AstViewOptions = {
    visibleKinds: DEFAULT_VISIBLE_NODE_KINDS,
    commandCards: DEFAULT_COMMANDS,
    selectedCommands: DEFAULT_VISIBLE_COMMANDS,
    userCommands: [],
    environmentCards: DEFAULT_ENVIRONMENTS,
    selectedEnvironments: DEFAULT_VISIBLE_ENVIRONMENTS,
    userEnvironments: [],
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AstViewOptions>;
    const commandCards = unique([...(parsed.commandCards ?? []), ...DEFAULT_COMMANDS]);
    const selectedCommands = unique(parsed.selectedCommands ?? DEFAULT_VISIBLE_COMMANDS).filter(
      (name) => commandCards.includes(name),
    );
    const environmentCards = unique([
      ...(parsed.environmentCards ?? []),
      ...DEFAULT_ENVIRONMENTS,
    ]);
    const selectedEnvironments = unique(
      parsed.selectedEnvironments ?? DEFAULT_VISIBLE_ENVIRONMENTS,
    ).filter((name) => environmentCards.includes(name));

    return {
      visibleKinds: parsed.visibleKinds?.length ? parsed.visibleKinds : fallback.visibleKinds,
      commandCards,
      selectedCommands,
      userCommands: unique(parsed.userCommands ?? []).filter((name) => commandCards.includes(name)),
      environmentCards,
      selectedEnvironments,
      userEnvironments: unique(parsed.userEnvironments ?? []).filter((name) =>
        environmentCards.includes(name),
      ),
    };
  } catch {
    return fallback;
  }
}

function filterTree(node: LayoutNode, options: AstViewOptions): LayoutNode | null {
  const optionName = normalizeOptionName(node.data || node.label || '');
  const allCommandsVisible = options.visibleKinds.includes('command');
  const selectedCommandVisible = options.selectedCommands.includes(optionName);
  const allEnvironmentsVisible = options.visibleKinds.includes('environment');
  const selectedEnvironmentVisible = options.selectedEnvironments.includes(optionName);
  const isVisibleCommand =
    node.kind !== 'command' || allCommandsVisible || selectedCommandVisible;
  const isVisibleEnvironment =
    node.kind !== 'environment' || allEnvironmentsVisible || selectedEnvironmentVisible;
  const isVisibleKind =
    node.kind === 'command'
      ? allCommandsVisible || selectedCommandVisible
      : node.kind === 'environment'
        ? allEnvironmentsVisible || selectedEnvironmentVisible
      : options.visibleKinds.includes(node.kind);
  const shouldRender = isVisibleKind && isVisibleCommand && isVisibleEnvironment;

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
  const [newEnvironment, setNewEnvironment] = useState('');
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

  const toggleEnvironment = (environment: string) => {
    setOptions((current) => {
      const selectedEnvironments = current.selectedEnvironments.includes(environment)
        ? current.selectedEnvironments.filter((item) => item !== environment)
        : [...current.selectedEnvironments, environment];
      return { ...current, selectedEnvironments: unique(selectedEnvironments) };
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

  const deleteUserEnvironment = (event: MouseEvent<HTMLSpanElement>, environment: string) => {
    event.stopPropagation();
    setOptions((current) => ({
      ...current,
      environmentCards: current.environmentCards.filter((item) => item !== environment),
      selectedEnvironments: current.selectedEnvironments.filter((item) => item !== environment),
      userEnvironments: current.userEnvironments.filter((item) => item !== environment),
    }));
  };

  const addCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = normalizeOptionName(newCommand);
    if (!command) return;
    setOptions((current) => ({
      ...current,
      commandCards: unique([...current.commandCards, command]),
      selectedCommands: unique([...current.selectedCommands, command]),
      userCommands: unique([...current.userCommands, command]),
    }));
    setNewCommand('');
  };

  const addEnvironment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const environment = normalizeOptionName(newEnvironment);
    if (!environment) return;
    setOptions((current) => ({
      ...current,
      environmentCards: unique([...current.environmentCards, environment]),
      selectedEnvironments: unique([...current.selectedEnvironments, environment]),
      userEnvironments: unique([...current.userEnvironments, environment]),
    }));
    setNewEnvironment('');
  };

  const resetToDefault = () => {
    setOptions((current) => ({
      ...current,
      visibleKinds: DEFAULT_VISIBLE_NODE_KINDS,
      selectedCommands: DEFAULT_VISIBLE_COMMANDS,
      selectedEnvironments: DEFAULT_VISIBLE_ENVIRONMENTS,
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
                    <div className="AstTreeOptionsTitle">Environments</div>
                    <div className="AstTreeOptionCards">
                      {options.environmentCards.map((environment) => {
                        const selected = options.selectedEnvironments.includes(environment);
                        const userDefined = options.userEnvironments.includes(environment);
                        return (
                          <button
                            key={environment}
                            type="button"
                            className={`AstTreeOptionCard AstTreeCommandCard ${
                              selected ? 'AstTreeOptionCard--selected' : ''
                            }`}
                            onClick={() => toggleEnvironment(environment)}
                          >
                            {userDefined ? (
                              <span
                                className="AstTreeCommandDelete"
                                onClick={(event) => deleteUserEnvironment(event, environment)}
                                aria-label={`Delete ${environment}`}
                              >
                                x
                              </span>
                            ) : null}
                            <span>{environment}</span>
                          </button>
                        );
                      })}
                    </div>
                    <form className="AstTreeCommandForm" onSubmit={addEnvironment}>
                      <input
                        value={newEnvironment}
                        onChange={(event) => setNewEnvironment(event.target.value)}
                        placeholder="Add environment..."
                        aria-label="Add environment"
                      />
                      <button type="submit">Add</button>
                    </form>
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
