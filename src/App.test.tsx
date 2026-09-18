import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('renders the main panes with Run disabled until a file is parsed', () => {
  render(<App />);
  expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Control panel' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Code' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'AST tree' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
});

test('uploads, transforms with the selected options, and selects the named output', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['Hello\n% hidden\nworld'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Suppress comments'));
  fireEvent.change(screen.getByLabelText('Output file name'), { target: { value: 'clean' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  await waitFor(() => expect(screen.getByLabelText('Entry file')).toHaveValue('clean.processed.tex'));
  expect(screen.getByRole('button', { name: 'Download clean.processed.tex' })).toBeInTheDocument();
});

test('reports malformed source with a typed error and prevents running an old snapshot', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), new File(['\\begin{document}'], 'bad.tex'));
  await screen.findByRole('tab', { name: 'Log (error)' });
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Log (error)' }));
  expect(screen.getByRole('alert')).toHaveTextContent('bad.tex:');
  expect(screen.getByRole('alert')).toHaveTextContent('syntax-error');
});

test('ignores malformed persisted AST options', () => {
  window.localStorage.setItem('preptex.astview.options.v5', JSON.stringify({
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
  // Dialog opens on first upload
  expect(await screen.findByRole('dialog', { name: 'Project Settings' })).toBeInTheDocument();
  // Dismiss dialog
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
  // Wait for file to finish uploading and dialog to recommend entry
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  // Apply setup dialog so entry is configured
  const applyBtn = screen.getByRole('button', { name: 'Apply Configuration' });
  fireEvent.click(applyBtn);

  // Check References button should be enabled
  const checkRefBtn = await screen.findByRole('button', { name: 'Check References' });
  await waitFor(() => expect(checkRefBtn).toBeEnabled());

  // Run analysis
  fireEvent.click(checkRefBtn);

  // Automatically switches to log tab and shows missing-reference finding
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
  const applyBtn = screen.getByRole('button', { name: 'Apply Configuration' });
  fireEvent.click(applyBtn);

  // Toggle to source mode
  const sourceModeBtn = await screen.findByRole('button', { name: 'Source' });
  fireEvent.click(sourceModeBtn);
  expect(screen.getByRole('button', { name: 'Source' })).toHaveClass('AstTreeModeBtn--active');

  // Toggle back to structure mode
  const structureModeBtn = screen.getByRole('button', { name: 'Structure' });
  fireEvent.click(structureModeBtn);
  expect(screen.getByRole('button', { name: 'Structure' })).toHaveClass('AstTreeModeBtn--active');
});

test('previews comment suppression and applies edits atomically (UI-14, UI-28)', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['% A comment to remove\nKeep this text\n'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  // Click Preview Comments
  const previewCommentsBtn = await screen.findByRole('button', { name: /preview comments/i });
  fireEvent.click(previewCommentsBtn);

  // Edit Preview dialog opens with proposed edits
  const dialog = await screen.findByRole('dialog', { name: /edit preview/i });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/% A comment to remove/i)).toBeInTheDocument();

  // Click Apply Edits to Sources
  const applyEditsBtn = within(dialog).getByRole('button', { name: /apply edits to sources/i });
  fireEvent.click(applyEditsBtn);

  // Dialog closes
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /edit preview/i })).not.toBeInTheDocument();
  });
});

test('previews named environment removal and allows discarding (UI-27)', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\begin{C}\nDebug info\n\\end{C}\nMain content\n'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  // Enter environment names
  const envInput = await screen.findByPlaceholderText(/e\.g\. comment, C/i);
  fireEvent.change(envInput, { target: { value: 'C' } });

  // Click Preview Removal
  const previewRemovalBtn = screen.getByRole('button', { name: /preview removal/i });
  fireEvent.click(previewRemovalBtn);

  // Edit preview dialog opens
  const envDialog = await screen.findByRole('dialog', { name: /edit preview/i });
  expect(envDialog).toBeInTheDocument();
  expect(within(envDialog).getByText(/Debug info/i)).toBeInTheDocument();

  // Click Discard
  const discardBtn = within(envDialog).getByRole('button', { name: /discard/i });
  fireEvent.click(discardBtn);

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /edit preview/i })).not.toBeInTheDocument();
  });
});

test('exports project and shows generated artifacts with ZIP download (UI-20)', async () => {
  render(<App />);
  userEvent.upload(screen.getByLabelText('Upload files'), [
    new File(['\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}'], 'main.tex', { type: 'text/plain' }),
  ]);
  await waitFor(() => {
    expect(screen.getByLabelText('Project Entry File')).toHaveValue('main.tex');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Configuration' }));

  // Click Export Project
  const exportBtn = await screen.findByRole('button', { name: /export project/i });
  fireEvent.click(exportBtn);

  // Generated artifacts section appears
  expect(await screen.findByText(/generated artifacts \(1\)/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument();
});
