import React, { useEffect } from 'react';
import './OperationsDialog.css';
import ControlPanel, { type ControlPanelProps } from './ControlPanel';

export interface OperationsDialogProps extends ControlPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly variant?: 'dialog' | 'view';
}

export function OperationsDialog({
  isOpen,
  onClose,
  variant = 'dialog',
  ...controlPanelProps
}: OperationsDialogProps) {
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

  const inner = (
    <div
      className={variant === 'view' ? 'OperationsViewCard' : 'OperationsDialog'}
      role={variant === 'dialog' ? 'dialog' : undefined}
      aria-modal={variant === 'dialog' ? 'true' : undefined}
      aria-labelledby="operations-dialog-title"
      onClick={variant === 'dialog' ? (e) => e.stopPropagation() : undefined}
    >
      <div className="OperationsDialogHeader">
        <div className="OperationsDialogTitleGroup">
          <h2 id="operations-dialog-title">Transformations &amp; Pipeline</h2>
          <span className="OperationsDialogSubtitle">
            Apply whole-document transformations, condition realization, composed pipelines, and project exports
          </span>
        </div>
        {variant === 'dialog' ? (
          <button
            type="button"
            className="OperationsDialogClose"
            onClick={onClose}
            aria-label="Close operations dialog"
          >
            &times;
          </button>
        ) : null}
      </div>

      <div className="OperationsDialogBody">
        <ControlPanel {...controlPanelProps} />
      </div>

      {variant === 'dialog' ? (
        <div className="OperationsDialogFooter">
          <button
            type="button"
            className="OperationsDialogBtn OperationsDialogBtn--secondary"
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
      <section className="WorkspaceViewPane OperationsViewPane" aria-label="Transformations">
        {inner}
      </section>
    );
  }

  return (
    <div className="OperationsDialogOverlay" onClick={onClose} role="presentation">
      {inner}
    </div>
  );
}

export default OperationsDialog;
