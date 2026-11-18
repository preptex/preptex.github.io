import { useEffect, useState } from 'react';
import './ControlPanel.css';
import type {
  ConditionDecision,
  ConditionPolicy,
  GeneratedArtifact,
  ProjectFilePath,
} from '@preptex/core';
import type { CoreOptionsUI } from '../model/useControl';
import { normalizeOutputFolder } from '../utils/transformOutput';

export type TransformationScopeOption = 'source' | 'selected';
export type TransformDestination = 'inplace' | 'new-files';

export interface UnifiedTransformRequest {
  readonly destination: TransformDestination;
  readonly outputFolder: string;
  readonly realizeConditions: boolean;
  readonly stripDeclarationsAndSetters: boolean;
  readonly suppressComments: {
    readonly enabled: boolean;
    readonly suppressCommentEnvironments: boolean;
    readonly target: TransformationScopeOption;
  };
  readonly removeEnvironments: {
    readonly enabled: boolean;
    readonly names: readonly string[];
    readonly target: TransformationScopeOption;
  };
  readonly expandInputs: {
    readonly enabled: boolean;
    readonly mode: 'single' | 'recursive';
    readonly target: TransformationScopeOption;
  };
}

export type ControlPanelProps = {
  options: CoreOptionsUI;
  onChange: (next: CoreOptionsUI) => void;
  entryFile?: ProjectFilePath;
  conditionPolicy?: ConditionPolicy;
  hasConditionals?: boolean;
  detectedConditions?: readonly string[];
  onConfigureConditions?: (policy: ConditionPolicy) => void;
  defaultTransformTarget?: TransformationScopeOption;
  canRunSourceTransformations?: boolean;
  canRealizeConditions?: boolean;
  realizeConditionsReason?: string;
  conditionDecisions?: readonly ConditionDecision[];
  canRunViewTransformations?: boolean;
  viewTransformationReason?: string;
  onApplyTransformations?: (request: UnifiedTransformRequest) => void;

  artifacts?: readonly GeneratedArtifact[];
  onDownloadZip?: () => void;
  onDownloadArtifact?: (artifact: GeneratedArtifact) => void;
  onSelectArtifact?: (artifact: GeneratedArtifact) => void;
};

type BoxKey = 'realize' | 'comments' | 'environments' | 'expand';

function buildConditionPolicy(
  mode: ConditionPolicy['mode'],
  overrides: Record<string, boolean>,
): ConditionPolicy {
  if (mode === 'ignore') return { mode: 'ignore' };
  if (mode === 'none') return { mode: 'none' };
  if (mode === 'manual') return { mode: 'manual', values: overrides };
  if (mode === 'source-with-overrides') return { mode: 'source-with-overrides', overrides };
  return { mode: 'source' };
}

export default function ControlPanel({
  options,
  onChange,
  entryFile = '',
  conditionPolicy,
  hasConditionals = false,
  detectedConditions = [],
  onConfigureConditions,
  defaultTransformTarget = 'selected',
  canRunSourceTransformations,
  canRealizeConditions = false,
  realizeConditionsReason,
  conditionDecisions = [],
  canRunViewTransformations = false,
  viewTransformationReason,
  onApplyTransformations,
  artifacts = [],
  onDownloadZip,
  onDownloadArtifact,
  onSelectArtifact,
}: ControlPanelProps) {
  const [active, setActive] = useState<Record<BoxKey, boolean>>({
    realize: false,
    comments: false,
    environments: false,
    expand: false,
  });
  const [expanded, setExpanded] = useState<Record<BoxKey, boolean>>({
    realize: false,
    comments: false,
    environments: false,
    expand: false,
  });

  const [commentScope, setCommentScope] = useState<TransformationScopeOption>(defaultTransformTarget);
  const [envNamesText, setEnvNamesText] = useState('');
  const [envScope, setEnvScope] = useState<TransformationScopeOption>(defaultTransformTarget);
  const [expandMode, setExpandMode] = useState<'single' | 'recursive'>('single');
  const [expandScope, setExpandScope] = useState<TransformationScopeOption>(defaultTransformTarget);

  const [destination, setDestination] = useState<TransformDestination>('inplace');
  const [outputFolder, setOutputFolder] = useState('');

  const [inlinePolicyMode, setInlinePolicyMode] = useState<ConditionPolicy['mode']>(
    conditionPolicy && conditionPolicy.mode !== 'ignore' ? conditionPolicy.mode : 'source',
  );
  const [inlineOverrides, setInlineOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCommentScope(defaultTransformTarget);
    setEnvScope(defaultTransformTarget);
    setExpandScope(defaultTransformTarget);
  }, [defaultTransformTarget]);

  const parsedEnvNames = envNamesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const effectiveCanRunSource = canRunSourceTransformations ?? canRunViewTransformations;
  const commentsRunnable =
    !active.comments ||
    (commentScope === 'source' ? effectiveCanRunSource : canRunViewTransformations);
  const envsRunnable =
    !active.environments ||
    (envScope === 'source' ? effectiveCanRunSource : canRunViewTransformations);
  const expandRunnable =
    !active.expand ||
    (expandScope === 'source' ? effectiveCanRunSource : canRunViewTransformations);
  const realizeRunnable = !active.realize || canRealizeConditions;

  const activeNames: string[] = [];
  if (active.realize) activeNames.push('Realize Conditions');
  if (active.comments) activeNames.push('Suppress Comments');
  if (active.environments) activeNames.push('Remove Environments');
  if (active.expand) activeNames.push('Expand \\input');

  const hasMissingEnvNames = active.environments && parsedEnvNames.length === 0;
  const normalizedFolder = normalizeOutputFolder(outputFolder);
  const hasInvalidFolder = destination === 'new-files' && normalizedFolder === null;

  const canApply =
    Boolean(onApplyTransformations) &&
    activeNames.length > 0 &&
    !hasMissingEnvNames &&
    !hasInvalidFolder &&
    realizeRunnable &&
    commentsRunnable &&
    envsRunnable &&
    expandRunnable;

  let disabledHint: string | undefined;
  if (activeNames.length === 0) {
    disabledHint = 'Activate one or more transformation boxes above.';
  } else if (hasMissingEnvNames) {
    disabledHint = 'Enter at least one environment name in Remove Environments.';
  } else if (hasInvalidFolder) {
    disabledHint = 'Output folder path cannot contain "." or ".." segments.';
  } else if (!realizeRunnable) {
    disabledHint = realizeConditionsReason || 'Source files are required to realize conditions.';
  } else if (!commentsRunnable || !envsRunnable || !expandRunnable) {
    disabledHint =
      viewTransformationReason || 'Configure a valid project view or switch scope to whole document.';
  }

  const allExpanded =
    expanded.realize && expanded.comments && expanded.environments && expanded.expand;

  const toggleAllExpanded = () => {
    const next = !allExpanded;
    setExpanded({
      realize: next,
      comments: next,
      environments: next,
      expand: next,
    });
  };

  const toggleActiveBox = (key: BoxKey, autoExpandIfEmpty = false) => {
    setActive((prev) => {
      const nextActive = !prev[key];
      if (nextActive && autoExpandIfEmpty) {
        setExpanded((cur) => ({ ...cur, [key]: true }));
      }
      return { ...prev, [key]: nextActive };
    });
  };

  const updateInlinePolicy = (
    nextMode: ConditionPolicy['mode'],
    nextOverrides: Record<string, boolean>,
  ) => {
    setInlinePolicyMode(nextMode);
    setInlineOverrides(nextOverrides);
    onConfigureConditions?.(buildConditionPolicy(nextMode, nextOverrides));
  };

  const handleApply = () => {
    if (!onApplyTransformations || !canApply) return;
    onApplyTransformations({
      destination,
      outputFolder,
      realizeConditions: active.realize,
      stripDeclarationsAndSetters: options.stripDeclarationsAndSetters,
      suppressComments: {
        enabled: active.comments,
        suppressCommentEnvironments: options.suppressCommentEnvironments,
        target: commentScope,
      },
      removeEnvironments: {
        enabled: active.environments,
        names: parsedEnvNames,
        target: envScope,
      },
      expandInputs: {
        enabled: active.expand,
        mode: expandMode,
        target: expandScope,
      },
    });
  };

  const previewSampleName = entryFile || 'main.tex';
  const previewOutputPath =
    normalizedFolder && normalizedFolder.length > 0
      ? `${normalizedFolder}/${previewSampleName}`
      : previewSampleName.replace(/(\.[^./\\]+)?$/, (ext) => `.transformed${ext || '.tex'}`);

  return (
    <section className="ControlPanel" aria-label="Control panel">
      <div className="TransformToolbar">
        <span className="TransformToolbarHint">
          Activate the transformations you want to run, expand any box to adjust its options, and apply below.
        </span>
        <button
          type="button"
          className="TransformExpandAllBtn"
          aria-expanded={allExpanded}
          onClick={toggleAllExpanded}
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="TransformBoxes">
        {/* Box 1: Realize Conditions */}
        <div className={`TransformBox ${active.realize ? 'TransformBox--active' : ''}`}>
          <div className="TransformBoxHeader">
            <label className="TransformBoxToggle">
              <input
                type="checkbox"
                checked={active.realize}
                onChange={() => toggleActiveBox('realize')}
              />
              <span className="TransformBoxTitle">Realize Conditions</span>
            </label>
            <span className={`TransformStatusPill ${active.realize ? 'is-active' : ''}`}>
              {active.realize ? 'Active' : 'Inactive'}
            </span>
          </div>
          <details
            className="TransformDetails"
            open={expanded.realize}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open;
              setExpanded((prev) => (prev.realize === isOpen ? prev : { ...prev, realize: isOpen }));
            }}
          >
            <summary className="TransformSummary">
              <span className="TransformSummaryLabel">Options</span>
              <span className="TransformSummaryHint">
                {options.stripDeclarationsAndSetters ? 'Strip \\newif/setters' : 'Keep declarations'}
                {conditionPolicy ? ` · ${conditionPolicy.mode}` : ''}
              </span>
            </summary>
            <div className="TransformBoxBody">
              <p className="ControlSubtitle">
                Evaluate and strip <code>\if...</code> directives and inactive branches without requiring balanced environments.
              </p>
              <label className="ControlCheck">
                <input
                  type="checkbox"
                  checked={options.stripDeclarationsAndSetters}
                  onChange={() =>
                    onChange({
                      ...options,
                      stripDeclarationsAndSetters: !options.stripDeclarationsAndSetters,
                    })
                  }
                />
                <span>Strip declarations &amp; setters (<code>\newif</code>, <code>\Xtrue</code>)</span>
              </label>

              {hasConditionals && onConfigureConditions ? (
                <div className="ControlInlinePhase0">
                  <div className="ControlInlinePhase0Header">
                    <strong>Condition Paths</strong>
                    <span className="ControlInlinePhase0Mode">
                      Active: {conditionPolicy?.mode ?? 'ignore'}
                    </span>
                  </div>
                  <select
                    className="ControlInput"
                    aria-label="Realization condition policy"
                    value={inlinePolicyMode}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (
                        val === 'source' ||
                        val === 'source-with-overrides' ||
                        val === 'manual' ||
                        val === 'none' ||
                        val === 'ignore'
                      ) {
                        updateInlinePolicy(val, inlineOverrides);
                      }
                    }}
                  >
                    <option value="source">Follow source declarations &amp; setters</option>
                    <option value="source-with-overrides">Source with named overrides</option>
                    <option value="manual">Force explicit boolean values</option>
                    <option value="ignore">Ignore conditionals (all branches)</option>
                    <option value="none">Condition-free (none)</option>
                  </select>
                  {detectedConditions.length > 0 &&
                  (inlinePolicyMode === 'source-with-overrides' ||
                    inlinePolicyMode === 'manual') ? (
                    <div className="ControlInlineConditionsGrid">
                      {detectedConditions.map((cond) => {
                        const current = inlineOverrides[cond];
                        const valueStr =
                          current === true ? 'true' : current === false ? 'false' : 'follow';
                        return (
                          <label key={cond} className="ControlInlineCondRow">
                            <span><code>\if{cond}</code></span>
                            <select
                              className="ControlInput"
                              value={valueStr}
                              aria-label={`Condition \\if${cond}`}
                              onChange={(e) => {
                                const v = e.target.value;
                                const next = { ...inlineOverrides };
                                if (v === 'follow') {
                                  delete next[cond];
                                } else {
                                  next[cond] = v === 'true';
                                }
                                updateInlinePolicy(inlinePolicyMode, next);
                              }}
                            >
                              {inlinePolicyMode === 'source-with-overrides' ? (
                                <option value="follow">Follow source</option>
                              ) : null}
                              {inlinePolicyMode === 'manual' && current === undefined ? (
                                <option value="follow">(Choose...)</option>
                              ) : null}
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {conditionDecisions.length > 0 ? (
                <div className="ControlDecisions" aria-label="Evaluated condition decisions">
                  <div className="ControlDecisionsTitle">
                    Condition Decisions ({conditionDecisions.length})
                  </div>
                  <ul className="ControlDecisionsList">
                    {conditionDecisions.slice(0, 8).map((decision, idx) => (
                      <li key={`${decision.command}-${idx}`} className="ControlDecisionItem">
                        <code>\{decision.command}</code>
                        <span
                          className={`ControlDecisionOutcome ControlDecisionOutcome--${decision.outcome}`}
                        >
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
            </div>
          </details>
        </div>

        {/* Box 2: Suppress Comments */}
        <div className={`TransformBox ${active.comments ? 'TransformBox--active' : ''}`}>
          <div className="TransformBoxHeader">
            <label className="TransformBoxToggle">
              <input
                type="checkbox"
                checked={active.comments}
                onChange={() => toggleActiveBox('comments')}
              />
              <span className="TransformBoxTitle">Suppress Comments</span>
            </label>
            <span className={`TransformStatusPill ${active.comments ? 'is-active' : ''}`}>
              {active.comments ? 'Active' : 'Inactive'}
            </span>
          </div>
          <details
            className="TransformDetails"
            open={expanded.comments}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open;
              setExpanded((prev) =>
                prev.comments === isOpen ? prev : { ...prev, comments: isOpen },
              );
            }}
          >
            <summary className="TransformSummary">
              <span className="TransformSummaryLabel">Options</span>
              <span className="TransformSummaryHint">
                {options.suppressCommentEnvironments
                  ? 'Line % + comment environments'
                  : 'Line % comments only'}{' '}
                · {commentScope === 'source' ? 'all branches' : 'configured branch'}
              </span>
            </summary>
            <div className="TransformBoxBody">
              <p className="ControlSubtitle">
                Strip TeX comments while keeping <code>verbatim</code> blocks intact.
              </p>
              <label className="ControlCheck">
                <input
                  type="checkbox"
                  checked={options.suppressCommentEnvironments}
                  onChange={() =>
                    onChange({
                      ...options,
                      suppressCommentEnvironments: !options.suppressCommentEnvironments,
                    })
                  }
                />
                <span>Also suppress comment environments</span>
              </label>
              <label className="ControlField" htmlFor="commentScopeSelect">
                <span>Scope</span>
                <select
                  id="commentScopeSelect"
                  className="ControlInput"
                  value={commentScope}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'source' || val === 'selected') {
                      setCommentScope(val);
                    }
                  }}
                >
                  <option value="source">All branches / whole document</option>
                  <option value="selected">Configured branch (selected)</option>
                </select>
              </label>
            </div>
          </details>
        </div>

        {/* Box 3: Remove Environments */}
        <div className={`TransformBox ${active.environments ? 'TransformBox--active' : ''}`}>
          <div className="TransformBoxHeader">
            <label className="TransformBoxToggle">
              <input
                type="checkbox"
                checked={active.environments}
                onChange={() => toggleActiveBox('environments', parsedEnvNames.length === 0)}
              />
              <span className="TransformBoxTitle">Remove Environments</span>
            </label>
            <span className={`TransformStatusPill ${active.environments ? 'is-active' : ''}`}>
              {active.environments ? 'Active' : 'Inactive'}
            </span>
          </div>
          <details
            className="TransformDetails"
            open={expanded.environments}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open;
              setExpanded((prev) =>
                prev.environments === isOpen ? prev : { ...prev, environments: isOpen },
              );
            }}
          >
            <summary className="TransformSummary">
              <span className="TransformSummaryLabel">Options</span>
              <span className="TransformSummaryHint">
                {parsedEnvNames.length > 0
                  ? parsedEnvNames.join(', ')
                  : 'No environments specified'}
              </span>
            </summary>
            <div className="TransformBoxBody">
              <p className="ControlSubtitle">
                Delete named <code>\begin{'{name}'}...\end{'{name}'}</code> blocks and their contents.
              </p>
              <div className="ControlFieldGrid ControlFieldGrid--two">
                <label className="ControlField" htmlFor="envNamesInput">
                  <span>Environment names (comma-separated)</span>
                  <input
                    id="envNamesInput"
                    type="text"
                    className="ControlInput"
                    placeholder="e.g. comment, draftnote, todo"
                    value={envNamesText}
                    onChange={(e) => setEnvNamesText(e.target.value)}
                  />
                </label>
                <label className="ControlField" htmlFor="envScopeSelect">
                  <span>Scope</span>
                  <select
                    id="envScopeSelect"
                    className="ControlInput"
                    value={envScope}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'source' || val === 'selected') {
                        setEnvScope(val);
                      }
                    }}
                  >
                    <option value="source">All branches / whole document</option>
                    <option value="selected">Configured branch (selected)</option>
                  </select>
                </label>
              </div>
            </div>
          </details>
        </div>

        {/* Box 4: Expand / Flatten \input Commands */}
        <div className={`TransformBox ${active.expand ? 'TransformBox--active' : ''}`}>
          <div className="TransformBoxHeader">
            <label className="TransformBoxToggle">
              <input
                type="checkbox"
                checked={active.expand}
                onChange={() => toggleActiveBox('expand')}
              />
              <span className="TransformBoxTitle">Expand / Flatten \input Commands</span>
            </label>
            <span className={`TransformStatusPill ${active.expand ? 'is-active' : ''}`}>
              {active.expand ? 'Active' : 'Inactive'}
            </span>
          </div>
          <details
            className="TransformDetails"
            open={expanded.expand}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open;
              setExpanded((prev) => (prev.expand === isOpen ? prev : { ...prev, expand: isOpen }));
            }}
          >
            <summary className="TransformSummary">
              <span className="TransformSummaryLabel">Options</span>
              <span className="TransformSummaryHint">
                {expandMode === 'recursive' ? 'Flatten all nested' : 'Single level'} ·{' '}
                {expandScope === 'source' ? 'all branches' : 'configured branch'}
              </span>
            </summary>
            <div className="TransformBoxBody">
              <p className="ControlSubtitle">
                Replace active <code>\input</code> commands with target file contents (emits non-halting warnings if a file is missing).
              </p>
              <div className="ControlFieldGrid ControlFieldGrid--two">
                <label className="ControlField" htmlFor="expandModeSelect">
                  <span>Expansion Mode</span>
                  <select
                    id="expandModeSelect"
                    className="ControlInput"
                    value={expandMode}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'single' || val === 'recursive') {
                        setExpandMode(val);
                      }
                    }}
                  >
                    <option value="single">Expand one level (single pass)</option>
                    <option value="recursive">Flatten all nested inputs (recursive)</option>
                  </select>
                </label>
                <label className="ControlField" htmlFor="expandScopeSelect">
                  <span>Scope</span>
                  <select
                    id="expandScopeSelect"
                    className="ControlInput"
                    value={expandScope}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'source' || val === 'selected') {
                        setExpandScope(val);
                      }
                    }}
                  >
                    <option value="source">All branches / whole document</option>
                    <option value="selected">Configured branch (selected)</option>
                  </select>
                </label>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Unified Apply Panel */}
      <div className="TransformApplyPanel" role="region" aria-label="Apply transformations">
        <div className="TransformApplyHeader">
          <div>
            <h3>Apply Transformations</h3>
            <p className="ControlSubtitle">
              {activeNames.length > 0
                ? `${activeNames.length} active: ${activeNames.join(' → ')}`
                : 'Select one or more transformation boxes above'}
            </p>
          </div>
        </div>

        <div
          className="TransformDestGroup"
          role="radiogroup"
          aria-label="Output destination"
        >
          <label
            className={`TransformDestOption ${
              destination === 'inplace' ? 'TransformDestOption--selected' : ''
            }`}
          >
            <input
              type="radio"
              name="transformDestination"
              value="inplace"
              checked={destination === 'inplace'}
              onChange={() => setDestination('inplace')}
            />
            <span className="TransformDestCopy">
              <strong>Modify in place</strong>
              <span>Stage diff review before overwriting existing workspace files (undoable)</span>
            </span>
          </label>

          <label
            className={`TransformDestOption ${
              destination === 'new-files' ? 'TransformDestOption--selected' : ''
            }`}
          >
            <input
              type="radio"
              name="transformDestination"
              value="new-files"
              checked={destination === 'new-files'}
              onChange={() => setDestination('new-files')}
            />
            <span className="TransformDestCopy">
              <strong>Output new file(s)</strong>
              <span>Write transformed output to a new folder or sibling file without altering originals</span>
            </span>
          </label>
        </div>

        {destination === 'new-files' ? (
          <div className="TransformOutputFolderRow">
            <label className="ControlField" htmlFor="transformOutputFolder">
              <span>Output folder (optional)</span>
              <input
                id="transformOutputFolder"
                type="text"
                className="ControlInput"
                placeholder="e.g. out or build/clean (leave blank for *.transformed.tex)"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
              />
            </label>
            <span className={`TransformOutputPreview ${hasInvalidFolder ? 'is-error' : ''}`}>
              {hasInvalidFolder
                ? 'Invalid folder path: avoid "." or ".." segments.'
                : `Output path example: ${previewOutputPath}`}
            </span>
          </div>
        ) : null}

        <div className="TransformApplyFooter">
          {disabledHint ? <span className="TransformApplyHint">{disabledHint}</span> : <span />}
          <button
            type="button"
            className="ControlButton ControlButton--primary"
            disabled={!canApply}
            title={disabledHint}
            onClick={handleApply}
          >
            {destination === 'new-files' ? 'Create New File(s)' : 'Preview & Apply in Place'}
          </button>
        </div>
      </div>

      {/* Generated Artifacts (available for ZIP / download inspection) */}
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
            <p className="ControlSubtitle">Review or download generated output files</p>
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
    </section>
  );
}
