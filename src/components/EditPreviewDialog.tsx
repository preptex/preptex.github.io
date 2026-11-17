import React from 'react';
import type { ProjectEditPlan } from '@preptex/core';
import type { ProcessingError } from '../services/core';
import './EditPreviewDialog.css';

export interface EditPreviewDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly editPlan: ProjectEditPlan | null;
  readonly isStale: boolean;
  readonly onApply: () => void;
  readonly onDiscard: () => void;
  readonly error: ProcessingError | null;
  readonly switchToConditionFree?: boolean;
  readonly onToggleSwitchToConditionFree?: (next: boolean) => void;
  readonly variant?: 'dialog' | 'view';
  readonly onSelectLocation?: (path: string, line: number) => void;
}

export const EditPreviewDialog: React.FC<EditPreviewDialogProps> = ({
  isOpen,
  onClose,
  editPlan,
  isStale,
  onApply,
  onDiscard,
  error,
  switchToConditionFree,
  onToggleSwitchToConditionFree,
  variant = 'dialog',
  onSelectLocation,
}) => {
  if (variant === 'dialog' && !isOpen) {
    return null;
  }

  const edits = editPlan?.edits ?? [];
  const affectedFiles = Array.from(new Set(edits.map((e) => e.path)));
  const op = editPlan?.provenance.request.operation;
  const baseHeading = variant === 'dialog' ? 'Edit Preview' : 'Diff Review';
  const dialogTitle =
    op === 'realize-conditions'
      ? `${baseHeading} — Condition Realization`
      : op === 'refactor-symbols'
      ? `${baseHeading} — Symbol Refactoring`
      : op === 'compose-transformations'
      ? `${baseHeading} — Composed Pipeline`
      : op === 'suppress-comments'
      ? `${baseHeading} — Comment Suppression`
      : op === 'remove-environments'
      ? `${baseHeading} — Environment Removal`
      : baseHeading;
  const isConditionRealization = op === 'realize-conditions';
  const dialogSubtitle = isConditionRealization
    ? 'Review condition directives and inactive branches to strip from source files.'
    : op === 'compose-transformations'
    ? 'Review unified multi-step edits composed back to your original source files.'
    : 'Review proposed edits before applying them atomically to source files.';

  const content = (
    <div className={variant === 'view' ? 'edit-preview-view-card' : 'edit-preview-modal'}>
      <div className="edit-preview-header">
        <div>
          <h2 id="edit-preview-title">{dialogTitle}</h2>
          <p className="edit-preview-subtitle">{dialogSubtitle}</p>
        </div>
        {variant === 'dialog' ? (
          <button
            type="button"
            className="edit-preview-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        ) : (
          <div className="edit-preview-header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!editPlan}
              onClick={() => {
                onDiscard();
                onClose();
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isStale || edits.length === 0}
              onClick={onApply}
            >
              Apply Edits to Sources
            </button>
          </div>
        )}
      </div>

      {isStale && (
        <div className="edit-preview-alert warning" role="alert">
          <strong>Warning:</strong> These proposed edits are stale because the source files or configuration have changed. Applying edits is disabled.
        </div>
      )}

      {error && (
        <div className="edit-preview-alert error" role="alert">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      <div className="edit-preview-body">
        <div className="edit-preview-summary">
          <span className="summary-badge files">
            {affectedFiles.length} {affectedFiles.length === 1 ? 'file' : 'files'} affected
          </span>
          <span className="summary-badge edits">
            {edits.length} {edits.length === 1 ? 'edit' : 'edits'} proposed
          </span>
        </div>

        {isConditionRealization && onToggleSwitchToConditionFree ? (
          <label className="edit-preview-option">
            <input
              type="checkbox"
              checked={Boolean(switchToConditionFree)}
              onChange={(e) => onToggleSwitchToConditionFree(e.target.checked)}
            />
            <span>
              Switch project condition policy to <code>Condition-free (none)</code> after applying (INV-4)
            </span>
          </label>
        ) : null}

        {!editPlan ? (
          <div className="edit-preview-empty">
            No staged edits to review yet. Run a transformation from Transformations, Catalog, or Metadata to inspect its diff here before applying.
          </div>
        ) : edits.length === 0 ? (
          <div className="edit-preview-empty">No edits proposed for this operation.</div>
        ) : (
          <div className="edit-preview-list">
            {edits.map((edit, idx) => (
              <div key={idx} className={`edit-card ${edit.kind}`}>
                <div className="edit-card-header">
                  {onSelectLocation && edit.kind === 'replace' ? (
                    <button
                      type="button"
                      className="edit-path edit-path-link"
                      onClick={() => onSelectLocation(edit.path, edit.range.line)}
                      title={`Jump to ${edit.path}:${edit.range.line}`}
                    >
                      {edit.path}
                    </button>
                  ) : (
                    <span className="edit-path">{edit.path}</span>
                  )}
                  <span className={`edit-kind-tag ${edit.kind}`}>
                    {edit.kind === 'replace' ? 'Replace' : 'Insert'}
                  </span>
                  <span className="edit-location">
                    {edit.kind === 'replace'
                      ? `Line ${edit.range.line} (pos ${edit.range.start}–${edit.range.end})`
                      : `Offset ${edit.offset}`}
                  </span>
                </div>

                <div className="edit-diff-box">
                  {edit.kind === 'replace' ? (
                    <>
                      <div className="diff-chunk removal">
                        <span className="diff-label">-</span>
                        <pre>{edit.expected || '(empty)'}</pre>
                      </div>
                      <div className="diff-chunk addition">
                        <span className="diff-label">+</span>
                        <pre>{edit.replacement || '(deleted)'}</pre>
                      </div>
                    </>
                  ) : (
                    <div className="diff-chunk addition">
                      <span className="diff-label">+</span>
                      <pre>{edit.text}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="edit-preview-footer">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={variant === 'view' && !editPlan}
          onClick={() => {
            onDiscard();
            onClose();
          }}
        >
          Discard
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isStale || edits.length === 0}
          onClick={onApply}
        >
          Apply Edits to Sources
        </button>
      </div>
    </div>
  );

  if (variant === 'view') {
    return (
      <section className="WorkspaceViewPane edit-preview-view" aria-label="Diff Review">
        {content}
      </section>
    );
  }

  return (
    <div className="edit-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-preview-title">
      {content}
    </div>
  );
};
