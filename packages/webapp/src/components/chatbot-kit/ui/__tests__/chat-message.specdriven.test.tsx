/**
 * Tests for the SpecDrivenCard rendered by ChatMessage when a message
 * carries `specDriven` state.
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
  type SpecDrivenMessageState,
} from '../chat-message';
import { cancelSpecDrivenUrl } from '@/main/shared/constants/constant';

// The card's "Download again" goes through the shared helper — mock it
// so jsdom never has to deal with URL.createObjectURL / anchor clicks.
vi.mock('@/main/shared/utils/specDrivenDownload', () => ({
  fetchAndSaveSpecDrivenArtifact: vi.fn(() =>
    Promise.resolve({ ok: true, sizeBytes: 42 }),
  ),
}));

import { fetchAndSaveSpecDrivenArtifact } from '@/main/shared/utils/specDrivenDownload';

const RUN_ID = 'f'.repeat(32);

function baseSpecDriven(overrides: Partial<SpecDrivenMessageState> = {}): SpecDrivenMessageState {
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

function renderCard(specDriven: SpecDrivenMessageState, isStreaming = specDriven.status === 'running') {
  return render(
    <ChatMessage
      id="m1"
      role="assistant"
      content=""
      specDriven={specDriven}
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

describe('SpecDrivenCard — runtime meter', () => {
  it('renders elapsed / max runtime while running', () => {
    renderCard(
      baseSpecDriven({
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
      baseSpecDriven({
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
      baseSpecDriven({
        elapsedSeconds: 45,
        maxRuntime: 600,
      }),
    );
    expect(screen.getByText(/45s \/ 10m/)).toBeTruthy();
  });
});

describe('SpecDrivenCard — Stop button', () => {
  it('POSTs the cancel endpoint for the run (fire-and-forget)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    globalThis.fetch = fetchMock;

    renderCard(baseSpecDriven({ costUsd: 0.1, maxCost: 2.0 }));

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopBtn);

    expect(fetchMock).toHaveBeenCalledWith(cancelSpecDrivenUrl(RUN_ID), {
      method: 'POST',
    });
    // Button disables to prevent duplicate cancels while the backend
    // winds the stream down.
    await waitFor(() => {
      expect((screen.getByRole('button', { name: /stopping/i }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('re-enables Stop when the cancel request is rejected', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));

    renderCard(baseSpecDriven());
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: /^stop$/i });
      expect((stopButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('is not rendered once the run is done', () => {
    renderCard(
      baseSpecDriven({ status: 'done', fileName: 'out.zip', isZip: true, costUsd: 0.3, maxCost: 2.0 }),
      false,
    );
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull();
  });
});

describe('SpecDrivenCard — Download again', () => {
  it('re-invokes the shared artifact download helper on a done card', async () => {
    renderCard(
      baseSpecDriven({
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
      expect(fetchAndSaveSpecDrivenArtifact).toHaveBeenCalledWith(
        RUN_ID,
        'besser_smart_output.zip',
        true,
      );
    });
  });

  it('renders the "file still available" note and the retry button when downloadFailed', () => {
    renderCard(
      baseSpecDriven({
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
    vi.mocked(fetchAndSaveSpecDrivenArtifact).mockResolvedValueOnce({ ok: false });
    renderCard(
      baseSpecDriven({
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
    renderCard(baseSpecDriven({ costUsd: 0.1, maxCost: 2.0 }));
    expect(screen.queryByRole('button', { name: /download again/i })).toBeNull();
  });

  it('shows a primary "Download" button (not yet saved) when needsDownload is set', () => {
    renderCard(
      baseSpecDriven({
        status: 'done',
        needsDownload: true,
        fileName: 'besser_smart_output.zip',
        isZip: true,
      }),
      false,
    );
    // Before the first save the label is "Download", not "Download again".
    expect(screen.getByRole('button', { name: /^download$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /download again/i })).toBeNull();
  });

  it('switches the label to "Download again" after a successful first save', async () => {
    renderCard(
      baseSpecDriven({
        status: 'done',
        needsDownload: true,
        fileName: 'besser_smart_output.zip',
        isZip: true,
      }),
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

    await waitFor(() => {
      expect(fetchAndSaveSpecDrivenArtifact).toHaveBeenCalledWith(
        RUN_ID,
        'besser_smart_output.zip',
        true,
      );
    });
    // The save succeeded (mock resolves ok) → button becomes "Download again".
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download again/i })).toBeTruthy();
    });
  });
});

describe('SpecDrivenCard — notice severities', () => {
  it('renders an info-severity notice without alarm styling (no amber, no code prefix)', () => {
    const { container } = renderCard(
      baseSpecDriven({
        warnings: [
          {
            code: 'INCOMPLETE',
            message:
              'The previous generation has expired, so there is nothing to edit — rebuilding from scratch instead.',
            severity: 'info',
          },
        ],
      }),
    );
    expect(container.textContent).toContain('rebuilding from scratch');
    // The machine code is a tooltip, not visible copy.
    expect(container.textContent).not.toContain('INCOMPLETE');
    const row = container.querySelector('[title="INCOMPLETE"]');
    expect(row).toBeTruthy();
    expect(row!.className).not.toContain('amber');
    expect(row!.className).not.toContain('red');
  });

  it('renders warning severity in amber and error severity in red', () => {
    const { container } = renderCard(
      baseSpecDriven({
        status: 'error',
        warnings: [
          { code: 'TIMEOUT', message: 'Runtime cap reached.', severity: 'warning' },
          { code: 'UPSTREAM_LLM', message: 'Provider unavailable.', severity: 'error' },
        ],
      }),
      false,
    );
    const warningRow = container.querySelector('[title="TIMEOUT"]');
    const errorRow = container.querySelector('[title="UPSTREAM_LLM"]');
    expect(warningRow!.className).toContain('amber');
    expect(errorRow!.className).toContain('red');
  });

  it('defaults to warning styling when severity is absent (older producers)', () => {
    const { container } = renderCard(
      baseSpecDriven({
        warnings: [{ code: 'TIMEOUT', message: 'Runtime cap reached.' }],
      }),
    );
    const row = container.querySelector('[title="TIMEOUT"]');
    expect(row!.className).toContain('amber');
  });

  it('keeps notices visible on the compact done card', () => {
    const { container } = renderCard(
      baseSpecDriven({
        status: 'done',
        needsDownload: true,
        fileName: 'besser_smart_output.zip',
        isZip: true,
        warnings: [
          { code: 'INCOMPLETE', message: 'Two issues remain unresolved.', severity: 'warning' },
        ],
      }),
      false,
    );
    expect(container.textContent).toContain('Two issues remain unresolved.');
    expect(container.querySelector('[title="INCOMPLETE"]')!.className).toContain('amber');
  });
});
