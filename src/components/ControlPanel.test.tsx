import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InputHandlingMode } from '@preptex/core';
import ControlPanel from './ControlPanel';
import type { CoreOptionsUI } from '../model/useControl';

const defaultOptions: CoreOptionsUI = {
  outputName: '',
  inputHandling: InputHandlingMode.Preserve,
  suppressComments: false,
  handleIfConditions: true,
  enabledConditions: ['draft'],
};

describe('ControlPanel', () => {
  test('renders options and handles changes', () => {
    const onChange = jest.fn();
    render(
      <ControlPanel
        options={defaultOptions}
        onChange={onChange}
        entryFile="main.tex"
        canTransform={true}
        onTransform={jest.fn()}
        availableIfConditions={['draft', 'final']}
      />,
    );

    expect(screen.getByLabelText('Entry file')).toHaveValue('main.tex');
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled();

    // Toggle suppress comments
    fireEvent.click(screen.getByLabelText('Suppress comments'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ suppressComments: true }),
    );

    // Toggle condition
    fireEvent.click(screen.getByRole('button', { name: 'draft' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabledConditions: [] }),
    );
  });

  test('renders and triggers independent analysis actions', () => {
    const onRunReferences = jest.fn();
    const onRunCommandUsage = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
        canTransform={true}
        canRunReferences={true}
        onRunReferences={onRunReferences}
        canRunCommandUsage={false}
        commandUsageReason="Project view is blocked"
        onRunCommandUsage={onRunCommandUsage}
      />,
    );

    const refBtn = screen.getByRole('button', { name: 'Check References' });
    expect(refBtn).toBeEnabled();
    fireEvent.click(refBtn);
    expect(onRunReferences).toHaveBeenCalledTimes(1);

    const cmdBtn = screen.getByRole('button', { name: 'Check Commands' });
    expect(cmdBtn).toBeDisabled();
    expect(cmdBtn).toHaveAttribute('title', 'Project view is blocked');
  });

  test('triggers comment suppression and environment removal previews', () => {
    const onPreviewCommentSuppression = jest.fn();
    const onPreviewRemoveEnvironments = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
        canTransform={true}
        onPreviewCommentSuppression={onPreviewCommentSuppression}
        onPreviewRemoveEnvironments={onPreviewRemoveEnvironments}
      />,
    );

    const commentBtn = screen.getByRole('button', { name: /preview comments/i });
    fireEvent.click(commentBtn);
    expect(onPreviewCommentSuppression).toHaveBeenCalledTimes(1);

    const envInput = screen.getByPlaceholderText(/e\.g\. comment, C/i);
    fireEvent.change(envInput, { target: { value: 'C, comment' } });
    const envBtn = screen.getByRole('button', { name: /preview removal/i });
    fireEvent.click(envBtn);
    expect(onPreviewRemoveEnvironments).toHaveBeenCalledWith(['C', 'comment'], 'source');
  });

  test('renders generated artifacts and triggers ZIP download', () => {
    const onDownloadZip = jest.fn();
    const onSelectArtifact = jest.fn();

    const mockArtifacts = [
      {
        path: 'main.tex',
        source: 'Transformed content',
        provenance: {
          snapshotId: 'snap-1',
          viewId: null,
          request: {
            operation: 'materialize' as const,
            options: { inputs: 'preserve' as const },
          },
          operationVersion: 1 as const,
        },
        origins: [],
        remainingInputs: [],
        topology: 'preserved-project' as const,
      },
      {
        path: 'intro.tex',
        source: 'Intro content',
        provenance: {
          snapshotId: 'snap-1',
          viewId: null,
          request: {
            operation: 'materialize' as const,
            options: { inputs: 'preserve' as const },
          },
          operationVersion: 1 as const,
        },
        origins: [],
        remainingInputs: [],
        topology: 'preserved-project' as const,
      },
    ];

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
        canTransform={true}
        artifacts={mockArtifacts}
        onDownloadZip={onDownloadZip}
        onSelectArtifact={onSelectArtifact}
      />,
    );

    expect(screen.getByText(/generated artifacts \(2\)/i)).toBeInTheDocument();
    const zipBtn = screen.getByRole('button', { name: /download zip/i });
    fireEvent.click(zipBtn);
    expect(onDownloadZip).toHaveBeenCalledTimes(1);
  });
});
