import React, { useEffect, useState } from 'react';
import type { ConditionPolicy, CustomCommandSignature, ProjectFilePath } from '@preptex/core';
import type { FilesMap } from '../types/files';
import type { ProjectConfigurationState } from '../model/useProjectConfiguration';
import './ProjectSetupDialog.css';

export interface ProjectSetupDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly files: FilesMap;
  readonly configuration: ProjectConfigurationState;
  readonly onApply: (draft: Partial<ProjectConfigurationState>) => void;
  readonly detectedConditions: readonly string[];
  readonly variant?: 'dialog' | 'view';
  readonly customCommands?: readonly CustomCommandSignature[];
  readonly onRemoveCustomCommand?: (name: string) => void;
  readonly splitEnabled?: boolean;
  readonly onToggleSplit?: () => void;
}

function isConditionPolicyMode(value: string): value is ConditionPolicy['mode'] {
  return (
    value === 'ignore' ||
    value === 'source' ||
    value === 'source-with-overrides' ||
    value === 'manual' ||
    value === 'none'
  );
}

export function ProjectSetupDialog({
  isOpen,
  onClose,
  files,
  configuration,
  onApply,
  detectedConditions,
  variant = 'dialog',
  customCommands = [],
  onRemoveCustomCommand,
  splitEnabled,
  onToggleSplit,
}: ProjectSetupDialogProps) {
  const fileKeys = Object.keys(files);
  const recommendedEntry =
    configuration.entryPath ||
    fileKeys.find((f) => f === 'main.tex') ||
    fileKeys[0] ||
    '';

  const [entryPath, setEntryPath] = useState<ProjectFilePath | ''>(recommendedEntry);
  const [traversal, setTraversal] = useState<'project' | 'file-only'>(
    configuration.traversal,
  );
  const [policyMode, setPolicyMode] = useState<ConditionPolicy['mode']>(
    configuration.conditionPolicy.mode,
  );
  const [conditionOverrides, setConditionOverrides] = useState<Record<string, boolean>>(() => {
    if (configuration.conditionPolicy.mode === 'source-with-overrides') {
      return { ...configuration.conditionPolicy.overrides };
    }
    if (configuration.conditionPolicy.mode === 'manual') {
      return { ...configuration.conditionPolicy.values };
    }
    return {};
  });

  useEffect(() => {
    if (isOpen || variant === 'view') {
      const keys = Object.keys(files);
      const recommended =
        configuration.entryPath ||
        keys.find((f) => f === 'main.tex') ||
        keys[0] ||
        '';
      setEntryPath(recommended);
      setTraversal(configuration.traversal);
      setPolicyMode(configuration.conditionPolicy.mode);
      if (configuration.conditionPolicy.mode === 'source-with-overrides') {
        setConditionOverrides({ ...configuration.conditionPolicy.overrides });
      } else if (configuration.conditionPolicy.mode === 'manual') {
        setConditionOverrides({ ...configuration.conditionPolicy.values });
      } else {
        setConditionOverrides({});
      }
    }
  }, [isOpen, variant, configuration, files]);

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

  if (variant === 'dialog' && !isOpen) return null;

  const handleConditionChange = (name: string, valueStr: string) => {
    if (valueStr === 'follow') {
      const next = { ...conditionOverrides };
      delete next[name];
      setConditionOverrides(next);
    } else {
      setConditionOverrides({
        ...conditionOverrides,
        [name]: valueStr === 'true',
      });
    }
  };

  const handleApply = () => {
    let conditionPolicy: ConditionPolicy;
    if (policyMode === 'ignore') {
      conditionPolicy = { mode: 'ignore' };
    } else if (policyMode === 'none') {
      conditionPolicy = { mode: 'none' };
    } else if (policyMode === 'manual') {
      conditionPolicy = { mode: 'manual', values: conditionOverrides };
    } else if (policyMode === 'source-with-overrides') {
      conditionPolicy = { mode: 'source-with-overrides', overrides: conditionOverrides };
    } else {
      conditionPolicy = { mode: 'source' };
    }

    onApply({
      entryPath: entryPath ? entryPath : null,
      traversal,
      conditionPolicy,
    });
    if (variant === 'dialog') {
      onClose();
    }
  };

  const inner = (
    <div
      className={variant === 'view' ? 'ProjectSetupViewCard' : 'ProjectSetupDialog'}
      role={variant === 'dialog' ? 'dialog' : undefined}
      aria-modal={variant === 'dialog' ? 'true' : undefined}
      aria-labelledby="project-setup-title"
      onClick={variant === 'dialog' ? (e) => e.stopPropagation() : undefined}
    >
      <div className="ProjectSetupHeader">
        <div>
          <h2 id="project-setup-title">Project Settings</h2>
          {variant === 'view' ? (
            <p className="ProjectSetupHelp">
              Configure project entry file, traversal scope, default condition behavior, and workspace preferences.
            </p>
          ) : null}
        </div>
        {variant === 'dialog' ? (
          <button
            type="button"
            className="ProjectSetupButton ProjectSetupButton--secondary"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        ) : null}
      </div>

      <div className="ProjectSetupBody">
        {/* Entry file */}
        <div className="ProjectSetupSection">
          <label htmlFor="project-entry-select" className="ProjectSetupLabel">
            Project Entry File
          </label>
          <select
            id="project-entry-select"
            className="ProjectSetupSelect"
            value={entryPath}
            onChange={(e) => setEntryPath(e.target.value)}
          >
            <option value="">(Select an entry...)</option>
            {fileKeys.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="ProjectSetupHelp">
            The root document from which project traversal and structural resolution begin.
          </p>
        </div>

        {/* Semantic traversal */}
        <div className="ProjectSetupSection">
          <span className="ProjectSetupLabel">Input Traversal</span>
          <div className="ProjectSetupRadioGroup">
            <label>
              <input
                type="radio"
                name="traversal"
                value="project"
                checked={traversal === 'project'}
                onChange={() => setTraversal('project')}
              />{' '}
              Follow reachable inputs
            </label>
            <label>
              <input
                type="radio"
                name="traversal"
                value="file-only"
                checked={traversal === 'file-only'}
                onChange={() => setTraversal('file-only')}
              />{' '}
              Entry file only
            </label>
          </div>
          <p className="ProjectSetupHelp">
            Project traversal traces active <code>\input</code> commands (including subfolder relative paths) to resolve cross-file structure.
          </p>
        </div>

        {/* Condition policy */}
        <div className="ProjectSetupSection">
          <label htmlFor="condition-mode-select" className="ProjectSetupLabel">
            Condition Evaluation Policy
          </label>
          <select
            id="condition-mode-select"
            className="ProjectSetupSelect"
            value={policyMode}
            onChange={(e) => {
              if (isConditionPolicyMode(e.target.value)) {
                setPolicyMode(e.target.value);
              }
            }}
          >
            <option value="ignore">Ignore conditionals — visit all branches (default)</option>
            <option value="source">Follow source declarations and setters</option>
            <option value="source-with-overrides">Follow source with named overrides</option>
            <option value="manual">Force explicit boolean values</option>
            <option value="none">None — assert source is condition-free</option>
          </select>
          <p className="ProjectSetupHelp">
            {policyMode === 'ignore'
              ? 'Treats conditionals like ordinary commands so whole-document renames, comment removal, and environment edits apply across all branches.'
              : policyMode === 'none'
              ? 'Disables condition preprocessing: any unrealized conditional blocks the structural view (use after standalone Condition Realization).'
              : 'Forced values evaluate the same at every test occurrence and are not changed by source setters.'}
          </p>
        </div>

        {/* Recognized condition names */}
        {detectedConditions.length > 0 &&
          (policyMode === 'source-with-overrides' || policyMode === 'manual') && (
            <div className="ProjectSetupSection">
              <span className="ProjectSetupLabel">Recognized Conditions</span>
              <div className="ProjectSetupConditionsList">
                {detectedConditions.map((cond) => {
                  const val = conditionOverrides[cond];
                  const currentChoice =
                    val === true ? 'true' : val === false ? 'false' : 'follow';
                  return (
                    <div key={cond} className="ProjectSetupConditionRow">
                      <span className="ProjectSetupConditionName">\if{cond}</span>
                      <select
                        className="ProjectSetupConditionSelect"
                        value={currentChoice}
                        onChange={(e) => handleConditionChange(cond, e.target.value)}
                        aria-label={`Setting for \\if${cond}`}
                      >
                        {policyMode === 'source-with-overrides' && (
                          <option value="follow">Follow source</option>
                        )}
                        {policyMode === 'manual' && val === undefined && (
                          <option value="follow">(Select value...)</option>
                        )}
                        <option value="true">Force true</option>
                        <option value="false">Force false</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {variant === 'view' && onToggleSplit ? (
          <div className="ProjectSetupSection">
            <span className="ProjectSetupLabel">Workspace Layout</span>
            <label className="ProjectSetupCheck">
              <input type="checkbox" checked={Boolean(splitEnabled)} onChange={onToggleSplit} />
              <span>Enable Side-by-Side Split Companion View by default</span>
            </label>
          </div>
        ) : null}

        {variant === 'view' ? (
          <div className="ProjectSetupSection">
            <span className="ProjectSetupLabel">
              Custom Command Signatures ({customCommands.length})
            </span>
            {customCommands.length === 0 ? (
              <p className="ProjectSetupHelp">
                No custom command signatures configured. Define arity and optional arguments from the Catalog view.
              </p>
            ) : (
              <div className="ProjectSetupConditionsList">
                {customCommands.map((sig) => (
                  <div key={sig.name} className="ProjectSetupConditionRow">
                    <span className="ProjectSetupConditionName">
                      <code>\{sig.name}</code> ({sig.mandatoryArgs} mandatory, {sig.optionalArgs ?? 0} optional)
                    </span>
                    {onRemoveCustomCommand ? (
                      <button
                        type="button"
                        className="ProjectSetupButton ProjectSetupButton--secondary"
                        onClick={() => onRemoveCustomCommand(sig.name)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="ProjectSetupFooter">
        {variant === 'dialog' ? (
          <button
            type="button"
            className="ProjectSetupButton ProjectSetupButton--secondary"
            onClick={onClose}
          >
            Continue inspecting sources
          </button>
        ) : null}
        <button
          type="button"
          className="ProjectSetupButton ProjectSetupButton--primary"
          onClick={handleApply}
        >
          Apply Configuration
        </button>
      </div>
    </div>
  );

  if (variant === 'view') {
    return (
      <section className="WorkspaceViewPane ProjectSetupView" aria-label="Settings">
        {inner}
      </section>
    );
  }

  return (
    <div className="ProjectSetupOverlay" onClick={onClose}>
      {inner}
    </div>
  );
}
export default ProjectSetupDialog;
