import React, { useEffect, useState } from 'react';
import type { ConditionPolicy, ProjectFilePath } from '@preptex/core';
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
}

export function ProjectSetupDialog({
  isOpen,
  onClose,
  files,
  configuration,
  onApply,
  detectedConditions,
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
  const [policyMode, setPolicyMode] = useState<'source' | 'source-with-overrides' | 'manual'>(
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

  // Reset local draft whenever dialog opens or configuration changes
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, configuration, files]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    if (policyMode === 'manual') {
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
    onClose();
  };

  return (
    <div className="ProjectSetupOverlay" onClick={onClose}>
      <div
        className="ProjectSetupDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ProjectSetupHeader">
          <h2 id="project-setup-title">Project Settings</h2>
          <button
            type="button"
            className="ProjectSetupButton ProjectSetupButton--secondary"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
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
              Project traversal traces active <code>\input</code> commands to resolve cross-file structure.
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
                const nextMode = e.target.value as 'source' | 'source-with-overrides' | 'manual';
                setPolicyMode(nextMode);
              }}
            >
              <option value="source">Follow source declarations and setters (default)</option>
              <option value="source-with-overrides">Follow source with named overrides</option>
              <option value="manual">Force explicit boolean values</option>
            </select>
            <p className="ProjectSetupHelp">
              Forced values evaluate the same at every test occurrence and are not changed by source setters.
            </p>
          </div>

          {/* Recognized condition names */}
          {detectedConditions.length > 0 && policyMode !== 'source' && (
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
                        <option value="follow">Follow source</option>
                        <option value="true">Force true</option>
                        <option value="false">Force false</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="ProjectSetupFooter">
          <button
            type="button"
            className="ProjectSetupButton ProjectSetupButton--secondary"
            onClick={onClose}
          >
            Continue inspecting sources
          </button>
          <button
            type="button"
            className="ProjectSetupButton ProjectSetupButton--primary"
            onClick={handleApply}
          >
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
export default ProjectSetupDialog;
