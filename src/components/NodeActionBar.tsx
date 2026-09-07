import React, { useState } from 'react';
import type { ConfiguredNode } from '@preptex/core';
import './NodeActionBar.css';

export interface NodeActionBarProps {
  readonly selectedNode: ConfiguredNode | null;
  readonly onRemoveNode: () => void;
  readonly onRenameEnvironment: (newName: string) => void;
  readonly onWrapNode: (wrapperName: string) => void;
  readonly onClearSelection: () => void;
}

export const NodeActionBar: React.FC<NodeActionBarProps> = ({
  selectedNode,
  onRemoveNode,
  onRenameEnvironment,
  onWrapNode,
  onClearSelection,
}) => {
  const [renameName, setRenameName] = useState('');
  const [wrapName, setWrapName] = useState('');

  if (!selectedNode) {
    return null;
  }

  const isEnvironment = selectedNode.kind === 'environment';
  const nodeName = isEnvironment
    ? (selectedNode as { name?: string }).name ?? 'environment'
    : selectedNode.kind === 'section'
    ? (selectedNode as { name?: string }).name ?? 'section'
    : selectedNode.kind;

  const primaryLoc = selectedNode.location.primary;
  const locText = primaryLoc
    ? `${primaryLoc.path}: Line ${primaryLoc.range.line} (${primaryLoc.range.start}–${primaryLoc.range.end})`
    : 'No source location';

  return (
    <div className="node-action-bar" role="region" aria-label="Selected node actions">
      <div className="node-info">
        <span className="node-badge">
          Selected {selectedNode.kind}: <strong>{nodeName}</strong>
        </span>
        <span className="node-location" title={locText}>
          {locText}
        </span>
      </div>

      <div className="node-actions-group">
        {isEnvironment && (
          <div className="action-form-inline">
            <input
              type="text"
              className="action-input"
              placeholder="New name..."
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              aria-label="New environment name"
            />
            <button
              type="button"
              className="action-btn rename"
              disabled={!renameName.trim()}
              onClick={() => {
                if (renameName.trim()) {
                  onRenameEnvironment(renameName.trim());
                  setRenameName('');
                }
              }}
            >
              Rename
            </button>
          </div>
        )}

        <div className="action-form-inline">
          <input
            type="text"
            className="action-input"
            placeholder="Wrapper name..."
            value={wrapName}
            onChange={(e) => setWrapName(e.target.value)}
            aria-label="Wrapper environment name"
          />
          <button
            type="button"
            className="action-btn wrap"
            disabled={!wrapName.trim()}
            onClick={() => {
              if (wrapName.trim()) {
                onWrapNode(wrapName.trim());
                setWrapName('');
              }
            }}
          >
            Wrap
          </button>
        </div>

        <button
          type="button"
          className="action-btn remove"
          onClick={onRemoveNode}
        >
          Remove node
        </button>

        <button
          type="button"
          className="action-btn clear"
          onClick={onClearSelection}
          aria-label="Clear node selection"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
