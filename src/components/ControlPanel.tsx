import './ControlPanel.css';
import { InputHandlingMode, isInputHandlingMode } from '@preptex/core';
import type { ConditionName, ProjectFilePath } from '@preptex/core';
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
}: ControlPanelProps) {
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
          </div>
        </div>
      </div>
    </section>
  );
}
