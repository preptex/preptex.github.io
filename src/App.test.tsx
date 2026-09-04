import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
