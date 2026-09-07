import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeActionBar } from './NodeActionBar';
import type { ConfiguredNode } from '@preptex/core';

describe('NodeActionBar', () => {
  const mockEnvNode: ConfiguredNode = {
    kind: 'environment',
    name: 'itemize',
    viewId: 'view-1',
    occurrenceKey: 'env-1',
    projectedRange: { line: 1, start: 0, end: 50 },
    origins: [],
    location: {
      kind: 'single',
      primary: {
        snapshotId: 'snap-1',
        occurrenceId: 'occ-1',
        path: 'main.tex',
        version: 1,
        range: { line: 5, start: 25, end: 75 },
      },
      spans: [
        {
          snapshotId: 'snap-1',
          occurrenceId: 'occ-1',
          path: 'main.tex',
          version: 1,
          range: { line: 5, start: 25, end: 75 },
        },
      ],
    },
    syntax: {
      opening: null,
      closing: null,
      body: null,
      hasArguments: false,
    },
    children: [],
  };

  it('renders nothing when no node is selected', () => {
    render(
      <NodeActionBar
        selectedNode={null}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('region', { name: /selected node actions/i }),
    ).not.toBeInTheDocument();
  });

  it('displays selected environment info and action controls', () => {
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    expect(screen.getByText(/selected environment/i)).toBeInTheDocument();
    expect(screen.getByText(/itemize/i)).toBeInTheDocument();
    expect(screen.getByText(/line 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove node/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wrap/i })).toBeInTheDocument();
  });

  it('triggers onRemoveNode on remove click', () => {
    const onRemove = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={onRemove}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /remove node/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('triggers onRenameEnvironment with entered name', () => {
    const onRename = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={onRename}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/new name/i);
    fireEvent.change(input, { target: { value: 'enumerate' } });
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledWith('enumerate');
  });

  it('triggers onWrapNode with entered wrapper name', () => {
    const onWrap = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={onWrap}
        onClearSelection={jest.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/wrapper name/i);
    fireEvent.change(input, { target: { value: 'center' } });
    fireEvent.click(screen.getByRole('button', { name: /wrap/i }));
    expect(onWrap).toHaveBeenCalledWith('center');
  });
});
