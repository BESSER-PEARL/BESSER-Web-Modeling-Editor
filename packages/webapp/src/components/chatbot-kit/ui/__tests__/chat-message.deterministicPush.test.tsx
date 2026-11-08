/**
 * A deterministic run's card (e.g. the SQL generator's) offers "Save to
 * GitHub" like a Spec-Driven run's: it stores the file as a run, then opens
 * the push dialog for it (BESSER-PEARL/BESSER#748).
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import type { SpecDrivenMessageState } from '@/main/features/spec-driven/types';

vi.mock('@/main/shared/services/github/saveGeneratedCode', () => ({
  storeGeneratedCodeForPush: vi.fn(),
}));

import { storeGeneratedCodeForPush } from '@/main/shared/services/github/saveGeneratedCode';

const RUN_ID = 'c'.repeat(32);
const SQL = new Blob(['CREATE TABLE book (id INTEGER);\n'], { type: 'application/sql' });

/** The card `useAssistantLogic` adds after a `trigger_generator` reply. */
const deterministicCard = (overrides: Partial<SpecDrivenMessageState> = {}): SpecDrivenMessageState => ({
  status: 'done',
  phases: [{ phase: 'generate', label: 'Generated deterministically', message: '', toolCalls: [] }],
  warnings: [],
  text: '',
  generatorUsed: 'sql',
  fileName: 'library.sql',
  deterministic: true,
  deterministicBlob: SQL,
  ...overrides,
});

const renderCard = (specDriven: SpecDrivenMessageState, onPushToGithub?: (runId: string) => void) =>
  render(
    <ChatMessage
      id="m1"
      role="assistant"
      content=""
      specDriven={specDriven}
      onPushToGithub={onPushToGithub}
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Deterministic run card — Save to GitHub', () => {
  it('stores the generated file as a run and opens the push dialog for it', async () => {
    vi.mocked(storeGeneratedCodeForPush).mockResolvedValue(RUN_ID);
    const onPushToGithub = vi.fn();
    renderCard(deterministicCard(), onPushToGithub);

    fireEvent.click(screen.getByRole('button', { name: /save to github/i }));

    await waitFor(() => expect(onPushToGithub).toHaveBeenCalledWith(RUN_ID));
    expect(storeGeneratedCodeForPush).toHaveBeenCalledWith(SQL, 'library.sql');
  });

  it('opens no dialog when the file could not be stored', async () => {
    vi.mocked(storeGeneratedCodeForPush).mockResolvedValue(null);
    const onPushToGithub = vi.fn();
    renderCard(deterministicCard(), onPushToGithub);

    const button = screen.getByRole('button', { name: /save to github/i });
    fireEvent.click(button);

    await waitFor(() => expect(storeGeneratedCodeForPush).toHaveBeenCalled());
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(onPushToGithub).not.toHaveBeenCalled();
  });

  it('offers no save once the file is gone, after a reload', () => {
    renderCard(deterministicCard({ deterministicBlob: undefined }), vi.fn());
    expect(screen.queryByRole('button', { name: /save to github/i })).toBeNull();
  });

  it('offers no save on a surface that cannot push', () => {
    renderCard(deterministicCard());
    expect(screen.queryByRole('button', { name: /save to github/i })).toBeNull();
  });
});
