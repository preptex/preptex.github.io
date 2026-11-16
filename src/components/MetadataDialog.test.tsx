import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectSnapshot,
  extractProjectMetadata,
  resolveProjectView,
} from '@preptex/core';
import { MetadataDialog } from './MetadataDialog';

describe('MetadataDialog', () => {
  it('displays metadata fields and statistics and submits direct title edit', () => {
    const snapshot = createProjectSnapshot([
      {
        path: 'main.tex',
        version: 1,
        source: [
          '\\documentclass[11pt]{article}',
          '\\usepackage{amsmath}',
          '\\title[Short]{Full Paper Title}',
          '\\author{Alice \\and Bob\\thanks{MIT}}',
          '\\date{November 2026}',
          '\\begin{abstract}Paper abstract text.\\end{abstract}',
          '\\section{Intro}Body $x=1$',
        ].join('\n'),
      },
    ]);
    const view = resolveProjectView(snapshot, { entryPath: 'main.tex' });
    const metadata = extractProjectMetadata(view.status === 'ready' ? view : snapshot);
    const onEditMetadata = jest.fn();

    render(
      <MetadataDialog
        isOpen
        onClose={jest.fn()}
        metadata={metadata}
        onEditMetadata={onEditMetadata}
        onSelectLocation={jest.fn()}
      />,
    );

    expect(screen.getByText('Full Paper Title')).toBeInTheDocument();
    expect(screen.getByText('Paper abstract text.')).toBeInTheDocument();
    expect(screen.getByText(/Parsed Authors \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('amsmath')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    fireEvent.change(screen.getByLabelText('Title value'), {
      target: { value: 'Revised Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Title Edit' }));

    expect(onEditMetadata).toHaveBeenCalledWith({
      kind: 'edit-metadata',
      field: 'title',
      newValue: 'Revised Title',
      shortValue: 'Short',
    });
  });
});
