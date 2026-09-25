import React, { useEffect } from 'react';
import './LogDialog.css';
import LogPanel, { type LogPanelProps } from './LogPanel';

export interface LogDialogProps extends LogPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function LogDialog({
  isOpen,
  onClose,
  ...logPanelProps
}: LogDialogProps) {
  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { error, diagnostics, findings = [] } = logPanelProps;
  const count = (error ? 1 : 0) + diagnostics.length + findings.length;

  return (
    <div className="LogDialogOverlay" onClick={onClose} role="presentation">
      <div
        className="LogDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="LogDialogHeader">
          <div className="LogDialogTitleGroup">
            <h2 id="log-dialog-title">Processing Log</h2>
            <span className="LogDialogSubtitle">
              {error
                ? 'Parsing encountered an error'
                : count > 0
                ? `${count} diagnostic${count === 1 ? '' : 's'} / finding${count === 1 ? '' : 's'}`
                : 'Diagnostics, syntax warnings, and analysis findings'}
            </span>
          </div>
          <button
            type="button"
            className="LogDialogClose"
            onClick={onClose}
            aria-label="Close log dialog"
          >
            &times;
          </button>
        </div>

        <div className="LogDialogBody">
          <LogPanel
            {...logPanelProps}
            onSelectLocation={(loc) => {
              logPanelProps.onSelectLocation?.(loc);
              onClose();
            }}
          />
        </div>

        <div className="LogDialogFooter">
          <button
            type="button"
            className="LogDialogBtn LogDialogBtn--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogDialog;
