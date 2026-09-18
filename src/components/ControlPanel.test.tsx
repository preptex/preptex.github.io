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
});
