import { useState } from 'react';
import './ControlPanel.css';
import { InputHandlingMode, isInputHandlingMode } from '@preptex/core';
import type { ConditionName, GeneratedArtifact, ProjectFilePath } from '@preptex/core';
import type { CoreOptionsUI } from '../model/useControl';

export type ControlPanelProps = {
  options: CoreOptionsUI;
  onChange: (next: CoreOptionsUI) => void;
  availableIfConditions?: readonly ConditionName[];
  entryFile?: ProjectFilePath;
  canTransform: boolean;
  onTransform?: () => void;
  onRunReferences?: () => void;
  canRunReferences?: boolean;
  referencesReason?: string;
  onRunCommandUsage?: () => void;
  canRunCommandUsage?: boolean;
  commandUsageReason?: string;
  isAnalyzing?: boolean;

  onPreviewCommentSuppression?: (
    target: 'source' | 'selected',
    suppressCommentEnvironments: boolean,
  ) => void;
  onPreviewRemoveEnvironments?: (
    names: readonly string[],
    target: 'source' | 'selected',
  ) => void;
  onExportProject?: (
    conditions: 'preserve' | 'materialize',
    inputs: 'preserve' | 'inline',
  ) => void;
  artifacts?: readonly GeneratedArtifact[];
  onDownloadZip?: () => void;
  onDownloadArtifact?: (artifact: GeneratedArtifact) => void;
  onSelectArtifact?: (artifact: GeneratedArtifact) => void;
};

export default function ControlPanel({
  options,
  onChange,
  availableIfConditions = [],
  entryFile = '',
  onTransform,
  canTransform,
  onRunReferences,
  canRunReferences = false,
  referencesReason,
  onRunCommandUsage,
  canRunCommandUsage = false,
  commandUsageReason,
  isAnalyzing = false,
  onPreviewCommentSuppression,
  onPreviewRemoveEnvironments,
  onExportProject,
  artifacts = [],
  onDownloadZip,
  onDownloadArtifact,
  onSelectArtifact,
}: ControlPanelProps) {
  const [commentTarget, setCommentTarget] = useState<'source' | 'selected'>('source');
  const [suppressCommentEnvs, setSuppressCommentEnvs] = useState(false);

  const [envNamesText, setEnvNamesText] = useState('');
  const [envTarget, setEnvTarget] = useState<'source' | 'selected'>('source');

  const [exportConditions, setExportConditions] = useState<'preserve' | 'materialize'>('preserve');
  const [exportInputs, setExportInputs] = useState<'preserve' | 'inline'>('preserve');
  const outputPreview =
    options.outputName || (entryFile ? entryFile.replace(/\.tex$/i, '') + '.processed.tex' : '');

  const toggleSuppressComments = () => {
    onChange({ ...options, suppressComments: !options.suppressComments });
  };

  const toggleHandleIfConditions = () => {
    onChange({ ...options, handleIfConditions: !options.handleIfConditions });
  };

  const toggleCondition = (cond: string) => {
    if (!options.handleIfConditions) return;
    const exists = options.enabledConditions.includes(cond);
    const nextIfs = exists
      ? options.enabledConditions.filter((c) => c !== cond)
      : [...options.enabledConditions, cond];
    onChange({ ...options, enabledConditions: nextIfs });
  };

  return (
    <section className="ControlPanel" aria-label="Control panel">
      <div className="ControlPanelBody">
        <div className="ControlColumn ControlColumn--left">
          <div className="ControlGroup ControlGroup--entry">
            <h3>Entry &amp; Output</h3>
            <div className="ControlFieldGrid">
              <label className="ControlField" htmlFor="entryFile">
                <span>Entry file</span>
                <input
                  id="entryFile"
                  className="ControlInput"
                  type="text"
                  value={entryFile || 'No file selected'}
                  readOnly
                />
              </label>

              <label className="ControlField" htmlFor="outputName">
                <span>Output file name</span>
                <input
                  id="outputName"
                  className="ControlInput"
                  type="text"
                  placeholder={outputPreview || 'main.processed.tex'}
                  value={options.outputName}
                  onChange={(e) => onChange({ ...options, outputName: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="ControlGroup ControlGroup--processing">
            <h3>Basic Options</h3>
            <div className="ControlSubgroup">
              <h4>Input Command</h4>
              <p className="ControlSubtitle">
                Handle <code>\input</code> command
              </p>
              <label className="ControlField" htmlFor="handleInputCmd">
                <select
                  id="handleInputCmd"
                  className="ControlInput"
                  value={options.inputHandling}
                  aria-label="Input handling"
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (isInputHandlingMode(mode)) onChange({ ...options, inputHandling: mode });
                  }}
                >
                  <option value={InputHandlingMode.Preserve}>preserve</option>
                  <option value={InputHandlingMode.Flatten}>flatten</option>
                  <option value={InputHandlingMode.Separate}>separate</option>
                </select>
              </label>
            </div>

            <div className="ControlSubgroup">
              <h4>Comments</h4>
              <label className="ControlCheck">
                <input
                  type="checkbox"
                  checked={options.suppressComments}
                  onChange={toggleSuppressComments}
                />
                <span>Suppress comments</span>
              </label>
            </div>
          </div>
        </div>

        <div className="ControlColumn ControlColumn--right">
          <div className="ControlGroup ControlGroup--conditions">
            <div className="ControlConditionsHeader">
              <h3>Conditions</h3>
              <label className="ControlSwitch">
                <input
                  type="checkbox"
                  checked={options.handleIfConditions}
                  onChange={toggleHandleIfConditions}
                />
                <span>Enable</span>
              </label>
              <p>Select the conditions to include.</p>
            </div>

            <ul className="ConditionsList" role="listbox" aria-label="Available if conditions">
              {availableIfConditions.length === 0 ? (
                <li className="ControlEmpty">No conditions found</li>
              ) : (
                availableIfConditions.map((cond) => {
                  const selected = options.enabledConditions.includes(cond);
                  return (
                    <li key={cond}>
                      <button
                        type="button"
                        className={
                          selected
                            ? 'ConditionItem ConditionItem--selected'
                            : 'ConditionItem'
                        }
                        aria-pressed={selected}
                        disabled={!options.handleIfConditions}
                        onClick={() => toggleCondition(cond)}
                      >
                        <span className="ConditionBox" aria-hidden="true" />
                        <span>{cond}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="ControlGroup ControlGroup--action">
            <h3>Operations</h3>
            <div className="ControlSubgroup">
              <h4>Analyses</h4>
              <div className="ControlActionButtons">
                {onRunReferences ? (
                  <button
                    type="button"
                    className="ControlButton ControlButton--secondary"
                    onClick={onRunReferences}
                    disabled={!canRunReferences || isAnalyzing}
                    title={referencesReason || 'Check references in configured project'}
                  >
                    Check References
                  </button>
                ) : null}
                {onRunCommandUsage ? (
                  <button
                    type="button"
                    className="ControlButton ControlButton--secondary"
                    onClick={onRunCommandUsage}
                    disabled={!canRunCommandUsage || isAnalyzing}
                    title={commandUsageReason || 'Check command definitions and usage'}
                  >
                    Check Commands
                  </button>
                ) : null}
              </div>
            </div>

            <div className="ControlSubgroup">
              <h4>Pipeline</h4>
              {onTransform ? (
                <button
                  type="button"
                  className="ControlButton"
                  onClick={onTransform}
                  disabled={!canTransform}
                  title={canTransform ? `Transform ${entryFile}` : 'Select a successfully parsed file first'}
                >
                  Run
                </button>
              ) : null}
            </div>

            {onPreviewCommentSuppression ? (
              <div className="ControlSubgroup">
                <h4>Comment Suppression</h4>
                <div className="ControlFieldGrid">
                  <label className="ControlField" htmlFor="commentTargetSelect">
                    <span>Target</span>
                    <select
                      id="commentTargetSelect"
                      className="ControlInput"
                      value={commentTarget}
                      onChange={(e) => setCommentTarget(e.target.value as 'source' | 'selected')}
                    >
                      <option value="source">All sources</option>
                      <option value="selected">Configured view</option>
                    </select>
                  </label>
                  <label className="ControlCheck">
                    <input
                      type="checkbox"
                      checked={suppressCommentEnvs}
                      onChange={(e) => setSuppressCommentEnvs(e.target.checked)}
                    />
                    <span>Suppress comment environments</span>
                  </label>
                </div>
                <button
                  type="button"
                  className="ControlButton ControlButton--secondary"
                  onClick={() => onPreviewCommentSuppression(commentTarget, suppressCommentEnvs)}
                >
                  Preview Comments
                </button>
              </div>
            ) : null}

            {onPreviewRemoveEnvironments ? (
              <div className="ControlSubgroup">
                <h4>Remove Environments by Name</h4>
                <div className="ControlFieldGrid">
                  <label className="ControlField" htmlFor="envNamesInput">
                    <span>Names</span>
                    <input
                      id="envNamesInput"
                      type="text"
                      className="ControlInput"
                      placeholder="e.g. comment, C"
                      value={envNamesText}
                      onChange={(e) => setEnvNamesText(e.target.value)}
                    />
                  </label>
                  <label className="ControlField" htmlFor="envTargetSelect">
                    <span>Target</span>
                    <select
                      id="envTargetSelect"
                      className="ControlInput"
                      value={envTarget}
                      onChange={(e) => setEnvTarget(e.target.value as 'source' | 'selected')}
                    >
                      <option value="source">All sources</option>
                      <option value="selected">Configured view</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="ControlButton ControlButton--secondary"
                  disabled={!envNamesText.trim()}
                  onClick={() => {
                    const names = envNamesText
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (names.length > 0) {
                      onPreviewRemoveEnvironments(names, envTarget);
                    }
                  }}
                >
                  Preview Removal
                </button>
              </div>
            ) : null}

            {onExportProject ? (
              <div className="ControlSubgroup">
                <h4>Materialize &amp; Export Project</h4>
                <div className="ControlFieldGrid">
                  <label className="ControlField" htmlFor="exportConditions">
                    <span>Conditions</span>
                    <select
                      id="exportConditions"
                      className="ControlInput"
                      value={exportConditions}
                      onChange={(e) =>
                        setExportConditions(e.target.value as 'preserve' | 'materialize')
                      }
                    >
                      <option value="preserve">Preserve</option>
                      <option value="materialize">Materialize</option>
                    </select>
                  </label>
                  <label className="ControlField" htmlFor="exportInputs">
                    <span>Inputs</span>
                    <select
                      id="exportInputs"
                      className="ControlInput"
                      value={exportInputs}
                      onChange={(e) =>
                        setExportInputs(e.target.value as 'preserve' | 'inline')
                      }
                    >
                      <option value="preserve">Preserve</option>
                      <option value="inline">Inline</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="ControlButton ControlButton--secondary"
                  onClick={() => onExportProject(exportConditions, exportInputs)}
                >
                  Export Project
                </button>
              </div>
            ) : null}

            {artifacts.length > 0 ? (
              <div className="ControlSubgroup ArtifactsSection">
                <h4>Generated Artifacts ({artifacts.length})</h4>
                {onDownloadZip ? (
                  <button
                    type="button"
                    className="ControlButton ControlButton--primary"
                    onClick={onDownloadZip}
                  >
                    Download ZIP
                  </button>
                ) : null}
                <div className="ArtifactsList">
                  {artifacts.map((art) => (
                    <div key={art.path} className="ArtifactItem">
                      <span className="ArtifactPath">{art.path}</span>
                      <span className="ArtifactTopology">{art.topology}</span>
                      <div className="ArtifactActions">
                        {onSelectArtifact ? (
                          <button
                            type="button"
                            className="ArtifactBtn"
                            onClick={() => onSelectArtifact(art)}
                          >
                            View
                          </button>
                        ) : null}
                        {onDownloadArtifact ? (
                          <button
                            type="button"
                            className="ArtifactBtn"
                            onClick={() => onDownloadArtifact(art)}
                          >
                            Download
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
