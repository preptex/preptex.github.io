import type { WarningDiagnostic } from '@preptex/core';
import type { ProcessingError } from '../services/core';

export interface LogPanelProps {
  readonly diagnostics: readonly WarningDiagnostic[];
  readonly error: ProcessingError | null;
}

function formatError(error: ProcessingError): string {
  switch (error.kind) {
    case 'syntax': {
      const { path, range, message } = error.diagnostic;
      return path + ':' + range.line + ' [' + error.code + '] ' + message;
    }
    case 'core':
      return '[' + error.code + '] ' + error.message;
    case 'unexpected':
      return 'Unexpected error: ' + error.message;
  }
}

export default function LogPanel({ diagnostics, error }: LogPanelProps) {
  const hasEntries = error !== null || diagnostics.length > 0;
  return (
    <section className="LogPanel" aria-label="Processing log">
      <div className="LogPanelBody" role="log" aria-live="polite">
        {!hasEntries ? <p className="LogPanelEmpty">No diagnostics from the latest processing run.</p> : null}
        {error ? <div role="alert" className="LogPanelEntry LogPanelEntry--error">{formatError(error)}</div> : null}
        {diagnostics.map((diagnostic, index) => (
          <div className="LogPanelEntry" key={index}>
            {diagnostic.path}:{diagnostic.range.line} [{diagnostic.severity}/{diagnostic.code}] {diagnostic.message}
          </div>
        ))}
      </div>
    </section>
  );
}
