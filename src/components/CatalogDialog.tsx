import React, { useEffect, useMemo, useState } from 'react';
import type {
  AnalysisLocation,
  CatalogCitationEntry,
  CatalogCommandEntry,
  CatalogConditionEntry,
  CatalogEnvironmentEntry,
  CatalogLabelEntry,
  CommandDefinitionItem,
  CustomCommandSignature,
  ProjectCatalog,
  SymbolRefactorAction,
} from '@preptex/core';
import './CatalogDialog.css';

export type CatalogTab = 'commands' | 'environments' | 'conditions' | 'labels' | 'citations';
export type CatalogFilter = 'all' | 'introduced' | 'used' | 'undefined';

export interface CatalogDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly catalog: ProjectCatalog | null;
  readonly customCommands: readonly CustomCommandSignature[];
  readonly onUpsertCustomCommand: (sig: CustomCommandSignature) => void;
  readonly onRemoveCustomCommand: (name: string) => void;
  readonly onRefactorSymbol: (action: SymbolRefactorAction) => void;
  readonly onSelectLocation: (location: AnalysisLocation) => void;
  readonly variant?: 'dialog' | 'view';
}

const TABS: readonly { readonly id: CatalogTab; readonly label: string }[] = [
  { id: 'commands', label: 'Commands' },
  { id: 'environments', label: 'Environments' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'labels', label: 'Labels & Refs' },
  { id: 'citations', label: 'Citations' },
];

const FILTERS: readonly { readonly id: CatalogFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'introduced', label: 'Introduced' },
  { id: 'used', label: 'Used' },
  { id: 'undefined', label: 'Used Undefined' },
];

interface CommandDefEditorProps {
  readonly definition: CommandDefinitionItem;
  readonly onSubmit: (action: SymbolRefactorAction) => void;
  readonly onCancel: () => void;
}

function CommandDefEditor({ definition, onSubmit, onCancel }: CommandDefEditorProps) {
  const [newName, setNewName] = useState(definition.name);
  const [numArgs, setNumArgs] = useState(definition.numArgs);
  const [defaultArg, setDefaultArg] = useState(definition.defaultArg ?? '');
  const [newBody, setNewBody] = useState(definition.bodySource ?? '');
  const isDef = definition.form === 'def';

  return (
    <form
      className="CatalogDefEditor"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          kind: 'edit-command-definition',
          definitionLocation: {
            path: definition.location.path,
            range: definition.location.range,
          },
          newName: newName.trim().replace(/^\\+/, '') || definition.name,
          ...(isDef
            ? {}
            : {
                numArgs,
                defaultArg: numArgs > 0 && defaultArg.trim() !== '' ? defaultArg : null,
              }),
          newBody,
        });
      }}
    >
      <div className="CatalogDefGrid">
        <label className="CatalogField">
          <span>Command Name</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label={`Definition name for \\${definition.name}`}
          />
        </label>
        {!isDef ? (
          <>
            <label className="CatalogField">
              <span>Total Args (0–9)</span>
              <input
                type="number"
                min={0}
                max={9}
                value={numArgs}
                onChange={(e) => setNumArgs(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                aria-label={`Argument count for \\${definition.name}`}
              />
            </label>
            <label className="CatalogField">
              <span>Optional Default (#1)</span>
              <input
                type="text"
                value={defaultArg}
                disabled={numArgs === 0}
                placeholder="None"
                onChange={(e) => setDefaultArg(e.target.value)}
                aria-label={`Default argument for \\${definition.name}`}
              />
            </label>
          </>
        ) : null}
      </div>
      <label className="CatalogField">
        <span>Definition Body</span>
        <textarea
          rows={2}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          aria-label={`Definition body for \\${definition.name}`}
        />
      </label>
      <div className="CatalogDefActions">
        <button type="submit" className="CatalogBtn CatalogBtn--primary">
          Preview Definition Edit
        </button>
        <button type="button" className="CatalogBtn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

interface SignatureEditorProps {
  readonly entry: CatalogCommandEntry;
  readonly currentOverride: CustomCommandSignature | undefined;
  readonly onUpsert: (sig: CustomCommandSignature) => void;
  readonly onRemove: (name: string) => void;
}

function SignatureEditor({ entry, currentOverride, onUpsert, onRemove }: SignatureEditorProps) {
  const [optArgs, setOptArgs] = useState(
    currentOverride?.optionalArgs ?? entry.signature.optionalArgs,
  );
  const [mandArgs, setMandArgs] = useState(
    currentOverride?.mandatoryArgs ?? entry.signature.mandatoryArgs,
  );

  useEffect(() => {
    setOptArgs(currentOverride?.optionalArgs ?? entry.signature.optionalArgs);
    setMandArgs(currentOverride?.mandatoryArgs ?? entry.signature.mandatoryArgs);
  }, [currentOverride, entry.signature.optionalArgs, entry.signature.mandatoryArgs]);

  return (
    <div className="CatalogSigBox">
      <label className="CatalogMiniField">
        <span>Opt args</span>
        <input
          type="number"
          min={0}
          max={9}
          value={optArgs}
          onChange={(e) => setOptArgs(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
          aria-label={`Optional arguments for \\${entry.name}`}
        />
      </label>
      <label className="CatalogMiniField">
        <span>Mandatory args</span>
        <input
          type="number"
          min={0}
          max={9}
          value={mandArgs}
          onChange={(e) => setMandArgs(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
          aria-label={`Mandatory arguments for \\${entry.name}`}
        />
      </label>
      <button
        type="button"
        className="CatalogBtn CatalogBtn--accent"
        onClick={() =>
          onUpsert({
            name: entry.name,
            optionalArgs: optArgs,
            mandatoryArgs: mandArgs,
          })
        }
      >
        Set Args &amp; Reparse
      </button>
      {entry.signature.source === 'user-override' ? (
        <button
          type="button"
          className="CatalogBtn"
          onClick={() => onRemove(entry.name)}
        >
          Reset Signature
        </button>
      ) : null}
    </div>
  );
}

interface RenameRowProps {
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly buttonLabel: string;
  readonly submitAriaLabel: string;
  readonly onRename: (next: string) => void;
}

function RenameRow({
  placeholder,
  ariaLabel,
  buttonLabel,
  submitAriaLabel,
  onRename,
}: RenameRowProps) {
  const [value, setValue] = useState('');
  return (
    <form
      className="CatalogRenameForm"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onRename(trimmed);
          setValue('');
        }
      }}
    >
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        className="CatalogBtn CatalogBtn--primary"
        aria-label={submitAriaLabel}
        disabled={!value.trim()}
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function CatalogDialog({
  isOpen,
  onClose,
  catalog,
  customCommands,
  onUpsertCustomCommand,
  onRemoveCustomCommand,
  onRefactorSymbol,
  onSelectLocation,
  variant = 'dialog',
}: CatalogDialogProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('commands');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [query, setQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Readonly<Record<string, boolean>>>({});
  const [editingDefId, setEditingDefId] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== 'dialog') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, variant]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const normalizedQuery = query.trim().toLowerCase().replace(/^\\+/, '');

  const filteredCommands = useMemo<readonly CatalogCommandEntry[]>(() => {
    if (!catalog) return [];
    const base =
      filter === 'introduced'
        ? catalog.introducedCommands
        : filter === 'used'
        ? catalog.usedCommands
        : filter === 'undefined'
        ? catalog.usedUndefinedCommands
        : catalog.commands;
    if (!normalizedQuery) return base;
    return base.filter((c) => c.name.toLowerCase().includes(normalizedQuery));
  }, [catalog, filter, normalizedQuery]);

  const filteredEnvironments = useMemo<readonly CatalogEnvironmentEntry[]>(() => {
    if (!catalog) return [];
    const base =
      filter === 'introduced'
        ? catalog.introducedEnvironments
        : filter === 'used'
        ? catalog.usedEnvironments
        : filter === 'undefined'
        ? catalog.environments.filter((e) => e.category === 'used-undefined')
        : catalog.environments;
    if (!normalizedQuery) return base;
    return base.filter((e) => e.name.toLowerCase().includes(normalizedQuery));
  }, [catalog, filter, normalizedQuery]);

  const filteredConditions = useMemo<readonly CatalogConditionEntry[]>(() => {
    if (!catalog) return [];
    const base =
      filter === 'introduced'
        ? catalog.introducedConditions
        : filter === 'used'
        ? catalog.usedConditions
        : filter === 'undefined'
        ? catalog.conditions.filter((c) => c.category === 'used-undeclared')
        : catalog.conditions;
    if (!normalizedQuery) return base;
    return base.filter((c) => c.name.toLowerCase().includes(normalizedQuery));
  }, [catalog, filter, normalizedQuery]);

  const filteredLabels = useMemo<readonly CatalogLabelEntry[]>(() => {
    if (!catalog) return [];
    const base =
      filter === 'introduced'
        ? catalog.introducedLabels
        : filter === 'used'
        ? catalog.usedLabels
        : filter === 'undefined'
        ? catalog.usedUndefinedLabels
        : catalog.labels;
    if (!normalizedQuery) return base;
    return base.filter((l) => l.key.toLowerCase().includes(normalizedQuery));
  }, [catalog, filter, normalizedQuery]);

  const filteredCitations = useMemo<readonly CatalogCitationEntry[]>(() => {
    if (!catalog) return [];
    const base =
      filter === 'introduced'
        ? catalog.introducedCitations
        : filter === 'used'
        ? catalog.usedCitations
        : filter === 'undefined'
        ? catalog.citations.filter((c) => c.category === 'used-external')
        : catalog.citations;
    if (!normalizedQuery) return base;
    return base.filter((c) => c.key.toLowerCase().includes(normalizedQuery));
  }, [catalog, filter, normalizedQuery]);

  if (variant === 'dialog' && !isOpen) return null;

  const inner = (
    <div
      className={variant === 'view' ? 'CatalogViewCard' : 'CatalogDialog'}
      role={variant === 'dialog' ? 'dialog' : undefined}
      aria-modal={variant === 'dialog' ? 'true' : undefined}
      aria-labelledby="catalog-dialog-title"
      onClick={variant === 'dialog' ? (e) => e.stopPropagation() : undefined}
    >
      <div className="CatalogDialogHeader">
        <div className="CatalogDialogTitleGroup">
          <h2 id="catalog-dialog-title">Project Symbol &amp; Construct Catalog</h2>
          <span className="CatalogDialogSubtitle">
            Inspect introduced vs. used symbols across all branches, jump to occurrences, refactor globally, and assign argument counts.
          </span>
        </div>
        {variant === 'dialog' ? (
          <button
            type="button"
            className="CatalogDialogClose"
            onClick={onClose}
            aria-label="Close catalog dialog"
          >
            &times;
          </button>
        ) : null}
      </div>

        <div className="CatalogDialogToolbar">
          <div className="CatalogTabs" role="tablist" aria-label="Symbol categories">
            {TABS.map((tab) => {
              const count = !catalog
                ? 0
                : tab.id === 'commands'
                ? catalog.commands.length
                : tab.id === 'environments'
                ? catalog.environments.length
                : tab.id === 'conditions'
                ? catalog.conditions.length
                : tab.id === 'labels'
                ? catalog.labels.length
                : catalog.citations.length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`CatalogTab ${activeTab === tab.id ? 'CatalogTab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className="CatalogTabCount">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="CatalogFiltersRow">
            <div className="CatalogFilterPills" role="group" aria-label="Symbol status filter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`CatalogFilterPill ${filter === f.id ? 'CatalogFilterPill--active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="CatalogSearchInput"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter symbols..."
              aria-label="Filter symbols"
            />
          </div>
        </div>

        <div className="CatalogDialogBody" role="tabpanel">
          {!catalog ? (
            <div className="CatalogEmpty">Upload at least one `.tex` file to inspect its symbols.</div>
          ) : activeTab === 'commands' ? (
            filteredCommands.length === 0 ? (
              <div className="CatalogEmpty">No commands match the current filter.</div>
            ) : (
              <div className="CatalogList">
                {filteredCommands.map((entry) => {
                  const expandKey = `cmd:${entry.name}`;
                  const isExpanded = Boolean(expandedKeys[expandKey]);
                  const customOverride = customCommands.find((c) => c.name === entry.name);
                  return (
                    <div key={entry.name} className="CatalogItemCard">
                      <div className="CatalogItemTop">
                        <div className="CatalogItemIdentity">
                          <code className="CatalogSymbolName">\{entry.name}</code>
                          <span className={`CatalogBadge CatalogBadge--${entry.category}`}>
                            {entry.category}
                          </span>
                          <span className="CatalogSigMeta">
                            opt: {entry.signature.optionalArgs}, args: {entry.signature.mandatoryArgs}{' '}
                            ({entry.signature.source})
                          </span>
                        </div>
                        <div className="CatalogItemStats">
                          <button
                            type="button"
                            className="CatalogCountBtn"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(expandKey)}
                          >
                            {entry.definitions.length} defs · {entry.occurrences.length} uses{' '}
                            {isExpanded ? '▾' : '▸'}
                          </button>
                        </div>
                      </div>

                      <div className="CatalogItemControls">
                        {entry.canRenameGlobally ? (
                          <RenameRow
                            placeholder="New \cmd name..."
                            ariaLabel={`New name for command \\${entry.name}`}
                            buttonLabel="Rename All"
                            submitAriaLabel={`Rename All \\${entry.name}`}
                            onRename={(newName) =>
                              onRefactorSymbol({
                                kind: 'rename-command-globally',
                                oldName: entry.name,
                                newName: newName.replace(/^\\+/, ''),
                              })
                            }
                          />
                        ) : null}

                        {entry.category === 'used-undefined' ||
                        entry.signature.source === 'user-override' ? (
                          <SignatureEditor
                            entry={entry}
                            currentOverride={customOverride}
                            onUpsert={onUpsertCustomCommand}
                            onRemove={onRemoveCustomCommand}
                          />
                        ) : null}

                        {entry.definitions.map((def) => (
                          <button
                            key={def.id}
                            type="button"
                            className="CatalogBtn"
                            onClick={() =>
                              setEditingDefId((prev) => (prev === def.id ? null : def.id))
                            }
                          >
                            {editingDefId === def.id ? 'Hide Definition Editor' : `Edit \\${def.form}`}
                          </button>
                        ))}
                      </div>

                      {entry.definitions.map((def) =>
                        editingDefId === def.id ? (
                          <CommandDefEditor
                            key={`editor-${def.id}`}
                            definition={def}
                            onSubmit={(action) => {
                              setEditingDefId(null);
                              onRefactorSymbol(action);
                            }}
                            onCancel={() => setEditingDefId(null)}
                          />
                        ) : null,
                      )}

                      {isExpanded ? (
                        <div className="CatalogOccurrenceDrawer">
                          {entry.definitions.map((def) => (
                            <button
                              key={def.id}
                              type="button"
                              className="CatalogOccBtn CatalogOccBtn--def"
                              onClick={() => onSelectLocation(def.location)}
                            >
                              <span className="CatalogOccKind">def (\{def.form})</span>
                              <span>
                                {def.location.path}:{def.location.range.line}
                              </span>
                            </button>
                          ))}
                          {entry.occurrences.map((occ, idx) => (
                            <button
                              key={`${entry.name}-occ-${idx}`}
                              type="button"
                              className="CatalogOccBtn"
                              onClick={() => onSelectLocation(occ.location)}
                            >
                              <span className="CatalogOccKind">use</span>
                              <span>
                                {occ.location.path}:{occ.location.range.line}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'environments' ? (
            filteredEnvironments.length === 0 ? (
              <div className="CatalogEmpty">No environments match the current filter.</div>
            ) : (
              <div className="CatalogList">
                {filteredEnvironments.map((entry) => {
                  const expandKey = `env:${entry.name}`;
                  const isExpanded = Boolean(expandedKeys[expandKey]);
                  return (
                    <div key={entry.name} className="CatalogItemCard">
                      <div className="CatalogItemTop">
                        <div className="CatalogItemIdentity">
                          <code className="CatalogSymbolName">{entry.name}</code>
                          <span className={`CatalogBadge CatalogBadge--${entry.category}`}>
                            {entry.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="CatalogCountBtn"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(expandKey)}
                        >
                          {entry.definitions.length} defs · {entry.occurrences.length} uses{' '}
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </div>

                      <div className="CatalogItemControls">
                        {entry.canRenameGlobally ? (
                          <RenameRow
                            placeholder="New environment..."
                            ariaLabel={`New name for environment ${entry.name}`}
                            buttonLabel="Rename All"
                            submitAriaLabel={`Rename All environment ${entry.name}`}
                            onRename={(newName) =>
                              onRefactorSymbol({
                                kind: 'rename-environment-globally',
                                oldName: entry.name,
                                newName,
                              })
                            }
                          />
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <div className="CatalogOccurrenceDrawer">
                          {entry.definitions.map((def) => (
                            <button
                              key={def.id}
                              type="button"
                              className="CatalogOccBtn CatalogOccBtn--def"
                              onClick={() => onSelectLocation(def.location)}
                            >
                              <span className="CatalogOccKind">def (\{def.form})</span>
                              <span>
                                {def.location.path}:{def.location.range.line}
                              </span>
                            </button>
                          ))}
                          {entry.occurrences.map((occ, idx) => (
                            <button
                              key={`${entry.name}-occ-${idx}`}
                              type="button"
                              className="CatalogOccBtn"
                              onClick={() => onSelectLocation(occ.location)}
                            >
                              <span className="CatalogOccKind">{occ.status}</span>
                              <span>
                                {occ.location.path}:{occ.location.range.line}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'conditions' ? (
            filteredConditions.length === 0 ? (
              <div className="CatalogEmpty">No conditions match the current filter.</div>
            ) : (
              <div className="CatalogList">
                {filteredConditions.map((entry) => {
                  const expandKey = `cond:${entry.name}`;
                  const isExpanded = Boolean(expandedKeys[expandKey]);
                  return (
                    <div key={entry.name} className="CatalogItemCard">
                      <div className="CatalogItemTop">
                        <div className="CatalogItemIdentity">
                          <code className="CatalogSymbolName">\if{entry.name}</code>
                          <span className={`CatalogBadge CatalogBadge--${entry.category}`}>
                            {entry.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="CatalogCountBtn"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(expandKey)}
                        >
                          {entry.declarations.length} decls · {entry.tests.length} tests ·{' '}
                          {entry.setters.length} setters {isExpanded ? '▾' : '▸'}
                        </button>
                      </div>

                      <div className="CatalogItemControls">
                        {entry.canRenameGlobally ? (
                          <RenameRow
                            placeholder="New condition flag..."
                            ariaLabel={`New name for condition ${entry.name}`}
                            buttonLabel="Rename All"
                            submitAriaLabel={`Rename All condition ${entry.name}`}
                            onRename={(newName) =>
                              onRefactorSymbol({
                                kind: 'rename-condition-globally',
                                oldName: entry.name,
                                newName: newName.replace(/^\\?if/, ''),
                              })
                            }
                          />
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <div className="CatalogOccurrenceDrawer">
                          {entry.declarations.map((d, idx) => (
                            <button
                              key={`decl-${idx}`}
                              type="button"
                              className="CatalogOccBtn CatalogOccBtn--def"
                              onClick={() => onSelectLocation(d.location)}
                            >
                              <span className="CatalogOccKind">newif</span>
                              <span>
                                {d.location.path}:{d.location.range.line}
                              </span>
                            </button>
                          ))}
                          {entry.tests.map((t, idx) => (
                            <button
                              key={`test-${idx}`}
                              type="button"
                              className="CatalogOccBtn"
                              onClick={() => onSelectLocation(t.location)}
                            >
                              <span className="CatalogOccKind">
                                test{t.outcome ? ` (${t.outcome})` : ''}
                              </span>
                              <span>
                                {t.location.path}:{t.location.range.line}
                              </span>
                            </button>
                          ))}
                          {entry.setters.map((s, idx) => (
                            <button
                              key={`set-${idx}`}
                              type="button"
                              className="CatalogOccBtn"
                              onClick={() => onSelectLocation(s.location)}
                            >
                              <span className="CatalogOccKind">
                                {s.value ? 'true' : 'false'}
                              </span>
                              <span>
                                {s.location.path}:{s.location.range.line}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'labels' ? (
            filteredLabels.length === 0 ? (
              <div className="CatalogEmpty">No labels or references match the current filter.</div>
            ) : (
              <div className="CatalogList">
                {filteredLabels.map((entry) => {
                  const expandKey = `label:${entry.key}`;
                  const isExpanded = Boolean(expandedKeys[expandKey]);
                  return (
                    <div key={entry.key} className="CatalogItemCard">
                      <div className="CatalogItemTop">
                        <div className="CatalogItemIdentity">
                          <code className="CatalogSymbolName">{entry.key}</code>
                          <span className={`CatalogBadge CatalogBadge--${entry.category}`}>
                            {entry.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="CatalogCountBtn"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(expandKey)}
                        >
                          {entry.declarations.length} labels · {entry.occurrences.length} refs{' '}
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </div>

                      <div className="CatalogItemControls">
                        {entry.canRenameGlobally ? (
                          <RenameRow
                            placeholder="New label key..."
                            ariaLabel={`New key for label ${entry.key}`}
                            buttonLabel="Rename All"
                            submitAriaLabel={`Rename All label ${entry.key}`}
                            onRename={(newKey) =>
                              onRefactorSymbol({
                                kind: 'rename-label-globally',
                                oldKey: entry.key,
                                newKey,
                              })
                            }
                          />
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <div className="CatalogOccurrenceDrawer">
                          {entry.declarations.map((d, idx) => (
                            <button
                              key={`lbl-${idx}`}
                              type="button"
                              className="CatalogOccBtn CatalogOccBtn--def"
                              onClick={() => onSelectLocation(d.location)}
                            >
                              <span className="CatalogOccKind">\label</span>
                              <span>
                                {d.location.path}:{d.location.range.line}
                              </span>
                            </button>
                          ))}
                          {entry.occurrences.map((occ, idx) => (
                            <button
                              key={`ref-${idx}`}
                              type="button"
                              className="CatalogOccBtn"
                              onClick={() => onSelectLocation(occ.location)}
                            >
                              <span className="CatalogOccKind">\{occ.command}</span>
                              <span>
                                {occ.location.path}:{occ.location.range.line}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredCitations.length === 0 ? (
            <div className="CatalogEmpty">No citations match the current filter.</div>
          ) : (
            <div className="CatalogList">
              {filteredCitations.map((entry) => {
                const expandKey = `cite:${entry.key}`;
                const isExpanded = Boolean(expandedKeys[expandKey]);
                return (
                  <div key={entry.key} className="CatalogItemCard">
                    <div className="CatalogItemTop">
                      <div className="CatalogItemIdentity">
                        <code className="CatalogSymbolName">{entry.key}</code>
                        <span className={`CatalogBadge CatalogBadge--${entry.category}`}>
                          {entry.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="CatalogCountBtn"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(expandKey)}
                      >
                        {entry.definitions.length} bibitems · {entry.occurrences.length} cites{' '}
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </div>

                    <div className="CatalogItemControls">
                      {entry.canRenameGlobally ? (
                        <RenameRow
                          placeholder="New citation key..."
                          ariaLabel={`New key for citation ${entry.key}`}
                          buttonLabel="Rename All"
                          submitAriaLabel={`Rename All citation ${entry.key}`}
                          onRename={(newKey) =>
                            onRefactorSymbol({
                              kind: 'rename-citation-globally',
                              oldKey: entry.key,
                              newKey,
                            })
                          }
                        />
                      ) : null}
                    </div>

                    {isExpanded ? (
                      <div className="CatalogOccurrenceDrawer">
                        {entry.definitions.map((d, idx) => (
                          <button
                            key={`bib-${idx}`}
                            type="button"
                            className="CatalogOccBtn CatalogOccBtn--def"
                            onClick={() => onSelectLocation(d.location)}
                          >
                            <span className="CatalogOccKind">\bibitem</span>
                            <span>
                              {d.location.path}:{d.location.range.line}
                            </span>
                          </button>
                        ))}
                        {entry.occurrences.map((occ, idx) => (
                          <button
                            key={`cite-${idx}`}
                            type="button"
                            className="CatalogOccBtn"
                            onClick={() => onSelectLocation(occ.location)}
                          >
                            <span className="CatalogOccKind">\{occ.command}</span>
                            <span>
                              {occ.location.path}:{occ.location.range.line}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {variant === 'dialog' ? (
          <div className="CatalogDialogFooter">
            <button
              type="button"
              className="CatalogBtn"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : null}
    </div>
  );

  if (variant === 'view') {
    return (
      <section className="WorkspaceViewPane CatalogViewPane" aria-label="Catalog">
        {inner}
      </section>
    );
  }

  return (
    <div className="CatalogDialogOverlay" onClick={onClose} role="presentation">
      {inner}
    </div>
  );
}

export default CatalogDialog;
