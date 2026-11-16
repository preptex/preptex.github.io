import { useState } from 'react';
import './ControlPanel.css';
import type {
  ConditionDecision,
  GeneratedArtifact,
  ProjectFilePath,
} from '@preptex/core';
import { isInputHandlingOption, type CoreOptionsUI } from '../model/useControl';

export type ControlPanelProps = {
  options: CoreOptionsUI;
  onChange: (next: CoreOptionsUI) => void;
  entryFile?: ProjectFilePath;
  canRealizeConditions?: boolean;
  realizeConditionsReason?: string;
  onRealizeConditions?: (
    mode: 'preview-edits' | 'export-artifacts',
    inputs: 'preserve' | 'inline',
  ) => void;
  conditionDecisions?: readonly ConditionDecision[];

  onRunReferences?: () => void;
  canRunReferences?: boolean;
  referencesReason?: string;
  onRunCommandUsage?: () => void;
  canRunCommandUsage?: boolean;
  commandUsageReason?: string;
  isAnalyzing?: boolean;

  canRunViewTransformations?: boolean;
  viewTransformationReason?: string;
  onPreviewCommentSuppression?: (suppressCommentEnvironments: boolean) => void;
  onPreviewRemoveEnvironments?: (
    names: readonly string[],
    target: 'selected' | 'artifact',
  ) => void;
  onExportProject?: () => void;
  canExportProject?: boolean;
  exportReason?: string;

  artifacts?: readonly GeneratedArtifact[];
  onDownloadZip?: () => void;
  onDownloadArtifact?: (artifact: GeneratedArtifact) => void;
  onSelectArtifact?: (artifact: GeneratedArtifact) => void;
};

export default function ControlPanel({
  options,
  onChange,
  entryFile = '',
  canRealizeConditions = false,
  realizeConditionsReason,
  onRealizeConditions,
  conditionDecisions = [],
  onRunReferences,
  canRunReferences = false,
  referencesReason,
  onRunCommandUsage,
  canRunCommandUsage = false,
  commandUsageReason,
  isAnalyzing = false,
  canRunViewTransformations = false,
  viewTransformationReason,
  onPreviewCommentSuppression,
  onPreviewRemoveEnvironments,
  onExportProject,
  canExportProject = false,
  exportReason,
  artifacts = [],
  onDownloadZip,
  onDownloadArtifact,
  onSelectArtifact,
}: ControlPanelProps) {
  const [realizeInputs, setRealizeInputs] = useState<'preserve' | 'inline'>('preserve');
  const [suppressCommentEnvs, setSuppressCommentEnvs] = useState(false);

  const [envNamesText, setEnvNamesText] = useState('');
  const [envTarget, setEnvTarget] = useState<'selected' | 'artifact'>('selected');

  const outputPreview =
    options.outputName || (entryFile ? entryFile : 'main.tex');

  const toggleSuppressComments = () => {
    onChange({ ...options, suppressComments: !options.suppressComments });
  };

  const toggleSuppressCommentEnvs = () => {
    onChange({
      ...options,
      suppressCommentEnvironments: !options.suppressCommentEnvironments,
    });
  };

  const toggleStripDeclarations = () => {
    onChange({
      ...options,
      stripDeclarationsAndSetters: !options.stripDeclarationsAndSetters,
    });
  };

  return (
    <section className="ControlPanel" aria-label="Control panel">
      <div className="ControlPanelBody">
        {/* Card 1: Pipeline B — Standalone Condition Realization */}
        <div className="ControlCard ControlCard--conditions">
          <div className="ControlCardHeader">
            <div className="ControlConditionsHeader">
              <h3>Condition Realization</h3>
              <span className="ControlPipelineBadge">Pipeline B</span>
            </div>
            <p className="ControlSubtitle">
              Evaluate and strip <code>\if...</code> branches without requiring balanced braces or environments.
            </p>
          </div>

          <label className="ControlCheck">
            <input
              type="checkbox"
              checked={options.stripDeclarationsAndSetters}
              onChange={toggleStripDeclarations}
            />
            <span>Strip declarations &amp; setters (<code>\newif</code>, <code>\Xtrue</code>)</span>
          </label>

          <label className="ControlField" htmlFor="realizeInputsSelect">
            <span>Artifact input handling</span>
            <select
              id="realizeInputsSelect"
              className="ControlInput"
              value={realizeInputs}
              onChange={(e) => {
                const val = e.target.value;
                if (isInputHandlingOption(val)) setRealizeInputs(val);
              }}
            >
              <option value="preserve">Preserve \input files</option>
              <option value="inline">Inline active \input files</option>
            </select>
          </label>

          {conditionDecisions.length > 0 ? (
            <div className="ControlDecisions" aria-label="Evaluated condition decisions">
              <div className="ControlDecisionsTitle">
                Condition Decisions ({conditionDecisions.length})
              </div>
              <ul className="ControlDecisionsList">
                {conditionDecisions.slice(0, 8).map((decision, idx) => (
                  <li key={`${decision.command}-${idx}`} className="ControlDecisionItem">
                    <code>\{decision.command}</code>
                    <span className={`ControlDecisionOutcome ControlDecisionOutcome--${decision.outcome}`}>
                      {decision.outcome}
                    </span>
                  </li>
                ))}
                {conditionDecisions.length > 8 ? (
                  <li className="ControlDecisionMore">
                    +{conditionDecisions.length - 8} more decisions
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {onRealizeConditions ? (
            <div className="ControlActionButtons">
              <button
                type="button"
                className="ControlButton ControlButton--primary"
                disabled={!canRealizeConditions}
                title={
                  canRealizeConditions
                    ? 'Preview in-place source edits stripping realized conditions'
                    : realizeConditionsReason || 'Upload source files first'
                }
                onClick={() => onRealizeConditions('preview-edits', 'preserve')}
              >
                Realize Conditions in Place
              </button>
              <button
                type="button"
                className="ControlButton ControlButton--secondary"
                disabled={!canRealizeConditions}
                title={
                  canRealizeConditions
                    ? 'Generate condition-free artifact files without altering sources'
                    : realizeConditionsReason || 'Upload source files first'
                }
                onClick={() => onRealizeConditions('export-artifacts', realizeInputs)}
              >
                Export Realized Files
              </button>
            </div>
          ) : null}
        </div>

        {/* Card 2: Pipeline A — Structural Analyses */}
        <div className="ControlCard ControlCard--analyses">
          <div className="ControlCardHeader">
            <div className="ControlConditionsHeader">
              <h3>Analyses</h3>
              <span className="ControlPipelineBadge">Pipeline A</span>
            </div>
            <p className="ControlSubtitle">Inspect realized document structure without generating output</p>
          </div>
          <div className="ControlActionButtons">
            {onRunReferences ? (
              <div className="ControlActionRow">
                <button
                  type="button"
                  className="ControlButton ControlButton--secondary"
                  onClick={onRunReferences}
                  disabled={!canRunReferences || isAnalyzing}
                  title={referencesReason || 'Check references in realized project view'}
                >
                  Check References
                </button>
                <span className="ControlActionDescription">Verify label references across active files</span>
              </div>
            ) : null}
            {onRunCommandUsage ? (
              <div className="ControlActionRow">
                <button
                  type="button"
                  className="ControlButton ControlButton--secondary"
                  onClick={onRunCommandUsage}
                  disabled={!canRunCommandUsage || isAnalyzing}
                  title={commandUsageReason || 'Check command definitions and usage'}
                >
                  Check Commands
                </button>
                <span className="ControlActionDescription">Check defined vs recognized commands</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Card 3: Pipeline A — Structural Edits */}
        <div className="ControlCard ControlCard--transformations">
          <div className="ControlCardHeader">
            <div className="ControlConditionsHeader">
              <h3>Structural Edits</h3>
              <span className="ControlPipelineBadge">Pipeline A</span>
            </div>
            <p className="ControlSubtitle">Preview and apply changes on the realized view</p>
          </div>

          {onPreviewCommentSuppression ? (
            <div className="ControlSubgroup">
              <h4>Comment Suppression</h4>
              <label className="ControlCheck">
                <input
                  type="checkbox"
                  checked={suppressCommentEnvs}
                  onChange={(e) => setSuppressCommentEnvs(e.target.checked)}
                />
                <span>Suppress comment environments</span>
              </label>
              <button
                type="button"
                className="ControlButton ControlButton--secondary"
                disabled={!canRunViewTransformations}
                title={
                  canRunViewTransformations
                    ? 'Preview comment suppression edits on realized view'
                    : viewTransformationReason || 'A ready view is required'
                }
                onClick={() => onPreviewCommentSuppression(suppressCommentEnvs)}
              >
                Preview Comments
              </button>
            </div>
          ) : null}

          <div className="ControlCardDivider" />

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
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'selected' || val === 'artifact') {
                        setEnvTarget(val);
                      }
                    }}
                  >
                    <option value="selected">Source edits (selected)</option>
                    <option value="artifact">Inlined artifact</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="ControlButton ControlButton--secondary"
                disabled={!canRunViewTransformations || !envNamesText.trim()}
                title={
                  canRunViewTransformations
                    ? 'Preview or generate environment removal'
                    : viewTransformationReason || 'A ready view is required'
                }
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
        </div>

        {/* Card 4: Pipeline A — Export Realized Project */}
        <div className="ControlCard ControlCard--entry">
          <div className="ControlCardHeader">
            <div className="ControlConditionsHeader">
              <h3>Export Project</h3>
              <span className="ControlPipelineBadge">Pipeline A</span>
            </div>
            <p className="ControlSubtitle">
              Emit condition-free artifacts from the realized view
            </p>
          </div>
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
              <span>Output file name (single artifact)</span>
              <input
                id="outputName"
                className="ControlInput"
                type="text"
                placeholder={outputPreview}
                value={options.outputName}
                onChange={(e) => onChange({ ...options, outputName: e.target.value })}
              />
            </label>
          </div>

          <div className="ControlSubgroup">
            <h4>Input Handling</h4>
            <label className="ControlField" htmlFor="handleInputCmd">
              <select
                id="handleInputCmd"
                className="ControlInput"
                value={options.inputHandling}
                aria-label="Input handling"
                onChange={(e) => {
                  const mode = e.target.value;
                  if (isInputHandlingOption(mode)) onChange({ ...options, inputHandling: mode });
                }}
              >
                <option value="preserve">preserve</option>
                <option value="inline">inline</option>
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
            <label className="ControlCheck">
              <input
                type="checkbox"
                checked={options.suppressCommentEnvironments}
                onChange={toggleSuppressCommentEnvs}
              />
              <span>Suppress comment environments</span>
            </label>
          </div>

          {onExportProject ? (
            <div className="ControlPipelineAction">
              <button
                type="button"
                className="ControlButton ControlButton--primary"
                onClick={onExportProject}
                disabled={!canExportProject}
                title={
                  canExportProject
                    ? `Export realized project from ${entryFile}`
                    : exportReason || 'Configure a ready project view first'
                }
              >
                Export Project
              </button>
            </div>
          ) : null}
        </div>

        {/* Card 5: Generated Artifacts (if available) */}
        {artifacts.length > 0 ? (
          <div className="ControlCard ControlCard--artifacts">
            <div className="ControlCardHeader">
              <div className="ArtifactsHeaderRow">
                <h3>Generated Artifacts ({artifacts.length})</h3>
                {onDownloadZip ? (
                  <button
                    type="button"
                    className="ControlButton ControlButton--primary"
                    onClick={onDownloadZip}
                  >
                    Download ZIP
                  </button>
                ) : null}
              </div>
              <p className="ControlSubtitle">Review or download condition-realized output files</p>
            </div>
            <div className="ArtifactsList">
              {artifacts.map((art) => (
                <div key={art.path} className="ArtifactItem">
                  <span className="ArtifactPath" title={art.path}>{art.path}</span>
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
    </section>
  );
}
