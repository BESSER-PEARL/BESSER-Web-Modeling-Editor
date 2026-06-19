/**
 * Tests for the SmartGenCard rendered by ChatMessage when a message
 * carries `smartGen` state.
 *
 * Covers:
 *   - Live cost meter strip ($spent / $budget · elapsed / max)
 *   - Amber emphasis when spend crosses 80% of the budget
 *   - Stop button while running: POSTs the cancel endpoint,
 *     independent of the chat's isGenerating flag
 *   - "Download again" on done cards (success AND downloadFailed),
 *     re-invoking the shared artifact download helper
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ChatMessage,
  type SmartGenMessageState,
} from '../chat-message';
import { cancelSmartGenUrl } from '@/main/shared/constants/constant';

// The card's "Download again" goes through the shared helper — mock it
// so jsdom never has to deal with URL.createObjectURL / anchor clicks.
vi.mock('@/main/shared/utils/smartGenDownload', () => ({
  fetchAndSaveSmartGenArtifact: vi.fn(() =>
    Promise.resolve({ ok: true, sizeBytes: 42 }),
  ),
}));

import { fetchAndSaveSmartGenArtifact } from '@/main/shared/utils/smartGenDownload';

const RUN_ID = 'f'.repeat(32);

function baseSmartGen(overrides: Partial<SmartGenMessageState> = {}): SmartGenMessageState {
  return {
    runId: RUN_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    phases: [
      { phase: 'generate', label: 'Running deterministic generator', message: '', toolCalls: [] },
    ],
    warnings: [],
    text: '',
    status: 'running',
    ...overrides,
  };
}

function renderCard(smartGen: SmartGenMessageState, isStreaming = smartGen.status === 'running') {
  return render(
    <ChatMessage
      id="m1"
      role="assistant"
      content=""
      smartGen={smartGen}
      isStreaming={isStreaming}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SmartGenCard — runtime meter', () => {
  it('renders elapsed / max runtime while running', () => {
    renderCard(
      baseSmartGen({
        costUsd: 0.42,
        elapsedSeconds: 190,
        maxCost: 2.0,
        maxRuntime: 600,
      }),
    );
    expect(screen.getByText(/3m 10s \/ 10m/)).toBeTruthy();
  });

  it('never renders a dollar amount (cost estimate is not user-facing)', () => {
    const { container } = renderCard(
      baseSmartGen({
        costUsd: 1.9,
        elapsedSeconds: 60,
        maxCost: 2.0,
        maxRuntime: 600,
      }),
    );
    expect(container.textContent).not.toContain('$');
  });

  it('renders the meter from elapsed time alone (no cost data)', () => {
    renderCard(
      baseSmartGen({
        elapsedSeconds: 45,
        maxRuntime: 600,
      }),
    );
    expect(screen.getByText(/45s \/ 10m/)).toBeTruthy();
  });
});

describe('SmartGenCard — Stop button', () => {
  it('POSTs the cancel endpoint for the run (fire-and-forget)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    globalThis.fetch = fetchMock;

    renderCard(baseSmartGen({ costUsd: 0.1, maxCost: 2.0 }));

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopBtn);

    expect(fetchMock).toHaveBeenCalledWith(cancelSmartGenUrl(RUN_ID), {
      method: 'POST',
    });
    // Button disables to prevent duplicate cancels while the backend
    // winds the stream down.
    await waitFor(() => {
      expect((screen.getByRole('button', { name: /stopping/i }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('is not rendered once the run is done', () => {
    renderCard(
      baseSmartGen({ status: 'done', fileName: 'out.zip', isZip: true, costUsd: 0.3, maxCost: 2.0 }),
      false,
    );
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull();
  });
});

describe('SmartGenCard — Download again', () => {
  it('re-invokes the shared artifact download helper on a done card', async () => {
    renderCard(
      baseSmartGen({
        status: 'done',
        fileName: 'besser_smart_output.zip',
        isZip: true,
        costUsd: 0.3,
        maxCost: 2.0,
      }),
      false,
    );

    const btn = screen.getByRole('button', { name: /download again/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(fetchAndSaveSmartGenArtifact).toHaveBeenCalledWith(
        RUN_ID,
        'besser_smart_output.zip',
        true,
      );
    });
  });

  it('renders the "file still available" note and the retry button when downloadFailed', () => {
    renderCard(
      baseSmartGen({
        status: 'done',
        downloadFailed: true,
        fileName: 'besser_smart_output.zip',
        isZip: true,
      }),
      false,
    );
    expect(screen.getByText(/still available/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /download again/i })).toBeTruthy();
  });

  it('shows a retry-failed hint when the re-download fails', async () => {
    vi.mocked(fetchAndSaveSmartGenArtifact).mockResolvedValueOnce({ ok: false });
    renderCard(
      baseSmartGen({
        status: 'done',
        downloadFailed: true,
        fileName: 'besser_smart_output.zip',
        isZip: true,
      }),
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: /download again/i }));

    await waitFor(() => {
      expect(screen.getByText(/retry failed/i)).toBeTruthy();
    });
  });

  it('is not rendered while the run is still streaming', () => {
    renderCard(baseSmartGen({ costUsd: 0.1, maxCost: 2.0 }));
    expect(screen.queryByRole('button', { name: /download again/i })).toBeNull();
  });
});
