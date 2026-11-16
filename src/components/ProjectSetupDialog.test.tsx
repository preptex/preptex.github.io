import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createProjectSnapshot, resolveProjectView } from '@preptex/core';
import { ProjectSetupDialog } from './ProjectSetupDialog';
import { ConfigurationSummary } from './ConfigurationSummary';
import { DEFAULT_CONFIGURATION } from '../model/useProjectConfiguration';

describe('ProjectSetupDialog & ConfigurationSummary', () => {
  const defaultFiles = {
    'main.tex': '\\newif\\ifdraft\\drafttrue',
    'part.tex': 'Part',
  };

  it('does not render when isOpen is false', () => {
    render(
      <ProjectSetupDialog
        isOpen={false}
        onClose={() => {}}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={() => {}}
        detectedConditions={['draft']}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal dialog and detected conditions when open', () => {
    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={() => {}}
        files={defaultFiles}
        configuration={{
          ...DEFAULT_CONFIGURATION,
          conditionPolicy: { mode: 'source-with-overrides', overrides: {} },
        }}
        onApply={() => {}}
        detectedConditions={['draft']}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('\\ifdraft')).toBeInTheDocument();
  });

  it('commits draft configuration including condition-free mode none when Apply is clicked', () => {
    const handleApply = jest.fn();
    const handleClose = jest.fn();

    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={handleClose}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={handleApply}
        detectedConditions={['draft']}
      />,
    );

    const select = screen.getByLabelText(/Project Entry File/i);
    fireEvent.change(select, { target: { value: 'main.tex' } });

    const policySelect = screen.getByLabelText(/Condition Evaluation Policy/i);
    fireEvent.change(policySelect, { target: { value: 'none' } });

    expect(handleApply).not.toHaveBeenCalled();

    const applyButton = screen.getByText(/Apply Configuration/i);
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        entryPath: 'main.tex',
        conditionPolicy: { mode: 'none' },
      }),
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes dialog without applying when Continue inspecting sources is clicked', () => {
    const handleApply = jest.fn();
    const handleClose = jest.fn();

    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={handleClose}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={handleApply}
        detectedConditions={['draft']}
      />,
    );

    const closeBtn = screen.getByText(/Continue inspecting sources/i);
    fireEvent.click(closeBtn);

    expect(handleApply).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders ConfigurationSummary with Ready and Blocked unrealized-condition status', () => {
    const snapshot = createProjectSnapshot([{ path: 'main.tex', version: 1, source: 'Hello' }]);
    const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });

    const { rerender } = render(
      <ConfigurationSummary
        configuration={{ ...DEFAULT_CONFIGURATION, entryPath: 'main.tex' }}
        view={view}
        onOpenSettings={() => {}}
      />,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('main.tex')).toBeInTheDocument();

    const condSnap = createProjectSnapshot([
      { path: 'main.tex', version: 1, source: '\\ifdraft Hello\\fi' },
    ]);
    const blockedView = resolveProjectView(condSnap, {
      entryPath: 'main.tex',
      conditions: { mode: 'none' },
    });

    rerender(
      <ConfigurationSummary
        configuration={{
          ...DEFAULT_CONFIGURATION,
          entryPath: 'main.tex',
          conditionPolicy: { mode: 'none' },
        }}
        view={blockedView}
        onOpenSettings={() => {}}
      />,
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('unrealized-condition')).toBeInTheDocument();
    expect(screen.getByText('Condition-free (none)')).toBeInTheDocument();
  });
});
