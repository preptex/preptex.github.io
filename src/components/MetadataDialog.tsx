import React, { useEffect, useState } from 'react';
import type {
  AnalysisLocation,
  MetadataField,
  ProjectMetadata,
  SymbolRefactorAction,
} from '@preptex/core';
import './MetadataDialog.css';

export interface MetadataDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly metadata: ProjectMetadata | null;
  readonly onEditMetadata: (action: Extract<SymbolRefactorAction, { readonly kind: 'edit-metadata' }>) => void;
  readonly onSelectLocation: (location: AnalysisLocation) => void;
}

type EditableMetadataKey = 'title' | 'author' | 'date' | 'abstract';

interface EditableFieldCardProps {
  readonly label: string;
  readonly fieldKey: EditableMetadataKey;
  readonly field: MetadataField | null;
  readonly allowShort?: boolean;
  readonly onSave: (
    action: Extract<SymbolRefactorAction, { readonly kind: 'edit-metadata' }>,
  ) => void;
  readonly onJump: (location: AnalysisLocation) => void;
}

function EditableFieldCard({
  label,
  fieldKey,
  field,
  allowShort = false,
  onSave,
  onJump,
}: EditableFieldCardProps) {
  const [editing, setEditing] = useState(false);
  const [valueText, setValueText] = useState('');
  const [shortText, setShortText] = useState('');

  useEffect(() => {
    setValueText(field?.rawSource ?? '');
    setShortText(field?.shortText ?? '');
    setEditing(false);
  }, [field]);

  const canEdit = Boolean(field?.contentLocation);

  return (
    <div className="MetadataFieldCard">
      <div className="MetadataFieldHeader">
        <strong>{label}</strong>
        <div className="MetadataFieldActions">
          {field ? (
            <button
              type="button"
              className="MetadataBtn"
              aria-label={`Jump to ${label}`}
              onClick={() => onJump(field.location)}
            >
              {field.location.path}:{field.location.range.line}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="MetadataBtn MetadataBtn--primary"
              aria-label={`Edit ${label}`}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          ) : null}
        </div>
      </div>

      {!field ? (
        <div className="MetadataEmptyValue">Not detected in source</div>
      ) : editing ? (
        <form
          className="MetadataEditForm"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              kind: 'edit-metadata',
              field: fieldKey,
              newValue: valueText,
              ...(allowShort
                ? { shortValue: shortText.trim() === '' ? null : shortText }
                : {}),
            });
            setEditing(false);
          }}
        >
          {allowShort ? (
            <label className="MetadataInputLabel">
              <span>Short {label.toLowerCase()} (optional brackets)</span>
              <input
                type="text"
                value={shortText}
                placeholder="Leave blank to omit [short]"
                onChange={(e) => setShortText(e.target.value)}
                aria-label={`Short ${label}`}
              />
            </label>
          ) : null}
          <label className="MetadataInputLabel">
            <span>{label} LaTeX source</span>
            {fieldKey === 'abstract' ? (
              <textarea
                rows={3}
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                aria-label={`${label} value`}
              />
            ) : (
              <input
                type="text"
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                aria-label={`${label} value`}
              />
            )}
          </label>
          <div className="MetadataFormButtons">
            <button type="submit" className="MetadataBtn MetadataBtn--primary">
              Preview {label} Edit
            </button>
          </div>
        </form>
      ) : (
        <div className="MetadataFieldValue">
          <div>{field.text || <em>(empty)</em>}</div>
          {field.shortText ? (
            <div className="MetadataSubnote">Short: {field.shortText}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function MetadataDialog({
  isOpen,
  onClose,
  metadata,
  onEditMetadata,
  onSelectLocation,
}: MetadataDialogProps) {
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
    <div className="MetadataDialogOverlay" onClick={onClose} role="presentation">
      <div
        className="MetadataDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="MetadataDialogHeader">
          <div className="MetadataTitleGroup">
            <h2 id="metadata-dialog-title">Document Metadata &amp; Statistics</h2>
            <span className="MetadataSubtitle">
              Inspect and directly edit title, authors, date, and abstract, plus preamble packages and counts.
            </span>
          </div>
          <button
            type="button"
            className="MetadataDialogClose"
            onClick={onClose}
            aria-label="Close metadata dialog"
          >
            &times;
          </button>
        </div>

        <div className="MetadataDialogBody">
          {!metadata ? (
            <div className="MetadataEmptyValue">Upload a LaTeX project to inspect metadata.</div>
          ) : (
            <div className="MetadataLayout">
              <section className="MetadataSection">
                <h3>Core Document Fields</h3>
                <div className="MetadataCards">
                  <EditableFieldCard
                    label="Title"
                    fieldKey="title"
                    field={metadata.title}
                    allowShort
                    onSave={onEditMetadata}
                    onJump={onSelectLocation}
                  />
                  <EditableFieldCard
                    label="Authors"
                    fieldKey="author"
                    field={metadata.rawAuthorField}
                    allowShort
                    onSave={onEditMetadata}
                    onJump={onSelectLocation}
                  />
                  {metadata.authors.length > 0 ? (
                    <div className="MetadataAuthorsParsed">
                      <span className="MetadataMiniHeading">Parsed Authors ({metadata.authors.length})</span>
                      <div className="MetadataAuthorChips">
                        {metadata.authors.map((author, idx) => (
                          <button
                            key={`${author.name}-${idx}`}
                            type="button"
                            className="MetadataAuthorChip"
                            onClick={() => onSelectLocation(author.location)}
                          >
                            <span>{author.name || '(unnamed)'}</span>
                            {author.notes.length > 0 ? (
                              <span className="MetadataAuthorNote">
                                ({author.notes.join('; ')})
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <EditableFieldCard
                    label="Date"
                    fieldKey="date"
                    field={metadata.date}
                    onSave={onEditMetadata}
                    onJump={onSelectLocation}
                  />
                  <EditableFieldCard
                    label="Abstract"
                    fieldKey="abstract"
                    field={metadata.abstract}
                    onSave={onEditMetadata}
                    onJump={onSelectLocation}
                  />
                </div>
              </section>

              <section className="MetadataSection">
                <h3>Preamble &amp; Bibliography</h3>
                <div className="MetadataPreambleList">
                  <div className="MetadataInfoRow">
                    <strong>Document Class:</strong>
                    {metadata.documentClass ? (
                      <button
                        type="button"
                        className="MetadataLinkBtn"
                        onClick={() => onSelectLocation(metadata.documentClass!.location)}
                      >
                        <code>{metadata.documentClass.name}</code>
                        {metadata.documentClass.options.length > 0
                          ? ` [${metadata.documentClass.options.join(', ')}]`
                          : ''}
                      </button>
                    ) : (
                      <span>None</span>
                    )}
                  </div>

                  <div className="MetadataInfoRow">
                    <strong>Packages ({metadata.packages.length}):</strong>
                    {metadata.packages.length === 0 ? (
                      <span>None</span>
                    ) : (
                      <div className="MetadataPackageChips">
                        {metadata.packages.map((pkg, idx) => (
                          <button
                            key={`pkg-${idx}`}
                            type="button"
                            className="MetadataLinkBtn"
                            onClick={() => onSelectLocation(pkg.location)}
                          >
                            {pkg.names.join(', ')}
                            {pkg.options.length > 0 ? ` [${pkg.options.join(', ')}]` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="MetadataInfoRow">
                    <strong>Bibliography:</strong>
                    <span>
                      {metadata.bibliography.style
                        ? `Style: ${metadata.bibliography.style}`
                        : 'No style'}
                      {metadata.bibliography.resources.length > 0
                        ? ` · Files: ${metadata.bibliography.resources.join(', ')}`
                        : ''}
                    </span>
                  </div>

                  {metadata.keywords.length > 0 ? (
                    <div className="MetadataInfoRow">
                      <strong>Keywords:</strong>
                      <span>{metadata.keywords.join(', ')}</span>
                    </div>
                  ) : null}
                </div>

                <h3>Document Statistics</h3>
                <div className="MetadataStatsGrid">
                  {(
                    [
                      ['Files', `${metadata.stats.reachedFiles}/${metadata.stats.totalFiles}`],
                      ['Sections', metadata.stats.sectionCount],
                      ['Environments', metadata.stats.environmentCount],
                      ['Command Uses', metadata.stats.commandUseCount],
                      ['Defined Cmds', metadata.stats.introducedCommandCount],
                      ['Undefined Cmds', metadata.stats.undefinedCommandCount],
                      ['Math Blocks', metadata.stats.mathCount],
                      ['Figures', metadata.stats.figureCount],
                      ['Tables', metadata.stats.tableCount],
                      ['Labels', metadata.stats.labelCount],
                      ['References', metadata.stats.referenceCount],
                      ['Citations', metadata.stats.citationCount],
                    ] as const
                  ).map(([statLabel, statVal]) => (
                    <div key={statLabel} className="MetadataStatCard">
                      <span className="MetadataStatLabel">{statLabel}</span>
                      <strong className="MetadataStatVal">{statVal}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="MetadataDialogFooter">
          <button type="button" className="MetadataBtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default MetadataDialog;
