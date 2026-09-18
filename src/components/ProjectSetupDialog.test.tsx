import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createProjectSnapshot, resolveProjectView } from '@preptex/core';
import { ProjectSetupDialog } from './ProjectSetupDialog';
import { ConfigurationSummary } from './ConfigurationSummary';
import { DEFAULT_CONFIGURATION } from '../model/useProjectConfiguration';

describe('Milestone 3: ProjectSetupDialog & ConfigurationSummary', () => {
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

  it('commits draft configuration only when Apply is clicked', () => {
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

    // Change entry
    const select = screen.getByLabelText(/Project Entry File/i);
    fireEvent.change(select, { target: { value: 'main.tex' } });

    expect(handleApply).not.toHaveBeenCalled();

    // Click Apply
    const applyButton = screen.getByText(/Apply Configuration/i);
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        entryPath: 'main.tex',
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

  it('renders ConfigurationSummary with appropriate status badge', () => {
    const snapshot = createProjectSnapshot([{ path: 'main.tex', version: 1, source: 'Hello' }]);
    const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });

    render(
      <ConfigurationSummary
        configuration={{ ...DEFAULT_CONFIGURATION, entryPath: 'main.tex' }}
        view={view}
        onOpenSettings={() => {}}
      />,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('main.tex')).toBeInTheDocument();
  });
});
