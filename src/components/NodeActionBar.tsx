import React, { useEffect, useState } from 'react';
import type { ConfiguredNode, CustomCommandSignature, ProjectCatalog } from '@preptex/core';
import './NodeActionBar.css';

export type SectionCommandName =
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'paragraph'
  | 'subparagraph';

const SECTION_COMMANDS: readonly SectionCommandName[] = [
  'section',
  'subsection',
  'subsubsection',
  'paragraph',
  'subparagraph',
];

const EMPTY_CUSTOM_COMMANDS: readonly CustomCommandSignature[] = [];

function sectionCommandFromLevel(level: 1 | 2 | 3 | 4 | 5): SectionCommandName {
  return SECTION_COMMANDS[level - 1] ?? 'section';
}

export interface NodeActionBarProps {
  readonly selectedNode: ConfiguredNode | null;
  readonly catalog?: ProjectCatalog | null;
  readonly customCommands?: readonly CustomCommandSignature[];
  readonly onRemoveNode: () => void;
  readonly onRenameEnvironment: (newName: string) => void;
  readonly onRenameEnvironmentGlobally?: (oldName: string, newName: string) => void;
  readonly onRenameCommand?: (newName: string) => void;
  readonly onRenameCommandGlobally?: (oldName: string, newName: string) => void;
  readonly onRenameSection?: (sectionCommand: SectionCommandName, starred: boolean) => void;
  readonly onUnwrapNode?: () => void;
  readonly onUpsertCustomCommand?: (sig: CustomCommandSignature) => void;
  readonly onWrapNode: (wrapperName: string) => void;
  readonly onClearSelection: () => void;
}

export const NodeActionBar: React.FC<NodeActionBarProps> = ({
  selectedNode,
  catalog,
  customCommands = EMPTY_CUSTOM_COMMANDS,
  onRemoveNode,
  onRenameEnvironment,
  onRenameEnvironmentGlobally,
  onRenameCommand,
  onRenameCommandGlobally,
  onRenameSection,
  onUnwrapNode,
  onUpsertCustomCommand,
  onWrapNode,
  onClearSelection,
}) => {
  const [renameName, setRenameName] = useState('');
  const [cmdRenameName, setCmdRenameName] = useState('');
  const [wrapName, setWrapName] = useState('');
  const [sectionCmd, setSectionCmd] = useState<SectionCommandName>('section');
  const [sectionStarred, setSectionStarred] = useState(false);
  const [optArgs, setOptArgs] = useState(0);
  const [mandArgs, setMandArgs] = useState(0);

  const isEnvironment = selectedNode?.kind === 'environment';
  const isSection = selectedNode?.kind === 'section';
  const isCommand =
    selectedNode?.kind === 'command' ||
    (selectedNode?.kind === 'token' && selectedNode.token.kind === 'command');
  const commandName =
    selectedNode?.kind === 'command'
      ? selectedNode.name
      : selectedNode?.kind === 'token' && selectedNode.token.kind === 'command'
      ? selectedNode.token.name
      : '';

  const selectedNodeKey = selectedNode?.occurrenceKey ?? null;
  const selectedSectionLevel = selectedNode?.kind === 'section' ? selectedNode.level : null;
  const selectedSectionStarred = selectedNode?.kind === 'section' ? selectedNode.starred : false;

  useEffect(() => {
    setRenameName('');
    setCmdRenameName('');
    setWrapName('');
    if (selectedSectionLevel !== null) {
      setSectionCmd(sectionCommandFromLevel(selectedSectionLevel));
      setSectionStarred(selectedSectionStarred);
    }
    if (commandName) {
      const custom = customCommands.find((c) => c.name === commandName);
      const entry = catalog?.commands.find((c) => c.name === commandName);
      setOptArgs(custom?.optionalArgs ?? entry?.signature.optionalArgs ?? 0);
      setMandArgs(custom?.mandatoryArgs ?? entry?.signature.mandatoryArgs ?? 0);
    }
    // Intentionally reset form inputs only when the selected node changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeKey, selectedSectionLevel, selectedSectionStarred, commandName]);

  if (!selectedNode) {
    return null;
  }

  const envName = isEnvironment ? selectedNode.name : '';
  const catalogCmdEntry = commandName
    ? catalog?.commands.find((c) => c.name === commandName)
    : undefined;
  const showSignatureControls =
    Boolean(onUpsertCustomCommand && commandName) &&
    (catalogCmdEntry?.category === 'used-undefined' ||
      catalogCmdEntry?.signature.source === 'user-override' ||
      selectedNode.kind === 'token' ||
      selectedNode.kind === 'command');

  const canUnwrap =
    Boolean(onUnwrapNode) &&
    (isEnvironment ||
      selectedNode.kind === 'group' ||
      (selectedNode.kind === 'command' && selectedNode.arguments.length === 1));

  const nodeName = isEnvironment
    ? envName || 'environment'
    : isSection
    ? selectedNode.name || 'section'
    : isCommand
    ? `\\${commandName}`
    : selectedNode.kind === 'argument'
    ? `${selectedNode.argKind} #${selectedNode.slot + 1}`
    : selectedNode.kind;

  const primaryLoc = selectedNode.location.primary;
  const locText = primaryLoc
    ? `${primaryLoc.path}: Line ${primaryLoc.range.line} (${primaryLoc.range.start}–${primaryLoc.range.end})`
    : 'No source location';

  return (
    <div className="node-action-bar" role="region" aria-label="Selected node actions">
      <div className="node-info">
        <span className="node-badge">
          Selected {selectedNode.kind}: <strong>{nodeName}</strong>
        </span>
        <span className="node-location" title={locText}>
          {locText}
        </span>
      </div>

      <div className="node-actions-group">
        {isEnvironment && (
          <div className="action-form-inline">
            <input
              type="text"
              className="action-input"
              placeholder="New name..."
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              aria-label="New environment name"
            />
            <button
              type="button"
              className="action-btn rename"
              disabled={!renameName.trim()}
              onClick={() => {
                if (renameName.trim()) {
                  onRenameEnvironment(renameName.trim());
                  setRenameName('');
                }
              }}
            >
              Rename
            </button>
            {onRenameEnvironmentGlobally && envName ? (
              <button
                type="button"
                className="action-btn rename-all"
                disabled={!renameName.trim()}
                title={`Rename every \\begin{${envName}}...\\end{${envName}} in the project`}
                onClick={() => {
                  if (renameName.trim()) {
                    onRenameEnvironmentGlobally(envName, renameName.trim());
                    setRenameName('');
                  }
                }}
              >
                Rename all
              </button>
            ) : null}
          </div>
        )}

        {isCommand && (
          <>
            {onRenameCommand && (
              <div className="action-form-inline">
                <input
                  type="text"
                  className="action-input"
                  placeholder="New \cmd..."
                  value={cmdRenameName}
                  onChange={(e) => setCmdRenameName(e.target.value)}
                  aria-label="New command name"
                />
                <button
                  type="button"
                  className="action-btn rename"
                  disabled={!cmdRenameName.trim()}
                  onClick={() => {
                    const clean = cmdRenameName.trim().replace(/^\\+/, '');
                    if (clean) {
                      onRenameCommand(clean);
                      setCmdRenameName('');
                    }
                  }}
                >
                  Rename
                </button>
                {onRenameCommandGlobally && commandName ? (
                  <button
                    type="button"
                    className="action-btn rename-all"
                    disabled={!cmdRenameName.trim()}
                    title={`Rename all occurrences of \\${commandName}`}
                    onClick={() => {
                      const clean = cmdRenameName.trim().replace(/^\\+/, '');
                      if (clean) {
                        onRenameCommandGlobally(commandName, clean);
                        setCmdRenameName('');
                      }
                    }}
                  >
                    Rename all
                  </button>
                ) : null}
              </div>
            )}

            {showSignatureControls && onUpsertCustomCommand ? (
              <div className="action-form-inline">
                <label className="action-mini-label">
                  <span>Opt</span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    className="action-input action-input--num"
                    value={optArgs}
                    onChange={(e) =>
                      setOptArgs(Math.max(0, Math.min(9, Number(e.target.value) || 0)))
                    }
                    aria-label="Optional arguments"
                  />
                </label>
                <label className="action-mini-label">
                  <span>Args</span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    className="action-input action-input--num"
                    value={mandArgs}
                    onChange={(e) =>
                      setMandArgs(Math.max(0, Math.min(9, Number(e.target.value) || 0)))
                    }
                    aria-label="Mandatory arguments"
                  />
                </label>
                <button
                  type="button"
                  className="action-btn reparse"
                  onClick={() =>
                    onUpsertCustomCommand({
                      name: commandName,
                      optionalArgs: optArgs,
                      mandatoryArgs: mandArgs,
                    })
                  }
                >
                  Reparse args
                </button>
              </div>
            ) : null}
          </>
        )}

        {isSection && onRenameSection ? (
          <div className="action-form-inline">
            <select
              className="action-input action-select"
              aria-label="Section level"
              value={sectionCmd}
              onChange={(e) => setSectionCmd(e.target.value as SectionCommandName)}
            >
              {SECTION_COMMANDS.map((cmd) => (
                <option key={cmd} value={cmd}>
                  \{cmd}
                </option>
              ))}
            </select>
            <label className="action-mini-label">
              <input
                type="checkbox"
                checked={sectionStarred}
                onChange={(e) => setSectionStarred(e.target.checked)}
              />
              <span>*</span>
            </label>
            <button
              type="button"
              className="action-btn rename"
              onClick={() => onRenameSection(sectionCmd, sectionStarred)}
            >
              Update level
            </button>
          </div>
        ) : null}

        {canUnwrap && onUnwrapNode ? (
          <button
            type="button"
            className="action-btn unwrap"
            onClick={onUnwrapNode}
          >
            Unwrap
          </button>
        ) : null}

        <div className="action-form-inline">
          <input
            type="text"
            className="action-input"
            placeholder="Wrapper name..."
            value={wrapName}
            onChange={(e) => setWrapName(e.target.value)}
            aria-label="Wrapper environment name"
          />
          <button
            type="button"
            className="action-btn wrap"
            disabled={!wrapName.trim()}
            onClick={() => {
              if (wrapName.trim()) {
                onWrapNode(wrapName.trim());
                setWrapName('');
              }
            }}
          >
            Wrap
          </button>
        </div>

        <button
          type="button"
          className="action-btn remove"
          onClick={onRemoveNode}
        >
          Remove node
        </button>

        <button
          type="button"
          className="action-btn clear"
          onClick={onClearSelection}
          aria-label="Clear node selection"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
