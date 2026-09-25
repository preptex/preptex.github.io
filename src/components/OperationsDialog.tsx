import React, { useEffect } from 'react';
import './OperationsDialog.css';
import ControlPanel, { type ControlPanelProps } from './ControlPanel';

export interface OperationsDialogProps extends ControlPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function OperationsDialog({
  isOpen,
  onClose,
  ...controlPanelProps
}: OperationsDialogProps) {
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

  return (
    <div className="OperationsDialogOverlay" onClick={onClose} role="presentation">
      <div
        className="OperationsDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operations-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="OperationsDialogHeader">
          <div className="OperationsDialogTitleGroup">
            <h2 id="operations-dialog-title">Project Operations &amp; Pipeline</h2>
            <span className="OperationsDialogSubtitle">
              Run analyses, configure transformations, and export artifacts
            </span>
          </div>
          <button
            type="button"
            className="OperationsDialogClose"
            onClick={onClose}
            aria-label="Close operations dialog"
          >
            &times;
          </button>
        </div>

        <div className="OperationsDialogBody">
          <ControlPanel {...controlPanelProps} />
        </div>

        <div className="OperationsDialogFooter">
          <button
            type="button"
            className="OperationsDialogBtn OperationsDialogBtn--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default OperationsDialog;
