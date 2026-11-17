import { useState, type DragEvent } from 'react';
import { extractDroppedFiles, type DroppedFileItem } from '../utils/dropEntries';
import './WelcomeEmptyState.css';

export interface WelcomeEmptyStateProps {
  readonly onUploadFiles: () => void;
  readonly onUploadFolder: () => void;
  readonly onLoadDemo: () => void;
  readonly onDropFiles?: (items: readonly DroppedFileItem[]) => void;
}

export default function WelcomeEmptyState({
  onUploadFiles,
  onUploadFolder,
  onLoadDemo,
  onDropFiles,
}: WelcomeEmptyStateProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (!onDropFiles) return;
    const dropped = await extractDroppedFiles(event.dataTransfer);
    if (dropped.length > 0) {
      onDropFiles(dropped);
    }
  };

  return (
    <section className="WelcomeEmptyState" aria-label="Empty workspace">
      <div
        className={`WelcomeCard${isDragOver ? ' is-drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(event) => void handleDrop(event)}
      >
        <div className="WelcomeBadge">PrepTeX Workspace</div>
        <h1 className="WelcomeTitle">Prepare LaTeX projects without modal clutter</h1>
        <p className="WelcomeSubtitle">
          Drop a TeX folder or upload files to inspect source code, ASTs, catalogs, metadata, and
          diff-reviewed document transformations. Conditionals default to visiting all branches, and
          phase-0 configuration is only requested when a view needs it.
        </p>

        <div className="WelcomeActions">
          <button type="button" className="WelcomeBtn WelcomeBtn--primary" onClick={onUploadFiles}>
            Upload Files
          </button>
          <button type="button" className="WelcomeBtn" onClick={onUploadFolder}>
            Upload Folder
          </button>
          <button type="button" className="WelcomeBtn" onClick={onLoadDemo}>
            Load Demo Project
          </button>
        </div>

        <div className="WelcomeHint">
          Tip: You can drag &amp; drop folders or <code>.tex</code> files anywhere here or onto the
          left file explorer.
        </div>
      </div>
    </section>
  );
}
