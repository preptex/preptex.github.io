import './ControlPanel.css';

type InputCmdHandlingUI = 'none' | 'flatten' | 'recursive';

export type CoreOptionsUI = {
  suppressComments: boolean;
  handleInputCmd: InputCmdHandlingUI;
  handleIfConditions: boolean;
  ifDecisions: string[];
  outputName: string;
};

export type ControlPanelProps = {
  options: CoreOptionsUI;
  onChange: (next: CoreOptionsUI) => void;
  availableIfConditions?: string[];
  entryFile?: string;
  onTransform?: () => void;
};

export default function ControlPanel({
  options,
  onChange,
  availableIfConditions = [],
  entryFile = '',
  onTransform,
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
    const exists = options.ifDecisions.includes(cond);
    const nextIfs = exists
      ? options.ifDecisions.filter((c) => c !== cond)
      : [...options.ifDecisions, cond];
    onChange({ ...options, ifDecisions: nextIfs });
  };

  return (
    <section className="ControlPanel" aria-label="Control panel">
      <div className="ControlPanelHeader">
        <div>
          <h2>Control Panel</h2>
          <p>Configure the transformation pipeline and run it on your project.</p>
        </div>

        {onTransform ? (
          <button
            type="button"
            className="ControlButton"
            onClick={onTransform}
            disabled={!entryFile}
            title={entryFile ? `Transform ${entryFile}` : 'Select a file first'}
          >
            Run Pipeline
          </button>
        ) : null}
      </div>

      <div className="ControlPanelBody">
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

        <div className="ControlGroup">
          <h3>Input Command</h3>
          <label className="ControlField" htmlFor="handleInputCmd">
            <span>Input command</span>
            <select
              id="handleInputCmd"
              className="ControlInput"
              value={options.handleInputCmd}
              onChange={(e) =>
                onChange({ ...options, handleInputCmd: e.target.value as InputCmdHandlingUI })
              }
            >
              <option value="none">none</option>
              <option value="flatten">flatten</option>
              <option value="recursive">recursive</option>
            </select>
          </label>
        </div>

        <div className="ControlGroup ControlGroup--compact">
          <h3>Comments</h3>
          <label className="ControlCheck">
            <input
              type="checkbox"
              checked={options.suppressComments}
              onChange={toggleSuppressComments}
            />
            <span>Suppress comments</span>
          </label>
        </div>

        <div className="ControlGroup ControlGroup--conditions">
          <div className="ControlConditionsHeader">
            <div>
              <h3>Conditions</h3>
              <p>Select the conditions to include in the transformation.</p>
            </div>
            <label className="ControlSwitch">
              <input
                type="checkbox"
                checked={options.handleIfConditions}
                onChange={toggleHandleIfConditions}
              />
              <span>Enable</span>
            </label>
          </div>

          <ul className="ConditionsList" role="listbox" aria-label="Available if conditions">
            {availableIfConditions.length === 0 ? (
              <li className="ControlEmpty">No conditions found</li>
            ) : (
              availableIfConditions.map((cond) => {
                const selected = options.ifDecisions.includes(cond);
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
      </div>
    </section>
  );
}
