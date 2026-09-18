import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditPreviewDialog } from './EditPreviewDialog';
import type { ProjectEditPlan } from '@preptex/core';

describe('EditPreviewDialog', () => {
  const mockPlan: ProjectEditPlan = {
    kind: 'edits',
    provenance: {
      snapshotId: 'snap-1',
      viewId: null,
      request: {
        operation: 'suppress-comments',
        options: { target: 'source' },
      },
      operationVersion: 1,
    },
    edits: [
      {
        kind: 'replace',
        path: 'main.tex',
        range: { line: 1, start: 0, end: 11 },
        expected: '% A comment\n',
        replacement: '',
      },
      {
        kind: 'insert',
        path: 'main.tex',
        offset: 20,
        text: '\\begin{center}\n',
      },
    ],
  };

  it('renders proposed edits with expected changes', () => {
    render(
      <EditPreviewDialog
        isOpen={true}
        onClose={jest.fn()}
        editPlan={mockPlan}
        isStale={false}
        onApply={jest.fn()}
        onDiscard={jest.fn()}
        error={null}
      />,
    );

    expect(screen.getByText(/edit preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/main\.tex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/% A comment/i)).toBeInTheDocument();
    expect(screen.getByText(/\\begin\{center\}/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply edits to sources/i })).toBeEnabled();
  });

  it('disables apply button and shows warning when edit plan is stale', () => {
    render(
      <EditPreviewDialog
        isOpen={true}
        onClose={jest.fn()}
        editPlan={mockPlan}
        isStale={true}
        onApply={jest.fn()}
        onDiscard={jest.fn()}
        error={null}
      />,
    );

    expect(screen.getByText(/stale/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply edits to sources/i })).toBeDisabled();
  });

  it('triggers onApply and onDiscard callbacks', () => {
    const onApply = jest.fn();
    const onDiscard = jest.fn();

    render(
      <EditPreviewDialog
        isOpen={true}
        onClose={jest.fn()}
        editPlan={mockPlan}
        isStale={false}
        onApply={onApply}
        onDiscard={onDiscard}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /apply edits to sources/i }));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
