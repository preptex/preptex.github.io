import React from 'react';
import type { ProjectView } from '@preptex/core';
import type { ProjectConfigurationState } from '../model/useProjectConfiguration';
import './ProjectSetupDialog.css';

export interface ConfigurationSummaryProps {
  readonly configuration: ProjectConfigurationState;
  readonly view: ProjectView | null;
  readonly documentTitle?: string | null;
  readonly undefinedCommandCount?: number;
  readonly onOpenSettings: () => void;
  readonly onOpenCatalog?: () => void;
  readonly onOpenMetadata?: () => void;
  readonly onOpenOperations?: () => void;
  readonly onOpenLog?: () => void;
  readonly logLabel?: string;
  readonly hasLogError?: boolean;
  readonly hasLogWarning?: boolean;
}

export function ConfigurationSummary({
  configuration,
  view,
  documentTitle = null,
  undefinedCommandCount = 0,
  onOpenSettings,
  onOpenCatalog,
  onOpenMetadata,
  onOpenOperations,
  onOpenLog,
  logLabel = 'Log',
  hasLogError = false,
  hasLogWarning = false,
}: ConfigurationSummaryProps) {
  const { entryPath, traversal, inputs, conditionPolicy } = configuration;

  let badgeClass = 'ConfigurationBadge--blocked';
  let badgeLabel = 'Unconfigured';
  let badgeTitle: string | undefined;
  let reasonCode: string | null = null;

  if (view) {
    if (view.status === 'ready') {
      badgeClass = 'ConfigurationBadge--ready';
      badgeLabel = 'Ready';
    } else if (view.status === 'incomplete') {
      badgeClass = 'ConfigurationBadge--incomplete';
      badgeLabel = 'Incomplete';
      reasonCode = view.reason.code;
      badgeTitle = `${view.reason.code}: ${view.reason.message}`;
    } else if (view.status === 'blocked') {
      badgeClass = 'ConfigurationBadge--blocked';
      badgeLabel = 'Blocked';
      reasonCode = view.reason.code;
      badgeTitle = `${view.reason.code}: ${view.reason.message}`;
    }
  }

  const policyDescription =
    conditionPolicy.mode === 'ignore'
      ? 'All branches (ignore)'
      : conditionPolicy.mode === 'source'
      ? 'Follow source'
      : conditionPolicy.mode === 'source-with-overrides'
      ? 'Source with overrides'
      : conditionPolicy.mode === 'manual'
      ? 'Forced values'
      : 'Condition-free (none)';

  const inputModeLabel =
    inputs === 'recursive' ? 'Recursive' : inputs === 'inline' ? 'Inline' : 'Command';

  return (
    <div className="ConfigurationSummary" role="region" aria-label="Project configuration summary">
      <div className="ConfigurationSummaryLeft">
        <span className={`ConfigurationBadge ${badgeClass}`} title={badgeTitle}>
          {badgeLabel}
        </span>
        {reasonCode ? (
          <code className="ConfigurationReasonCode" title={badgeTitle}>
            {reasonCode}
          </code>
        ) : null}
        <span>
          <strong>Entry:</strong> {entryPath ? <code>{entryPath}</code> : <em>None</em>}
        </span>
        <span>&bull;</span>
        <span>
          <strong>Traversal:</strong> {traversal === 'project' ? 'Project' : 'File only'}
        </span>
        <span>&bull;</span>
        <span>
          <strong>Inputs:</strong> {inputModeLabel}
        </span>
        <span>&bull;</span>
        <span>
          <strong>Conditions:</strong> {policyDescription}
        </span>
      </div>
      <div className="ConfigurationSummaryRight">
        {onOpenCatalog ? (
          <button
            type="button"
            className={`ConfigurationSummaryButton ${
              undefinedCommandCount > 0 ? 'ConfigurationSummaryButton--warning' : ''
            }`}
            onClick={onOpenCatalog}
            title="Inspect commands, environments, conditions, labels, and citations"
          >
            Catalog{undefinedCommandCount > 0 ? ` (${undefinedCommandCount} undef)` : ''}
          </button>
        ) : null}
        {onOpenMetadata ? (
          <button
            type="button"
            className="ConfigurationSummaryButton"
            onClick={onOpenMetadata}
            title={documentTitle ? `Metadata: ${documentTitle}` : 'Inspect and edit document metadata'}
          >
            Metadata
          </button>
        ) : null}
        {onOpenOperations ? (
          <button
            type="button"
            className="ConfigurationSummaryButton ConfigurationSummaryButton--primary"
            onClick={onOpenOperations}
          >
            Operations...
          </button>
        ) : null}
        {onOpenLog ? (
          <button
            type="button"
            className={`ConfigurationSummaryButton ${
              hasLogError
                ? 'ConfigurationSummaryButton--error'
                : hasLogWarning
                ? 'ConfigurationSummaryButton--warning'
                : ''
            }`}
            onClick={onOpenLog}
            aria-label={logLabel}
          >
            {hasLogError ? '⚠ ' : ''}{logLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="ConfigurationSummaryButton"
          onClick={onOpenSettings}
        >
          Settings...
        </button>
      </div>
    </div>
  );
}

export default ConfigurationSummary;
