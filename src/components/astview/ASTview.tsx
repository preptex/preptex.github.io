import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CoarseTreeOptions, ConditionPolicy, ProjectIssue, ViewInputMode } from '@preptex/core';
import { isLayoutNodeKind, LAYOUT_NODE_KINDS } from '../../types/LayoutNode';
import type { LayoutNode, LayoutNodeKind } from '../../types/LayoutNode';
import TreeNode from './TreeNode';

export type AstStructureMode = 'coarse' | 'configured' | 'source';

export interface ASTviewProps {
  root?: LayoutNode | null;
  onSelectNode?: (node: LayoutNode) => void;
  selectedNodeKey?: string | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  isSidePanel?: boolean;
  structureMode?: AstStructureMode;
  onChangeStructureMode?: (mode: AstStructureMode) => void;
  isConfiguredAvailable?: boolean;
  viewIssue?: ProjectIssue | null;
  inputMode?: ViewInputMode;
  onChangeInputMode?: (mode: ViewInputMode) => void;
  inputWarnings?: readonly ProjectIssue[];
  coarseOptions?: CoarseTreeOptions;
  onChangeCoarseOptions?: (next: CoarseTreeOptions) => void;
  hasConditionals?: boolean;
  conditionPolicy?: ConditionPolicy;
  detectedConditions?: readonly string[];
  onConfigureConditions?: (policy: ConditionPolicy) => void;
  splitEnabled?: boolean;
  onToggleSplit?: () => void;
}

const STORAGE_KEY = 'preptex.astview.options.v6';

const DEFAULT_NODE_KINDS = LAYOUT_NODE_KINDS;

const DEFAULT_VISIBLE_NODE_KINDS: readonly LayoutNodeKind[] = [
  'root',
  'section',
];
const DEFAULT_COMMANDS = ['title', 'author', 'input', 'label', 'ref', 'cite', 'includegraphics'];
const DEFAULT_VISIBLE_COMMANDS = ['title', 'author', 'input'];
const DEFAULT_ENVIRONMENTS = [
  'document',
  'abstract',
  'figure',
  'theorem',
  'lemma',
  'table',
  'tabular',
  'itemize',
  'enumerate',
  'equation',
  'align',
];
const DEFAULT_VISIBLE_ENVIRONMENTS = ['document', 'abstract', 'figure', 'table', 'tabular', 'theorem'];

type AstViewOptions = {
  readonly visibleKinds: readonly LayoutNodeKind[];
  readonly commandCards: readonly string[];
  readonly selectedCommands: readonly string[];
  readonly userCommands: readonly string[];
  readonly environmentCards: readonly string[];
  readonly selectedEnvironments: readonly string[];
  readonly userEnvironments: readonly string[];
};

function normalizeOptionName(value: string): string {
  return value.trim().replace(/^\\+/, '').toLowerCase();
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalizeOptionName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, fallback: readonly string[] = []): readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')
    ? value : fallback;
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
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const commandCards = unique([...stringArray(parsed.commandCards), ...DEFAULT_COMMANDS]);
    const selectedCommands = unique(stringArray(parsed.selectedCommands, DEFAULT_VISIBLE_COMMANDS)).filter(
      (name) => commandCards.includes(name),
    );
    const environmentCards = unique([
      ...stringArray(parsed.environmentCards),
      ...DEFAULT_ENVIRONMENTS,
    ]);
    const selectedEnvironments = unique(
      stringArray(parsed.selectedEnvironments, DEFAULT_VISIBLE_ENVIRONMENTS),
    ).filter((name) => environmentCards.includes(name));

    return {
      visibleKinds: stringArray(parsed.visibleKinds, fallback.visibleKinds).filter(isLayoutNodeKind),
      commandCards,
      selectedCommands,
      userCommands: unique(stringArray(parsed.userCommands)).filter((name) => commandCards.includes(name)),
      environmentCards,
      selectedEnvironments,
      userEnvironments: unique(stringArray(parsed.userEnvironments)).filter((name) =>
        environmentCards.includes(name),
      ),
    };
  } catch {
    return fallback;
  }
}

function filterTree(
  node: LayoutNode,
  options: AstViewOptions,
  structureMode: AstStructureMode,
): LayoutNode | null {
  if (structureMode === 'coarse') {
    return node;
  }

  if (structureMode === 'source') {
    if (node.kind === 'space' && !options.visibleKinds.includes('space')) {
      return null;
    }
    const visibleChildren = node.children
      .map((child) => filterTree(child, options, structureMode))
      .filter((child): child is LayoutNode => Boolean(child));
    return {
      ...node,
      children: visibleChildren,
    };
  }

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
    .map((child) => filterTree(child, options, structureMode))
    .filter((child): child is LayoutNode => Boolean(child));

  return {
    ...node,
    children: visibleChildren,
  };
}

export default function ASTview({
  root,
  onSelectNode,
  selectedNodeKey = null,
  collapsed,
  onToggleCollapsed,
  isSidePanel = true,
  structureMode = 'coarse',
  onChangeStructureMode,
  isConfiguredAvailable = true,
  viewIssue = null,
  inputMode = 'command',
  onChangeInputMode,
  inputWarnings = [],
  coarseOptions = {},
  onChangeCoarseOptions,
  hasConditionals = false,
  conditionPolicy,
  detectedConditions = [],
  onConfigureConditions,
  splitEnabled,
  onToggleSplit,
}: ASTviewProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [phase0Open, setPhase0Open] = useState(false);
  const [inlineMode, setInlineMode] = useState<ConditionPolicy['mode']>(
    conditionPolicy && conditionPolicy.mode !== 'ignore' ? conditionPolicy.mode : 'source',
  );
  const [inlineOverrides, setInlineOverrides] = useState<Record<string, boolean>>({});
  const [options, setOptions] = useState<AstViewOptions>(() => loadOptions());
  const [newCommand, setNewCommand] = useState('');
  const [newEnvironment, setNewEnvironment] = useState('');
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Filtering still works when browser storage is unavailable.
    }
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

  const filteredRoot = useMemo(
    () => (root ? filterTree(root, options, structureMode) : null),
    [root, options, structureMode],
  );

  const toggleKind = (kind: LayoutNodeKind) => {
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
          {!collapsed && onChangeInputMode ? (
            <div className="AstTreeModeToggle" role="group" aria-label="Input handling mode">
              <button
                type="button"
                className={`AstTreeModeBtn ${inputMode === 'command' ? 'AstTreeModeBtn--active' : ''}`}
                onClick={() => onChangeInputMode('command')}
                title="Handle \\input as a command in the entry file only"
              >
                Command
              </button>
              <button
                type="button"
                className={`AstTreeModeBtn ${inputMode === 'recursive' ? 'AstTreeModeBtn--active' : ''}`}
                onClick={() => onChangeInputMode('recursive')}
                title="Recursively parse and transform \\input targets"
              >
                Recursive
              </button>
            </div>
          ) : null}

          {!collapsed && onChangeStructureMode ? (
            <div className="AstTreeModeToggle" role="group" aria-label="Tree view mode">
              <button
                type="button"
                className={`AstTreeModeBtn ${structureMode === 'coarse' ? 'AstTreeModeBtn--active' : ''}`}
                disabled={!isConfiguredAvailable}
                onClick={() => onChangeStructureMode('coarse')}
                title={
                  isConfiguredAvailable
                    ? 'Readable coarse document outline (sections, environments, commands, arguments)'
                    : viewIssue
                    ? `${viewIssue.code}: ${viewIssue.message}`
                    : 'Configure an entry in Settings to enable coarse view'
                }
              >
                Coarse
              </button>
              <button
                type="button"
                className={`AstTreeModeBtn ${structureMode === 'configured' ? 'AstTreeModeBtn--active' : ''}`}
                disabled={!isConfiguredAvailable}
                onClick={() => onChangeStructureMode('configured')}
                title={
                  isConfiguredAvailable
                    ? 'Detailed configured document AST'
                    : viewIssue
                    ? `${viewIssue.code}: ${viewIssue.message}`
                    : 'Configure an entry in Settings to enable structure view'
                }
              >
                Structure
              </button>
              <button
                type="button"
                className={`AstTreeModeBtn ${structureMode === 'source' ? 'AstTreeModeBtn--active' : ''}`}
                onClick={() => onChangeStructureMode('source')}
                title="Raw source syntax and tokens"
              >
                Source
              </button>
            </div>
          ) : null}

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
                  {structureMode === 'coarse' ? (
                    <>
                      <div className="AstTreeOptionsHeader">
                        <div className="AstTreeOptionsTitle">Coarse Tree Options</div>
                        {onChangeCoarseOptions ? (
                          <button
                            type="button"
                            className="AstTreeOptionsReset"
                            onClick={() => onChangeCoarseOptions({})}
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>
                      <div className="AstTreeOptionsSection">
                        <div className="AstTreeOptionCards">
                          {(
                            [
                              ['includeSections', 'Sections', true],
                              ['includeEnvironments', 'Environments', true],
                              ['includeInputs', 'Inputs', true],
                              ['includeCustomAndUndefinedCommands', 'Custom/Undefined cmds', true],
                              ['includeBuiltinCommands', 'Built-in cmds', false],
                              ['includeArguments', 'Arguments', true],
                              ['includeDisplayMath', 'Display math', false],
                              ['includeMath', 'All math', false],
                              ['includeGroups', 'Brace groups', false],
                              ['includeTextBlocks', 'Text blocks', false],
                            ] as const
                          ).map(([key, label, fallback]) => {
                            const selected = coarseOptions[key] ?? fallback;
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`AstTreeOptionCard ${
                                  selected ? 'AstTreeOptionCard--selected' : ''
                                }`}
                                onClick={() =>
                                  onChangeCoarseOptions?.({
                                    ...coarseOptions,
                                    [key]: !selected,
                                  })
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {!collapsed && !isSidePanel && onToggleSplit ? (
            <button
              type="button"
              className={`AstTreeSplitBtn${splitEnabled ? ' AstTreeSplitBtn--active' : ''}`}
              onClick={onToggleSplit}
              title="Toggle side-by-side Code view"
            >
              <span aria-hidden="true">◫</span>
              <span>Split</span>
            </button>
          ) : null}

          {isSidePanel && onToggleCollapsed ? (
            <button
              type="button"
              className="AstTreeToggle"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand AST view' : 'Collapse AST view'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '<' : '>'}
            </button>
          ) : null}
        </div>
      </div>

      {!collapsed && inputWarnings.length > 0 ? (
        <div className="AstPhase0Prompt" role="status" aria-label="Missing input warnings">
          <div className="AstPhase0PromptHeader">
            <strong>
              {inputWarnings.length === 1
                ? 'Missing \\input warning'
                : `${inputWarnings.length} missing \\input warnings`}
            </strong>
          </div>
          <p className="AstPhase0Desc">
            {inputWarnings.map((warning) => warning.message).join(' · ')}
          </p>
        </div>
      ) : null}

      {!collapsed && hasConditionals && onConfigureConditions ? (
        <div className="AstPhase0Region">
          {!isConfiguredAvailable && structureMode !== 'source' ? (
            <div className="AstPhase0Prompt" role="region" aria-label="Condition configuration required">
              <div className="AstPhase0PromptHeader">
                <strong>Condition paths needed for branch AST</strong>
                {viewIssue ? <span className="AstPhase0Issue">{viewIssue.message}</span> : null}
              </div>
              <p className="AstPhase0Desc">
                Cross-branch conditionals affect structural nesting here. Choose which branch to evaluate for AST inspection, or inspect Source mode.
              </p>
            </div>
          ) : (
            <div className="AstPhase0Banner">
              <span>
                {conditionPolicy?.mode === 'ignore'
                  ? 'Viewing all conditional branches (ignore mode)'
                  : `Condition mode: ${conditionPolicy?.mode ?? 'source'}`}
              </span>
              <button
                type="button"
                className="AstPhase0ToggleBtn"
                onClick={() => setPhase0Open((v) => !v)}
              >
                {phase0Open ? 'Hide Phase 0' : 'Configure Conditions'}
              </button>
            </div>
          )}

          {(phase0Open || (!isConfiguredAvailable && structureMode !== 'source')) ? (
            <div className="AstPhase0Card">
              <div className="AstPhase0Row">
                <label className="AstPhase0Field">
                  <span>Condition policy</span>
                  <select
                    value={inlineMode}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (
                        val === 'ignore' ||
                        val === 'source' ||
                        val === 'source-with-overrides' ||
                        val === 'manual' ||
                        val === 'none'
                      ) {
                        setInlineMode(val);
                      }
                    }}
                  >
                    <option value="ignore">Ignore conditionals (all branches)</option>
                    <option value="source">Follow source declarations &amp; setters</option>
                    <option value="source-with-overrides">Source with named overrides</option>
                    <option value="manual">Force explicit boolean values</option>
                    <option value="none">Condition-free (none)</option>
                  </select>
                </label>
              </div>

              {detectedConditions.length > 0 &&
              (inlineMode === 'source-with-overrides' || inlineMode === 'manual') ? (
                <div className="AstPhase0CondList">
                  {detectedConditions.map((cond) => {
                    const val = inlineOverrides[cond];
                    const choice = val === true ? 'true' : val === false ? 'false' : 'follow';
                    return (
                      <label key={cond} className="AstPhase0CondItem">
                        <code>\if{cond}</code>
                        <select
                          value={choice}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'follow') {
                              const next = { ...inlineOverrides };
                              delete next[cond];
                              setInlineOverrides(next);
                            } else {
                              setInlineOverrides({ ...inlineOverrides, [cond]: v === 'true' });
                            }
                          }}
                        >
                          {inlineMode === 'source-with-overrides' ? (
                            <option value="follow">Follow source</option>
                          ) : null}
                          {inlineMode === 'manual' && val === undefined ? (
                            <option value="follow">(Select…)</option>
                          ) : null}
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              <div className="AstPhase0Actions">
                <button
                  type="button"
                  className="AstPhase0ApplyBtn"
                  onClick={() => {
                    if (inlineMode === 'ignore') {
                      onConfigureConditions({ mode: 'ignore' });
                    } else if (inlineMode === 'none') {
                      onConfigureConditions({ mode: 'none' });
                    } else if (inlineMode === 'manual') {
                      onConfigureConditions({ mode: 'manual', values: inlineOverrides });
                    } else if (inlineMode === 'source-with-overrides') {
                      onConfigureConditions({
                        mode: 'source-with-overrides',
                        overrides: inlineOverrides,
                      });
                    } else {
                      onConfigureConditions({ mode: 'source' });
                    }
                    setPhase0Open(false);
                  }}
                >
                  Apply Condition Setup
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {collapsed ? null : (
        <div className="AstTreeList" role="tree">
          {filteredRoot ? (
            <TreeNode
              node={filteredRoot}
              onSelectNode={onSelectNode}
              selectedNodeKey={selectedNodeKey}
            />
          ) : (
            <div className="AstTreeEmpty">
              {root
                ? 'No nodes match the current AST view options.'
                : structureMode !== 'source' && viewIssue
                ? `Structure unavailable (${viewIssue.code}): ${viewIssue.message}`
                : 'Select a file to inspect its structure.'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
