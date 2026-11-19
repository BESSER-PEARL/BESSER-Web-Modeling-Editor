import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
        summary={{ operations: 33, artifacts: 1142, links: 733, outOfDateLinks: 0, staleGenerators: [] }}
        onShowOutOfDate={() => undefined}
      />,
    );
    expect(screen.getByText('1.142')).toBeTruthy();
  });
});
