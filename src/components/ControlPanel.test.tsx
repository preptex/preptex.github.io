import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ControlPanel from './ControlPanel';
import type { CoreOptionsUI } from '../model/useControl';
import type { GeneratedArtifact } from '@preptex/core';

const defaultOptions: CoreOptionsUI = {
  outputName: '',
  inputHandling: 'preserve',
  suppressComments: false,
  suppressCommentEnvironments: false,
  stripDeclarationsAndSetters: true,
};

describe('ControlPanel', () => {
  test('renders options and triggers Pipeline B condition realization & Pipeline A export', () => {
    const onChange = jest.fn();
    const onRealizeConditions = jest.fn();
    const onExportProject = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={onChange}
        entryFile="main.tex"
        canRealizeConditions={true}
        onRealizeConditions={onRealizeConditions}
        canExportProject={true}
        onExportProject={onExportProject}
        conditionDecisions={[
          {
            origin: {
              path: 'main.tex',
              range: { line: 2, start: 10, end: 17 },
              snapshotId: 'snap-1',
              occurrenceId: 'occ-1',
            },
            command: 'ifdraft',
            outcome: 'true',
            trackedValue: true,
            effectiveValue: true,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Entry file')).toHaveValue('main.tex');
    expect(screen.getByText('\\ifdraft')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();

    // Trigger Pipeline B in-place realization
    fireEvent.click(screen.getByRole('button', { name: 'Realize Conditions in Place' }));
    expect(onRealizeConditions).toHaveBeenCalledWith('preview-edits', 'preserve');

    // Toggle suppress comments and export
    fireEvent.click(screen.getByLabelText('Suppress comments'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ suppressComments: true }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export Project' }));
    expect(onExportProject).toHaveBeenCalledTimes(1);
  });

  test('renders and triggers independent analysis actions', () => {
    const onRunReferences = jest.fn();
    const onRunCommandUsage = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
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

  test('triggers comment suppression and environment removal previews on realized view', () => {
    const onPreviewCommentSuppression = jest.fn();
    const onPreviewRemoveEnvironments = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
        canRunViewTransformations={true}
        onPreviewCommentSuppression={onPreviewCommentSuppression}
        onPreviewRemoveEnvironments={onPreviewRemoveEnvironments}
      />,
    );

    const commentBtn = screen.getByRole('button', { name: /preview comments/i });
    fireEvent.click(commentBtn);
    expect(onPreviewCommentSuppression).toHaveBeenCalledWith(false);

    const envInput = screen.getByPlaceholderText(/e\.g\. comment, C/i);
    fireEvent.change(envInput, { target: { value: 'C, comment' } });
    const envBtn = screen.getByRole('button', { name: /preview removal/i });
    fireEvent.click(envBtn);
    expect(onPreviewRemoveEnvironments).toHaveBeenCalledWith(['C', 'comment'], 'selected');
  });

  test('renders generated artifacts and triggers ZIP download', () => {
    const onDownloadZip = jest.fn();
    const onSelectArtifact = jest.fn();

    const mockArtifacts: readonly GeneratedArtifact[] = [
      {
        path: 'main.tex',
        source: 'Transformed content',
        provenance: {
          snapshotId: 'snap-1',
          viewId: 'view-1',
          request: {
            operation: 'export-project',
            options: { inputs: 'preserve' },
          },
          operationVersion: 1,
        },
        origins: [],
        remainingInputs: [],
        topology: 'preserved-project',
      },
      {
        path: 'intro.tex',
        source: 'Intro content',
        provenance: {
          snapshotId: 'snap-1',
          viewId: 'view-1',
          request: {
            operation: 'export-project',
            options: { inputs: 'preserve' },
          },
          operationVersion: 1,
        },
        origins: [],
        remainingInputs: [],
        topology: 'preserved-project',
      },
    ];

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
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
