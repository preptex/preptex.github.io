import type { AnalysisFinding, AnalysisLocation, WarningDiagnostic } from '@preptex/core';
import type { ProcessingError } from '../services/core';

export interface LogPanelProps {
  readonly diagnostics: readonly WarningDiagnostic[];
  readonly error: ProcessingError | null;
  readonly findings?: readonly AnalysisFinding[];
  readonly isStale?: boolean;
  readonly onSelectLocation?: (location: AnalysisLocation) => void;
}

function formatError(error: ProcessingError): string {
  switch (error.kind) {
    case 'syntax': {
      const { path, range, message } = error.diagnostic;
      return path + ':' + range.line + ' [' + error.code + '] ' + message;
    }
    case 'operation': {
      const loc = error.failure.locations[0];
      const locPrefix = loc ? loc.path + ':' + loc.range.line + ' ' : '';
      return locPrefix + '[' + error.failure.code + '] ' + error.failure.message;
    }
    case 'core':
      return '[' + error.code + '] ' + error.message;
    case 'unexpected':
      return 'Unexpected error: ' + error.message;
  }
}

export default function LogPanel({
  diagnostics,
  error,
  findings = [],
  isStale = false,
  onSelectLocation,
}: LogPanelProps) {
  const hasEntries = error !== null || diagnostics.length > 0 || findings.length > 0;
  return (
    <section className="LogPanel" aria-label="Processing log">
      <div className="LogPanelBody" role="log" aria-live="polite">
        {isStale ? (
          <div className="LogPanelStaleBanner">
            Warning: Findings may be stale because project source or configuration has changed.
          </div>
        ) : null}
        {!hasEntries ? (
          <p className="LogPanelEmpty">No diagnostics or findings from the latest processing run.</p>
        ) : null}
        {error ? (
          <div role="alert" className="LogPanelEntry LogPanelEntry--error">
            {formatError(error)}
          </div>
        ) : null}
        {findings.map((finding, index) => {
          const entryClass =
            finding.severity === 'warning'
              ? 'LogPanelEntry--warning'
              : 'LogPanelEntry--info';
          return (
            <div className={`LogPanelEntry ${entryClass}`} key={`finding-${index}`}>
              [{finding.severity.toUpperCase()}] [{finding.code}] {finding.message}{' '}
              {onSelectLocation ? (
                <button
                  type="button"
                  className="LogPanelLink"
                  onClick={() => onSelectLocation(finding.primary)}
                >
                  ({finding.primary.path}:{finding.primary.range.line})
                </button>
              ) : (
                <span>
                  ({finding.primary.path}:{finding.primary.range.line})
                </span>
              )}
            </div>
          );
        })}
        {diagnostics.map((diagnostic, index) => (
          <div className="LogPanelEntry" key={`diag-${index}`}>
            {diagnostic.path}:{diagnostic.range.line} [{diagnostic.severity}/{diagnostic.code}] {diagnostic.message}
          </div>
        ))}
      </div>
    </section>
  );
}
