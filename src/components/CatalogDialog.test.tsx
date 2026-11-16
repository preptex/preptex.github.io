import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectSnapshot,
  inspectProjectCatalog,
  resolveProjectView,
} from '@preptex/core';
import { CatalogDialog } from './CatalogDialog';

describe('CatalogDialog', () => {
  function buildCatalog() {
    const snapshot = createProjectSnapshot([
      {
        path: 'main.tex',
        version: 1,
        source: [
          '\\newcommand{\\hi}[1]{Hello #1}',
          '\\newenvironment{boxenv}{\\begin{quote}}{\\end{quote}}',
          '\\newif\\ifdraft',
          '\\drafttrue',
          '\\section{Intro}\\label{sec:intro}',
          '\\hi{World} \\undefcmd[a]{b}',
          '\\ifdraft Draft \\fi',
          '\\begin{boxenv}Body\\end{boxenv}',
          '\\ref{sec:intro} \\cite{k1}',
          '\\begin{thebibliography}{1}\\bibitem{k1} Ref\\end{thebibliography}',
        ].join('\n'),
      },
    ]);
    const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });
    return inspectProjectCatalog(view.status === 'ready' ? view : snapshot);
  }

  it('displays commands, filters to undefined commands, sets custom arguments, and jumps to occurrences', () => {
    const catalog = buildCatalog();
    const onUpsert = jest.fn();
    const onSelectLocation = jest.fn();
    const onRefactorSymbol = jest.fn();

    render(
      <CatalogDialog
        isOpen
        onClose={jest.fn()}
        catalog={catalog}
        customCommands={[]}
        onUpsertCustomCommand={onUpsert}
        onRemoveCustomCommand={jest.fn()}
        onRefactorSymbol={onRefactorSymbol}
        onSelectLocation={onSelectLocation}
      />,
    );

    expect(screen.getByText('\\hi')).toBeInTheDocument();
    expect(screen.getByText('\\undefcmd')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Used Undefined' }));
    expect(screen.queryByText('\\hi')).not.toBeInTheDocument();
    expect(screen.getByText('\\undefcmd')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Optional arguments for \\undefcmd'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Mandatory arguments for \\undefcmd'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Set Args & Reparse/i }));
    expect(onUpsert).toHaveBeenCalledWith({
      name: 'undefcmd',
      optionalArgs: 1,
      mandatoryArgs: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: /1 uses/i }));
    fireEvent.click(screen.getByRole('button', { name: /main\.tex:6/i }));
    expect(onSelectLocation).toHaveBeenCalledTimes(1);
  });

  it('switches tabs to environments, conditions, labels, and citations and triggers global rename', () => {
    const catalog = buildCatalog();
    const onRefactorSymbol = jest.fn();

    render(
      <CatalogDialog
        isOpen
        onClose={jest.fn()}
        catalog={catalog}
        customCommands={[]}
        onUpsertCustomCommand={jest.fn()}
        onRemoveCustomCommand={jest.fn()}
        onRefactorSymbol={onRefactorSymbol}
        onSelectLocation={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Environments/i }));
    expect(screen.getByText('boxenv')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New name for environment boxenv'), {
      target: { value: 'callout' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rename All environment boxenv' }));
    expect(onRefactorSymbol).toHaveBeenCalledWith({
      kind: 'rename-environment-globally',
      oldName: 'boxenv',
      newName: 'callout',
    });

    fireEvent.click(screen.getByRole('tab', { name: /Labels & Refs/i }));
    expect(screen.getByText('sec:intro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Citations/i }));
    expect(screen.getByText('k1')).toBeInTheDocument();
  });
});
