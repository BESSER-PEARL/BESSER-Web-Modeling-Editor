/** The finished run card's "What changed" block and its Save to GitHub action. */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage, type SpecDrivenMessageState } from '../chat-message';

const RUN_ID = 'a'.repeat(32);

function doneCard(overrides: Partial<SpecDrivenMessageState> = {}): SpecDrivenMessageState {
  return {
    runId: RUN_ID,
    provider: 'free',
    model: 'qwen3-coder',
    phases: [],
    warnings: [],
    text: '',
    status: 'done',
    fileName: 'app.zip',
    isZip: true,
    needsDownload: true,
    ...overrides,
  };
}

const renderCard = (specDriven: SpecDrivenMessageState, onPushToGithub?: (runId: string) => void) =>
  render(
    <ChatMessage id="m1" role="assistant" content="" specDriven={specDriven} isStreaming={false} onPushToGithub={onPushToGithub} />,
  );

afterEach(cleanup);

describe('run card — what changed', () => {
  it('lists the model changes and the changed files of an update run', () => {
    renderCard(doneCard({
      runMode: 'modify',
      modelChanges: ['Added class Review', 'Book: added attribute rating'],
      changedFiles: ['a.py', 'b.py', 'c.py', 'd.py', 'e.py', 'f.py'],
      changedFileCount: 6,
    }));

    const summary = within(screen.getByRole('region', { name: 'What changed' }));
    expect(summary.getByText('Added class Review')).toBeTruthy();
    expect(summary.getByText('Book: added attribute rating')).toBeTruthy();
    expect(summary.getByText(/6 files changed/)).toBeTruthy();
    expect(summary.queryByText('e.py')).toBeNull();

    fireEvent.click(summary.getByRole('button', { name: 'Show all 6' }));
    expect(summary.getByText('f.py')).toBeTruthy();
  });

  it('says the model is unchanged when only code changed', () => {
    renderCard(doneCard({ runMode: 'modify', modelChanges: [], changedFiles: ['app.py'], changedFileCount: 1 }));
    const summary = within(screen.getByRole('region', { name: 'What changed' }));
    expect(summary.getByText(/unchanged/)).toBeTruthy();
    expect(summary.getByText(/1 file changed/)).toBeTruthy();
  });

  it('shows no change summary for a run that created a new app', () => {
    renderCard(doneCard({ runMode: 'create', changedFiles: ['app.py'], changedFileCount: 1 }));
    expect(screen.queryByRole('region', { name: 'What changed' })).toBeNull();
  });

  it('offers Save to GitHub on a finished run', () => {
    const push = vi.fn();
    renderCard(doneCard({ runMode: 'modify' }), push);
    fireEvent.click(screen.getByRole('button', { name: /Save to GitHub/ }));
    expect(push).toHaveBeenCalledWith(RUN_ID);
  });
});
