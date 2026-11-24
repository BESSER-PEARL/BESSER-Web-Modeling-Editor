import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../shared/i18n';
import { TraceSummaryHeader } from '../TraceSummaryHeader';

describe('TraceSummaryHeader', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('writes its figures in the page language', async () => {
    // Live: the German page showed "1,142" artifacts, the English separator.
    await i18n.changeLanguage('de');
    render(
      <TraceSummaryHeader
        summary={{ operations: 33, artifacts: 1142, links: 733, outOfDateLinks: 0, staleGenerators: [], otherOutOfDateLinks: 0 }}
        onShowOutOfDate={() => undefined}
        onShowLineage={() => undefined}
      />,
    );
    expect(screen.getByText('1.142')).toBeTruthy();
  });

  // BESSER #834: "16 links may be out of date" stood above "13 files out of date" with nothing to relate them.
  it('says how many out-of-date links each generator has, and how many are not to code', () => {
    const file = { id: 'f', type: 'CodeArtifact' as const, name: 'Book.java', path: 'Book.java', contentHash: 'h', timestamp: '2026-11-24T10:00:00.000Z' };
    const operation = {
      id: 'run', type: 'CodeGeneration' as const, status: 'SUCCEEDED' as const, startedAt: '2026-11-24T10:00:00.000Z',
      performedBy: [], toolCalls: [], reads: [], writes: ['f'],
    };
    const onShowLineage = vi.fn();
    render(
      <TraceSummaryHeader
        summary={{
          operations: 4, artifacts: 40, links: 30, outOfDateLinks: 16, otherOutOfDateLinks: 2,
          staleGenerators: [{ tool: undefined, operation, files: [file], linkedFiles: 13, outOfDateLinks: 14 }],
        }}
        onShowOutOfDate={() => undefined}
        onShowLineage={onShowLineage}
      />,
    );
    expect(screen.getByText(/14 out-of-date links/)).toBeTruthy();
    expect(screen.getByText(/2 out-of-date links are between requirements and models/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View lineage' }));
    expect(onShowLineage).toHaveBeenCalledOnce();
  });
});
