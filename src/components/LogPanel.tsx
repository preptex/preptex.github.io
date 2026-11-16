import type { AnalysisFinding, ProjectIssue, SourceLocation } from '@preptex/core';
import type { ProcessingError } from '../services/core';

export interface LogPanelProps {
  readonly diagnostics: readonly ProjectIssue[];
  readonly error: ProcessingError | null;
  readonly findings?: readonly AnalysisFinding[];
  readonly isStale?: boolean;
  readonly onSelectLocation?: (location: SourceLocation) => void;
}

function formatError(error: ProcessingError): string {
  switch (error.kind) {
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
        {diagnostics.map((issue, index) => {
          const isError = issue.severity === 'error';
          const entryClass = isError ? 'LogPanelEntry--error' : 'LogPanelEntry--warning';
          const loc = issue.location;
          return (
            <div
              key={`diag-${index}`}
              role={isError ? 'alert' : undefined}
              className={`LogPanelEntry ${entryClass}`}
            >
              [{issue.severity.toUpperCase()}] [{issue.code}] {issue.message}
              {loc ? (
                <>
                  {' '}
                  {onSelectLocation ? (
                    <button
                      type="button"
                      className="LogPanelLink"
                      onClick={() => onSelectLocation(loc)}
                    >
                      ({loc.path}:{loc.range.line})
                    </button>
                  ) : (
                    <span>
                      ({loc.path}:{loc.range.line})
                    </span>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
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
      </div>
    </section>
  );
}
