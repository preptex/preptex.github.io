import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('renders empty welcome workspace, top bar menus, disabled history/split controls, and collapsible explorer', () => {
  render(<App />);

  expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Empty workspace' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  const undoBtn = screen.getByRole('button', { name: /undo transformation/i });
  const redoBtn = screen.getByRole('button', { name: /redo transformation/i });
  expect(undoBtn).toBeDisabled();
  expect(redoBtn).toBeDisabled();

  const splitBtn = screen.getByRole('button', { name: /split side-by-side view/i });
  expect(splitBtn).toHaveAttribute('aria-pressed', 'false');

  // Toggle Explorer off & back on
  const toggleFilesBtn = screen.getByRole('button', { name: /hide file explorer/i });
  fireEvent.click(toggleFilesBtn);
  expect(screen.getByRole('button', { name: /show file explorer/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /show file explorer/i }));
});

test('first file upload auto-selects entry and defaults to all-branches mode without any modal popup', async () => {
  render(<App />);

  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(
      ['\\ifunknown\n% Branch A comment\nAlpha\n\\else\n% Branch B comment\nBeta\n\\fi\n'],
      'main.tex',
      { type: 'text/plain' },
    ),
  ]);

  expect(await screen.findByText('main.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await screen.findByText(/main\.tex · All branches/i)).toBeInTheDocument();
});

test('File menu loads demo project with subfolder input, filters explorer, and creates subfolder files', async () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /^File/i }));
  const fileMenu = screen.getByRole('menu', { name: 'File menu' });
  fireEvent.click(within(fileMenu).getByRole('menuitem', { name: /load demo project/i }));

  expect(await screen.findByText('main.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();
  expect(screen.getByText('intro')).toBeInTheDocument();
  expect(screen.getByText('history.tex')).toBeInTheDocument();

  // Filter explorer to subfolder file
  const filterInput = screen.getByLabelText('Filter files');
  fireEvent.change(filterInput, { target: { value: 'history' } });
  expect(screen.getByText('history.tex')).toBeInTheDocument();
  fireEvent.change(filterInput, { target: { value: '' } });

  // Create a new file inside a new subfolder
  fireEvent.click(screen.getByRole('button', { name: 'New file' }));
  fireEvent.change(screen.getByLabelText('New file path'), {
    target: { value: 'sections/conclusion.tex' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByText('sections/conclusion.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();
});

test('Views drawer switches views, exports realized project artifact, and supports Diff Review + Undo/Redo history', async () => {
  render(<App />);

  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(
      ['\\ifunknown\n% Branch A comment\nKeep A\n\\else\n% Branch B comment\nKeep B\n\\fi\n'],
      'main.tex',
      { type: 'text/plain' },
    ),
  ]);
  await screen.findByText('main.tex', { selector: '.CodeviewFilename' });

  // Open Views drawer -> select Transformations
  fireEvent.click(screen.getByRole('button', { name: 'Views' }));
  const drawer = screen.getByRole('menu', { name: 'Views drawer' });
  fireEvent.click(within(drawer).getByRole('menuitemradio', { name: /transformations/i }));

  expect(await screen.findByRole('region', { name: 'Transformations' })).toBeInTheDocument();

  // Whole-document Comment Suppression (default scope = All branches)
  fireEvent.click(screen.getByRole('button', { name: /preview comments/i }));

  const diffRegion = await screen.findByRole('region', { name: 'Diff Review' });
  expect(within(diffRegion).getByText(/Branch A comment/i)).toBeInTheDocument();
  expect(within(diffRegion).getByText(/Branch B comment/i)).toBeInTheDocument();

  // Apply edits -> overrides in place & returns to Code
  fireEvent.click(within(diffRegion).getAllByRole('button', { name: /apply edits to sources/i })[0]!);
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Diff Review' })).not.toBeInTheDocument();
  });
  expect(screen.getByText('main.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();

  // Undo restores original comments; Redo removes them again
  const undoBtn = screen.getByRole('button', { name: /undo: comment suppression/i });
  expect(undoBtn).toBeEnabled();
  fireEvent.click(undoBtn);
  expect(screen.getByText(/% Branch A comment/)).toBeInTheDocument();

  const redoBtn = screen.getByRole('button', { name: /redo: comment suppression/i });
  expect(redoBtn).toBeEnabled();
  fireEvent.click(redoBtn);
  await waitFor(() => {
    expect(screen.queryByText(/% Branch A comment/)).not.toBeInTheDocument();
  });
});

test('inline Phase 0 in AST view configures blocked cross-branch AST and Split view enables jumping from Catalog', async () => {
  render(<App />);

  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(
      [
        '\\newif\\ifcam\\camtrue\n\\title{My Title}\n\\ifcam\n\\begin{document}\nCam version\n\\else\n\\begin{document}\nAlt version\n\\fi\n\\section{Intro}\\label{sec:intro}\n\\undefcmd{x}\n',
      ],
      'main.tex',
      { type: 'text/plain' },
    ),
  ]);
  await screen.findByText('main.tex', { selector: '.CodeviewFilename' });

  // Open AST view cleanly from quick tabs
  const nav = screen.getByRole('navigation', { name: 'Workspace views' });
  fireEvent.click(within(nav).getByRole('button', { name: 'AST' }));

  // Switch AST to Structure / check inline Phase 0 presence
  expect(await screen.findByRole('region', { name: 'AST tree' })).toBeInTheDocument();
  expect(screen.getByText(/Viewing all conditional branches|Condition paths needed/i)).toBeInTheDocument();

  // Open Catalog and enable Split side-by-side view
  fireEvent.click(within(nav).getByRole('button', { name: 'Catalog' }));
  expect(await screen.findByRole('region', { name: 'Catalog' })).toBeInTheDocument();

  const splitBtn = screen.getByRole('button', { name: /split side-by-side view/i });
  fireEvent.click(splitBtn);
  expect(splitBtn).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Split companion view')).toBeInTheDocument();

  // Jump to symbol occurrence stays in Catalog + companion Code stays visible
  const badge = await screen.findByText('\\undefcmd');
  expect(badge).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Catalog' })).toBeInTheDocument();
});

test('runs diagnostics reference check, exports artifacts with ZIP download, and stages Metadata / Composable Pipeline diffs', async () => {
  render(<App />);

  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(
      [
        [
          '\\documentclass{article}',
          '\\title{Original Title}',
          '\\author{Alice}',
          '\\begin{document}',
          '\\section{Intro}',
          '\\ref{missing:target}',
          '\\undefcall[opt]{mand}',
          '% Comment to strip',
          '\\end{document}',
        ].join('\n'),
      ],
      'main.tex',
      { type: 'text/plain' },
    ),
  ]);
  await screen.findByText('main.tex', { selector: '.CodeviewFilename' });

  const nav = screen.getByRole('navigation', { name: 'Workspace views' });

  // Diagnostics view -> Check References
  fireEvent.click(within(nav).getByRole('button', { name: 'Diagnostics' }));
  const diagRegion = await screen.findByRole('region', { name: 'Diagnostics' });
  fireEvent.click(within(diagRegion).getByRole('button', { name: 'Check References' }));
  expect(await within(diagRegion).findByText(/missing-reference/i)).toBeInTheDocument();

  // Catalog custom arg reparsing -> Coarse AST shows argument nodes
  fireEvent.click(within(nav).getByRole('button', { name: 'Catalog' }));
  const catRegion = await screen.findByRole('region', { name: 'Catalog' });
  fireEvent.change(within(catRegion).getByLabelText('Optional arguments for \\undefcall'), {
    target: { value: '1' },
  });
  fireEvent.change(within(catRegion).getByLabelText('Mandatory arguments for \\undefcall'), {
    target: { value: '1' },
  });
  fireEvent.click(within(catRegion).getByRole('button', { name: /Set Args & Reparse/i }));

  fireEvent.click(within(nav).getByRole('button', { name: 'AST' }));
  expect(await screen.findByText('[#1]')).toBeInTheDocument();
  expect(screen.getByText('{#2}')).toBeInTheDocument();

  // Metadata edit -> stages Diff Review -> Discard returns to Metadata
  fireEvent.click(within(nav).getByRole('button', { name: 'Metadata' }));
  const metaRegion = await screen.findByRole('region', { name: 'Metadata' });
  expect(within(metaRegion).getByText('Original Title')).toBeInTheDocument();
  fireEvent.click(within(metaRegion).getByRole('button', { name: 'Edit Title' }));
  fireEvent.change(within(metaRegion).getByLabelText('Title value'), {
    target: { value: 'New Title' },
  });
  fireEvent.click(within(metaRegion).getByRole('button', { name: 'Preview Title Edit' }));

  const diffRegion = await screen.findByRole('region', { name: 'Diff Review' });
  expect(within(diffRegion).getByText('New Title')).toBeInTheDocument();
  fireEvent.click(within(diffRegion).getAllByRole('button', { name: /Discard/i })[0]!);

  expect(await screen.findByRole('region', { name: 'Metadata' })).toBeInTheDocument();

  // Transformations -> Export Project & Composable Pipeline
  fireEvent.click(within(nav).getByRole('button', { name: /^Transforms/i }));
  const txRegion = await screen.findByRole('region', { name: 'Transformations' });
  fireEvent.click(within(txRegion).getByRole('button', { name: /export project/i }));
  expect(await within(txRegion).findByText(/generated artifacts \(1\)/i)).toBeInTheDocument();
  expect(within(txRegion).getByRole('button', { name: /download zip/i })).toBeInTheDocument();

  fireEvent.click(within(txRegion).getByRole('button', { name: /preview composed pipeline/i }));
  expect(await screen.findByRole('region', { name: 'Diff Review' })).toBeInTheDocument();
});

test('ignores malformed persisted AST options', () => {
  window.localStorage.setItem(
    'preptex.astview.options.v6',
    JSON.stringify({ visibleKinds: [null, 9], commandCards: 42, selectedCommands: 'title' }),
  );
  render(<App />);
  expect(screen.getByRole('region', { name: 'Empty workspace' })).toBeInTheDocument();
  window.localStorage.clear();
});
