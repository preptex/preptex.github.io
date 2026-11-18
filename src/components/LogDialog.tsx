import React, { useEffect } from 'react';
import './LogDialog.css';
import LogPanel, { type LogPanelProps } from './LogPanel';

export interface LogDialogProps extends LogPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly variant?: 'dialog' | 'view';
  readonly onRunReferences?: () => void;
  readonly canRunReferences?: boolean;
  readonly referencesReason?: string;
  readonly onRunCommandUsage?: () => void;
  readonly canRunCommandUsage?: boolean;
  readonly commandUsageReason?: string;
  readonly isAnalyzing?: boolean;
}

export function LogDialog({
  isOpen,
  onClose,
  variant = 'dialog',
  onRunReferences,
  canRunReferences = false,
  referencesReason,
  onRunCommandUsage,
  canRunCommandUsage = false,
  commandUsageReason,
  isAnalyzing = false,
  ...logPanelProps
}: LogDialogProps) {
  // Handle Escape key to close dialog
  useEffect(() => {
    if (variant !== 'dialog') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, variant]);

  if (variant === 'dialog' && !isOpen) return null;

  const { error, diagnostics, findings = [] } = logPanelProps;
  const count = (error ? 1 : 0) + diagnostics.length + findings.length;

  const inner = (
    <div
      className={variant === 'view' ? 'LogViewCard' : 'LogDialog'}
      role={variant === 'dialog' ? 'dialog' : undefined}
      aria-modal={variant === 'dialog' ? 'true' : undefined}
      aria-labelledby="log-dialog-title"
      onClick={variant === 'dialog' ? (e) => e.stopPropagation() : undefined}
    >
      <div className="LogDialogHeader">
        <div className="LogDialogTitleGroup">
          <h2 id="log-dialog-title">{variant === 'view' ? 'Diagnostics & Checks' : 'Processing Log'}</h2>
          <span className="LogDialogSubtitle">
            {error
              ? 'Processing encountered an error'
              : count > 0
              ? `${count} diagnostic${count === 1 ? '' : 's'} / finding${count === 1 ? '' : 's'}`
              : 'Run structural checks (References / Commands) or inspect warnings and analysis findings'}
          </span>
        </div>
        {variant === 'view' ? (
          <div className="LogViewHeaderActions">
            {onRunReferences ? (
              <button
                type="button"
                className="LogDialogBtn LogDialogBtn--secondary"
                disabled={!canRunReferences || isAnalyzing}
                title={
                  canRunReferences
                    ? 'Verify label references across active files'
                    : referencesReason || 'Configure a ready project view to check references'
                }
                onClick={onRunReferences}
              >
                Check References
              </button>
            ) : null}
            {onRunCommandUsage ? (
              <button
                type="button"
                className="LogDialogBtn LogDialogBtn--secondary"
                disabled={!canRunCommandUsage || isAnalyzing}
                title={
                  canRunCommandUsage
                    ? 'Check defined vs recognized commands'
                    : commandUsageReason || 'Configure a ready project view to check commands'
                }
                onClick={onRunCommandUsage}
              >
                Check Commands
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="LogDialogClose"
            onClick={onClose}
            aria-label="Close log dialog"
          >
            &times;
          </button>
        )}
      </div>

      <div className="LogDialogBody">
        <LogPanel
          {...logPanelProps}
          onSelectLocation={(loc) => {
            logPanelProps.onSelectLocation?.(loc);
            if (variant === 'dialog') {
              onClose();
            }
          }}
        />
      </div>

      {variant === 'dialog' ? (
        <div className="LogDialogFooter">
          <button
            type="button"
            className="LogDialogBtn LogDialogBtn--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );

  if (variant === 'view') {
    return (
      <section className="WorkspaceViewPane LogViewPane" aria-label="Diagnostics">
        {inner}
      </section>
    );
  }

  return (
    <div className="LogDialogOverlay" onClick={onClose} role="presentation">
      {inner}
    </div>
  );
}

export default LogDialog;
