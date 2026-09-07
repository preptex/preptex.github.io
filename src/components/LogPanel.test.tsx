import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LogPanel from './LogPanel';
import type { AnalysisFinding } from '@preptex/core';

describe('Milestone 5: LogPanel with Structured Findings', () => {
  it('renders findings and triggers onSelectLocation when clicked', () => {
    const handleSelectLocation = jest.fn();
    const findings: readonly AnalysisFinding[] = [
      {
        code: 'missing-reference',
        severity: 'warning',
        message: 'Reference to absent label',
        primary: {
          path: 'main.tex',
          range: { line: 5, start: 10, end: 20 },
          snapshotId: 'snap-1',
          occurrenceId: 'occ-1',
        },
        related: [],
      },
    ];

    render(
      <LogPanel
        diagnostics={[]}
        error={null}
        findings={findings}
        onSelectLocation={handleSelectLocation}
      />,
    );

    expect(screen.getByText(/Reference to absent label/)).toBeInTheDocument();
    expect(screen.getByText(/\[WARNING\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[missing-reference\]/)).toBeInTheDocument();

    const link = screen.getByRole('button', { name: '(main.tex:5)' });
    fireEvent.click(link);
    expect(handleSelectLocation).toHaveBeenCalledWith(findings[0]?.primary);
  });

  it('displays warning banner when results are stale', () => {
    render(
      <LogPanel
        diagnostics={[]}
        error={null}
        findings={[]}
        isStale={true}
      />,
    );

    expect(screen.getByText(/Findings may be stale/)).toBeInTheDocument();
  });
});
