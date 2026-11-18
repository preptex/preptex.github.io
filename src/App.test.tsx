import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function openViewAndSelect(pattern: RegExp) {
  fireEvent.click(screen.getByRole('menuitem', { name: /^View/i }));
  const drawer = screen.getByRole('menu', { name: 'Views drawer' });
  fireEvent.click(within(drawer).getByRole('menuitemradio', { name: pattern }));
}

function openEditAndClick(pattern: RegExp) {
  fireEvent.click(screen.getByRole('menuitem', { name: /^Edit/i }));
  const menu = screen.getByRole('menu', { name: 'Edit menu' });
  fireEvent.click(within(menu).getByRole('menuitem', { name: pattern }));
}

test('renders empty welcome workspace, top menubar drawers, disabled history/split controls, and collapsible explorer', () => {
  render(<App />);

  expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Empty workspace' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Unified menubar has File, Edit, View (without duplicate view tabs)
  const menubar = screen.getByRole('menubar', { name: 'Application menu' });
  expect(within(menubar).getByRole('menuitem', { name: /^File$/i })).toBeInTheDocument();
  expect(within(menubar).getByRole('menuitem', { name: /^Edit$/i })).toBeInTheDocument();
  expect(within(menubar).getByRole('menuitem', { name: /^View/i })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Workspace views' })).toBeNull();

  // Undo / Redo live inside Edit drawer
  fireEvent.click(within(menubar).getByRole('menuitem', { name: /^Edit$/i }));
  const editMenu = screen.getByRole('menu', { name: 'Edit menu' });
  expect(within(editMenu).getByRole('menuitem', { name: /undo transformation/i })).toBeDisabled();
  expect(within(editMenu).getByRole('menuitem', { name: /redo transformation/i })).toBeDisabled();

  // Split & Explorer toggle inside View drawer
  fireEvent.click(within(menubar).getByRole('menuitem', { name: /^View/i }));
  const drawer = screen.getByRole('menu', { name: 'Views drawer' });
  const splitItem = within(drawer).getByRole('menuitemcheckbox', { name: /split code companion/i });
  expect(splitItem).toHaveAttribute('aria-checked', 'false');

  // Toggle Explorer off & back on from File Explorer edge controls
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

  fireEvent.click(screen.getByRole('menuitem', { name: /^File$/i }));
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

  // Open View drawer -> select Transformations
  openViewAndSelect(/transformations/i);

  expect(await screen.findByRole('region', { name: 'Transformations' })).toBeInTheDocument();

  // Whole-document Comment Suppression via unified panel (in-place -> Diff Review)
  fireEvent.click(within(screen.getByRole('region', { name: 'Transformations' })).getByRole('checkbox', { name: 'Suppress Comments' }));
  fireEvent.click(screen.getByRole('button', { name: /Preview & Apply in Place/i }));

  const diffRegion = await screen.findByRole('region', { name: 'Diff Review' });
  expect(within(diffRegion).getByText(/Branch A comment/i)).toBeInTheDocument();
  expect(within(diffRegion).getByText(/Branch B comment/i)).toBeInTheDocument();

  // Apply edits -> overrides in place & returns to Code
  fireEvent.click(within(diffRegion).getAllByRole('button', { name: /apply edits to sources/i })[0]!);
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Diff Review' })).not.toBeInTheDocument();
  });
  expect(screen.getByText('main.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();

  // Undo restores original comments; Redo removes them again (via Edit drawer)
  openEditAndClick(/undo: comment suppression/i);
  expect(screen.getByText(/% Branch A comment/)).toBeInTheDocument();

  openEditAndClick(/redo: comment suppression/i);
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

  // Open AST view from View drawer
  openViewAndSelect(/^AST\b/i);

  // Switch AST to Structure / check inline Phase 0 presence
  expect(await screen.findByRole('region', { name: 'AST tree' })).toBeInTheDocument();
  expect(screen.getByText(/Viewing all conditional branches|Condition paths needed/i)).toBeInTheDocument();

  // Open Catalog and enable Split Code Companion from View drawer
  openViewAndSelect(/^Catalog\b/i);
  expect(await screen.findByRole('region', { name: 'Catalog' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('menuitem', { name: /^View/i }));
  const drawer = screen.getByRole('menu', { name: 'Views drawer' });
  fireEvent.click(within(drawer).getByRole('menuitemcheckbox', { name: /split code companion/i }));
  expect(screen.getByLabelText('Split companion view')).toBeInTheDocument();

  // Jump to symbol occurrence stays in Catalog + companion Code stays visible
  const badge = await screen.findByText('\\undefcmd');
  expect(badge).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Catalog' })).toBeInTheDocument();
});

test('runs diagnostics reference check, outputs transformed files to a new folder, and stages Metadata diffs', async () => {
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

  // Diagnostics view -> Check References & Check Commands (analyses live in Diagnostics)
  openViewAndSelect(/^Diagnostics\b/i);
  const diagRegion = await screen.findByRole('region', { name: 'Diagnostics' });
  fireEvent.click(within(diagRegion).getByRole('button', { name: 'Check References' }));
  expect(await within(diagRegion).findByText(/missing-reference/i)).toBeInTheDocument();
  fireEvent.click(within(diagRegion).getByRole('button', { name: 'Check Commands' }));
  expect(await within(diagRegion).findByRole('button', { name: 'Check Commands' })).toBeEnabled();

  // Catalog custom arg reparsing -> Coarse AST shows argument nodes
  openViewAndSelect(/^Catalog\b/i);
  const catRegion = await screen.findByRole('region', { name: 'Catalog' });
  fireEvent.change(within(catRegion).getByLabelText('Optional arguments for \\undefcall'), {
    target: { value: '1' },
  });
  fireEvent.change(within(catRegion).getByLabelText('Mandatory arguments for \\undefcall'), {
    target: { value: '1' },
  });
  fireEvent.click(within(catRegion).getByRole('button', { name: /Set Args & Reparse/i }));

  openViewAndSelect(/^AST\b/i);
  expect(await screen.findByText('[#1]')).toBeInTheDocument();
  expect(screen.getByText('{#2}')).toBeInTheDocument();

  // Metadata edit -> stages Diff Review -> Discard returns to Metadata
  openViewAndSelect(/^Metadata\b/i);
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

  // Transformations -> unified Apply creating new files in a new folder
  openViewAndSelect(/^Transformations\b/i);
  const txRegion = await screen.findByRole('region', { name: 'Transformations' });
  expect(within(txRegion).queryByRole('button', { name: 'Check References' })).toBeNull();
  fireEvent.click(within(txRegion).getByRole('checkbox', { name: 'Suppress Comments' }));
  fireEvent.click(within(txRegion).getByRole('radio', { name: /Output new file\(s\)/i }));
  fireEvent.change(within(txRegion).getByLabelText(/Output folder/i), { target: { value: 'clean' } });
  fireEvent.click(within(txRegion).getByRole('button', { name: /Create New File\(s\)/i }));

  expect(await screen.findByText('clean/main.tex', { selector: '.CodeviewFilename' })).toBeInTheDocument();
  expect(screen.queryByText(/% Comment to strip/)).not.toBeInTheDocument();
});

test('toggles command vs recursive AST inputs, warns on missing input without halting, and expands/undoes inputs', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /load demo project/i }));
  await screen.findByText('main.tex', { selector: '.CodeviewFilename' });

  openViewAndSelect(/^AST\b/i);

  const inputToggleGroup = await screen.findByRole('group', { name: 'Input handling mode' });
  const commandBtn = within(inputToggleGroup).getByRole('button', { name: 'Command' });
  const recursiveBtn = within(inputToggleGroup).getByRole('button', { name: 'Recursive' });
  expect(commandBtn).toHaveClass('AstTreeModeBtn--active');
  expect(screen.queryByText('Background')).toBeNull();

  fireEvent.click(recursiveBtn);
  const updatedGroup = await screen.findByRole('group', { name: 'Input handling mode' });
  expect(within(updatedGroup).getByRole('button', { name: 'Recursive' })).toHaveClass(
    'AstTreeModeBtn--active',
  );
  expect(await screen.findByText('Background')).toBeInTheDocument();

  // Switch to Transformations and expand \input in place via unified apply panel
  openViewAndSelect(/^Transformations\b/i);
  const txRegion = await screen.findByRole('region', { name: 'Transformations' });
  fireEvent.click(within(txRegion).getByRole('checkbox', { name: /Expand \/ Flatten \\input Commands/i }));
  fireEvent.click(within(txRegion).getByRole('button', { name: /Preview & Apply in Place/i }));

  const diffRegion = await screen.findByRole('region', { name: 'Diff Review' });
  expect(within(diffRegion).getByText(/Background/i)).toBeInTheDocument();

  fireEvent.click(within(diffRegion).getAllByRole('button', { name: /Apply Edits/i })[0]!);
  openViewAndSelect(/^Code\b/i);
  expect(await screen.findByText(/Since 1984/i)).toBeInTheDocument();

  // Undo restores \input{intro/history.tex} via Edit menu
  openEditAndClick(/Undo:/i);
  expect(screen.getByText(/\\input\{intro\/history\.tex\}/i)).toBeInTheDocument();
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
