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
  test('contains only code transformations (no analyses) and no per-box apply buttons', () => {
    render(
      <ControlPanel
        options={defaultOptions}
        onChange={jest.fn()}
        entryFile="main.tex"
        canRealizeConditions={true}
        canRunViewTransformations={true}
        onApplyTransformations={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Check References' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Commands' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Realize Conditions' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Suppress Comments' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Remove Environments' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Expand \/ Flatten \\input Commands/i }),
    ).toBeInTheDocument();

    // Only a single apply button exists in the unified apply panel
    expect(screen.getByRole('button', { name: /Preview & Apply in Place/i })).toBeDisabled();
  });

  test('boxes are expandable/activatable and unified Apply supports in-place vs new folder output', () => {
    const onChange = jest.fn();
    const onApplyTransformations = jest.fn();

    render(
      <ControlPanel
        options={defaultOptions}
        onChange={onChange}
        entryFile="main.tex"
        canRealizeConditions={true}
        canRunViewTransformations={true}
        onApplyTransformations={onApplyTransformations}
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

    // Expand all discloses condition decisions and option controls
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('\\ifdraft')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();

    // Activate Realize Conditions + Suppress Comments, run in-place
    fireEvent.click(screen.getByRole('checkbox', { name: 'Realize Conditions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress Comments' }));

    fireEvent.click(screen.getByRole('button', { name: /Preview & Apply in Place/i }));
    expect(onApplyTransformations).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'inplace',
        realizeConditions: true,
        suppressComments: expect.objectContaining({ enabled: true }),
      }),
    );

    // Switch destination to Output new file(s) inside a custom folder
    fireEvent.click(screen.getByRole('radio', { name: /Output new file\(s\)/i }));
    fireEvent.change(screen.getByLabelText(/Output folder/i), { target: { value: 'out/clean' } });
    expect(screen.getByText('Output path example: out/clean/main.tex')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create New File\(s\)/i }));
    expect(onApplyTransformations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        destination: 'new-files',
        outputFolder: 'out/clean',
        realizeConditions: true,
        suppressComments: expect.objectContaining({ enabled: true }),
      }),
    );
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
