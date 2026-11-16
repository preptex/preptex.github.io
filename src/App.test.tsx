import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('renders the main panes with Export Project disabled until a ready view is configured', () => {
  render(<App />);
  expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Status bar' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Code' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'AST tree' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Operations...' }));
  expect(screen.getByRole('region', { name: 'Control panel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export Project' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Realize Conditions in Place' })).toBeDisabled();
});

test('uploads, exports realized project artifact, and displays it without mutating sources', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['Hello\n% hidden\nworld'], 'main.tex', { type: 'text/plain' }),
  ]);

  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const opsBtn = await screen.findByRole('button', { name: 'Operations...' });
  fireEvent.click(opsBtn);

  await waitFor(() => expect(screen.getByRole('button', { name: 'Export Project' })).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Suppress comments'));
  fireEvent.click(screen.getByRole('button', { name: 'Export Project' }));

  expect(await screen.findByText(/generated artifacts \(1\)/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  expect(
    await screen.findByText('main.tex', { selector: '.CodeviewFilename' }),
  ).toBeInTheDocument();
});

test('reports structural error on configured view while keeping Pipeline B condition realization available', async () => {
  render(<App />);
  userEvent.upload(
    screen.getByLabelText('Upload files'),
    new File(['\\newif\\ifcam\\camtrue\n\\ifcam\n\\begin{document}\nKeep\n\\fi'], 'bad.tex'),
  );

  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('bad.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  // Blocked structural view opens Log dialog popup automatically
  expect(await screen.findByRole('dialog', { name: 'Processing Log' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('structural-error');
  expect(screen.getByRole('alert')).toHaveTextContent('bad.tex:');

  fireEvent.click(screen.getByRole('button', { name: 'Close log dialog' }));

  // Pipeline A Export Project is disabled, but Pipeline B Condition Realization is enabled
  fireEvent.click(screen.getByRole('button', { name: 'Operations...' }));
  expect(screen.getByRole('button', { name: 'Export Project' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Realize Conditions in Place' })).toBeEnabled();
});

test('ignores malformed persisted AST options', () => {
  window.localStorage.setItem('preptex.astview.options.v6', JSON.stringify({
    visibleKinds: [null, 9], commandCards: 42, selectedCommands: 'title',
  }));
  render(<App />);
  expect(screen.getByRole('region', { name: 'AST tree' })).toBeInTheDocument();
  window.localStorage.clear();
});

test('first upload opens Project Setup dialog, and closing permits inspecting sources', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\ref{missing:target}'], 'doc.tex', { type: 'text/plain' }),
  ]);
  expect(await screen.findByRole('dialog', { name: 'Project Settings' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue inspecting sources' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Project Settings' })).not.toBeInTheDocument();
  });
  expect(screen.getByRole('region', { name: 'Project configuration summary' })).toBeInTheDocument();
});

test('runs independent reference analysis and shows findings in Log tab', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\ref{missing:label}'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const opsBtn = await screen.findByRole('button', { name: 'Operations...' });
  fireEvent.click(opsBtn);

  const checkRefBtn = await screen.findByRole('button', { name: 'Check References' });
  await waitFor(() => expect(checkRefBtn).toBeEnabled());

  fireEvent.click(checkRefBtn);

  expect(await screen.findByRole('dialog', { name: 'Processing Log' })).toBeInTheDocument();
  expect(await screen.findByText(/missing-reference/i)).toBeInTheDocument();
});

test('toggles AST view structure and source modes', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['Hello world'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const sourceModeBtn = await screen.findByRole('button', { name: 'Source' });
  fireEvent.click(sourceModeBtn);
  expect(screen.getByRole('button', { name: 'Source' })).toHaveClass('AstTreeModeBtn--active');

  const structureModeBtn = screen.getByRole('button', { name: 'Structure' });
  fireEvent.click(structureModeBtn);
  expect(screen.getByRole('button', { name: 'Structure' })).toHaveClass('AstTreeModeBtn--active');
});

test('realizes conditions in place and switches to condition-free mode', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\newif\\ifdraft\\drafttrue\n\\ifdraft\nDraft text\n\\else\nFinal text\n\\fi'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Operations...' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Realize Conditions in Place' }));

  const dialog = await screen.findByRole('dialog', { name: /edit preview/i });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/Condition-free \(none\)/i)).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: /apply edits to sources/i }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /edit preview/i })).not.toBeInTheDocument();
  });

  expect(screen.getByText('Condition-free (none)')).toBeInTheDocument();
  expect(screen.getByText('Ready')).toBeInTheDocument();
});

test('previews comment suppression and applies edits atomically', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['% A comment to remove\nKeep this text\n'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const opsBtn = await screen.findByRole('button', { name: 'Operations...' });
  fireEvent.click(opsBtn);

  const previewCommentsBtn = await screen.findByRole('button', { name: /preview comments/i });
  fireEvent.click(previewCommentsBtn);

  const dialog = await screen.findByRole('dialog', { name: /edit preview/i });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/% A comment to remove/i)).toBeInTheDocument();

  const applyEditsBtn = within(dialog).getByRole('button', { name: /apply edits to sources/i });
  fireEvent.click(applyEditsBtn);

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /edit preview/i })).not.toBeInTheDocument();
  });
});

test('previews named environment removal and allows discarding', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\begin{C}\nDebug info\n\\end{C}\nMain content\n'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const opsBtn = await screen.findByRole('button', { name: 'Operations...' });
  fireEvent.click(opsBtn);

  const envInput = await screen.findByPlaceholderText(/e\.g\. comment, C/i);
  fireEvent.change(envInput, { target: { value: 'C' } });

  const previewRemovalBtn = screen.getByRole('button', { name: /preview removal/i });
  fireEvent.click(previewRemovalBtn);

  const envDialog = await screen.findByRole('dialog', { name: /edit preview/i });
  expect(envDialog).toBeInTheDocument();
  expect(within(envDialog).getByText(/Debug info/i)).toBeInTheDocument();

  const discardBtn = within(envDialog).getByRole('button', { name: /discard/i });
  fireEvent.click(discardBtn);

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /edit preview/i })).not.toBeInTheDocument();
  });
});

test('exports project and shows generated artifacts with ZIP download', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const opsBtn = await screen.findByRole('button', { name: 'Operations...' });
  fireEvent.click(opsBtn);

  const exportBtn = await screen.findByRole('button', { name: /export project/i });
  fireEvent.click(exportBtn);

  const artifactHeadings = await screen.findAllByText(/generated artifacts \(1\)/i);
  expect(artifactHeadings.length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: /download zip/i }).length).toBeGreaterThan(0);
});

test('opens and closes log popup via Log button in toolbar', async () => {
  render(<App />);
  expect(screen.queryByRole('region', { name: 'Status bar' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Log' }));
  expect(screen.getByRole('dialog', { name: 'Processing Log' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Close log dialog' }));
  expect(screen.queryByRole('dialog', { name: 'Processing Log' })).not.toBeInTheDocument();
});

test('supports Coarse tree, Catalog custom arg reparsing, Metadata edit, and Composable Pipeline', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(
      [
        [
          '\\newif\\ifdraft\\drafttrue',
          '\\title{Original Title}',
          '\\author{Alice}',
          '\\section{Intro}',
          '\\undefcall[opt]{mand}',
          '% Comment to strip',
          '\\ifdraft Draft \\fi',
        ].join('\n'),
      ],
      'main.tex',
      { type: 'text/plain' },
    ),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  const coarseBtn = await screen.findByRole('button', { name: 'Coarse' });
  expect(coarseBtn).toHaveClass('AstTreeModeBtn--active');

  // Open Catalog and assign 1 optional + 1 mandatory arg to \undefcall so it reparses
  const catBtn = screen.getByRole('button', { name: /Catalog/i });
  fireEvent.click(catBtn);
  const catDialog = await screen.findByRole('dialog', {
    name: /Project Symbol & Construct Catalog/i,
  });
  expect(within(catDialog).getByText('\\undefcall')).toBeInTheDocument();

  fireEvent.change(
    within(catDialog).getByLabelText('Optional arguments for \\undefcall'),
    { target: { value: '1' } },
  );
  fireEvent.change(
    within(catDialog).getByLabelText('Mandatory arguments for \\undefcall'),
    { target: { value: '1' } },
  );
  fireEvent.click(within(catDialog).getByRole('button', { name: /Set Args & Reparse/i }));
  fireEvent.click(within(catDialog).getByRole('button', { name: 'Close catalog dialog' }));

  // Coarse tree should now display argument child nodes [#1] and {#2}
  expect(await screen.findByText('[#1]')).toBeInTheDocument();
  expect(screen.getByText('{#2}')).toBeInTheDocument();

  // Open Metadata and edit Title
  fireEvent.click(screen.getByRole('button', { name: 'Metadata' }));
  const metaDialog = await screen.findByRole('dialog', {
    name: /Document Metadata & Statistics/i,
  });
  expect(within(metaDialog).getByText('Original Title')).toBeInTheDocument();
  fireEvent.click(within(metaDialog).getByRole('button', { name: 'Edit Title' }));
  fireEvent.change(within(metaDialog).getByLabelText('Title value'), {
    target: { value: 'New Title' },
  });
  fireEvent.click(within(metaDialog).getByRole('button', { name: 'Preview Title Edit' }));

  const editPreview = await screen.findByRole('dialog', { name: /Edit Preview/i });
  expect(within(editPreview).getByText('New Title')).toBeInTheDocument();
  fireEvent.click(within(editPreview).getByRole('button', { name: /Discard/i }));

  // Run Composable Pipeline in Operations
  fireEvent.click(screen.getByRole('button', { name: 'Operations...' }));
  const compBtn = await screen.findByRole('button', { name: /Preview Composed Pipeline/i });
  fireEvent.click(compBtn);

  const compPreview = await screen.findByRole('dialog', { name: /Edit Preview — Composed Pipeline/i });
  expect(compPreview).toBeInTheDocument();
});
