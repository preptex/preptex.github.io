import React from 'react';
import type { ProjectView } from '@preptex/core';
import type { ProjectConfigurationState } from '../model/useProjectConfiguration';
import './ProjectSetupDialog.css';

export interface ConfigurationSummaryProps {
  readonly configuration: ProjectConfigurationState;
  readonly view: ProjectView | null;
  readonly onOpenSettings: () => void;
}

export function ConfigurationSummary({
  configuration,
  view,
  onOpenSettings,
}: ConfigurationSummaryProps) {
  const { entryPath, traversal, conditionPolicy } = configuration;

  let badgeClass = 'ConfigurationBadge--blocked';
  let badgeLabel = 'Unconfigured';

  if (view) {
    if (view.status === 'ready') {
      badgeClass = 'ConfigurationBadge--ready';
      badgeLabel = 'Ready';
    } else if (view.status === 'incomplete') {
      badgeClass = 'ConfigurationBadge--incomplete';
      badgeLabel = 'Incomplete';
    } else if (view.status === 'blocked') {
      badgeClass = 'ConfigurationBadge--blocked';
      badgeLabel = 'Blocked';
    }
  }

  const policyDescription =
    conditionPolicy.mode === 'source'
      ? 'Follow source'
      : conditionPolicy.mode === 'source-with-overrides'
      ? 'Source with overrides'
      : 'Forced values';

  return (
    <div className="ConfigurationSummary" role="region" aria-label="Project configuration summary">
      <div className="ConfigurationSummaryLeft">
        <span className={`ConfigurationBadge ${badgeClass}`}>{badgeLabel}</span>
        <span>
          <strong>Entry:</strong> {entryPath ? <code>{entryPath}</code> : <em>None</em>}
        </span>
        <span>&bull;</span>
        <span>
          <strong>Traversal:</strong> {traversal === 'project' ? 'Project' : 'File only'}
        </span>
        <span>&bull;</span>
        <span>
          <strong>Conditions:</strong> {policyDescription}
        </span>
      </div>
      <div>
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
