/**
 * A finished run's download is served for the archive lifetime and it can be
 * pushed to GitHub for the workspace lifetime (an older backend has only the
 * second, which then covers both). The card says until when, and once the
 * download is gone (by the clock, or because a fetch came back "unknown or
 * expired") it says so at once, stops offering actions that cannot work and
 * offers to generate again.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import type { SpecDrivenMessageState } from '@/main/features/spec-driven/types';
import { ApiError } from '@/main/shared/api/api-client';
import { downloadSpecDrivenOutput } from '@/main/shared/api/specDriven';
import { markSpecDrivenRunExpired } from '@/main/shared/utils/specDrivenExpiry';

const lifetimes = vi.hoisted(() => ({
  archive: undefined as number | undefined,
  /** How the config load ends: the server's values, the fallback after a failure, or not yet. */
  load: 'server' as 'server' | 'failed' | 'pending',
}));

vi.mock('@/main/shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/main/shared/services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() =>
      lifetimes.load === 'pending'
        ? new Promise(() => {})
        : Promise.resolve(
            lifetimes.load === 'failed'
              ? mod.FALLBACK_SMART_GEN_CONFIG
              : {
                  ...mod.FALLBACK_SMART_GEN_CONFIG,
                  download_ttl_seconds: 3600,
                  ...(lifetimes.archive ? { archive_ttl_seconds: lifetimes.archive } : {}),
                },
          ),
    ),
  };
});

vi.mock('@/main/shared/api/specDriven', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/main/shared/api/specDriven')>();
  return { ...mod, downloadSpecDrivenOutput: vi.fn() };
});

const HOUR = 3_600_000;

const fmt = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    ...(new Date(at).toDateString() === new Date().toDateString() ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  });
let nextRun = 0;
// Expiry is remembered per run id for the tab, so each test gets its own.
const freshRunId = () => (++nextRun).toString(16).padStart(32, '0');

function finished(runId: string, finishedAt: number): SpecDrivenMessageState {
  return {
    runId,
    phases: [],
    warnings: [],
    text: '',
    status: 'done',
    needsDownload: true,
    fileName: 'app.zip',
    isZip: true,
    finishedAt,
  };
}

const renderCard = async (specDriven: SpecDrivenMessageState, onGenerateAgain?: () => void) => {
  render(
    <ChatMessage
      id="m1"
      role="assistant"
      content=""
      specDriven={specDriven}
      onPushToGithub={() => {}}
      onGenerateAgain={onGenerateAgain}
    />,
  );
  // Let the server's lifetime (1 hour here) replace the fallback.
  await act(async () => {});
};

const offersNothingToFetch = () => {
  expect(screen.queryByRole('button', { name: /^download$/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /view files/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /save to github/i })).toBeNull();
};

beforeEach(() => {
  vi.mocked(downloadSpecDrivenOutput).mockReset();
  lifetimes.archive = undefined;
  lifetimes.load = 'server';
});

afterEach(() => {
  cleanup();
});

describe('a finished run card', () => {
  it('says until when the files are kept', async () => {
    const finishedAt = Date.now() - 10 * 60_000;
    await renderCard(finished(freshRunId(), finishedAt));

    expect(
      screen.getByText(`Available until ${fmt(finishedAt + HOUR)}: download or save to GitHub before then.`),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^download$/i })).toBeTruthy();
  });

  it('is expired once the lifetime has passed, before any click', async () => {
    const onGenerateAgain = vi.fn();
    await renderCard(finished(freshRunId(), Date.now() - 2 * HOUR), onGenerateAgain);

    expect(
      screen.getByText(
        'This result is no longer available: generated files are kept for 1 hour. Generate again to get a new copy.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/available until/i)).toBeNull();
    offersNothingToFetch();

    fireEvent.click(screen.getByRole('button', { name: 'Generate again' }));
    expect(onGenerateAgain).toHaveBeenCalledTimes(1);
  });

  it('shows the expired state at the first failed download and stops offering it', async () => {
    vi.mocked(downloadSpecDrivenOutput).mockRejectedValue(new ApiError(404, 'Unknown or expired run ID'));
    // A card with no finish time (older conversation) only learns it from the server.
    const card = { ...finished(freshRunId(), 0), finishedAt: undefined };
    await renderCard(card, () => {});

    fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

    await waitFor(() => expect(screen.getByText(/no longer available/)).toBeTruthy());
    expect(downloadSpecDrivenOutput).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/retry failed/i)).toBeNull();
    offersNothingToFetch();
  });

  it('turns expired when another fetch of the run found it gone', async () => {
    const runId = freshRunId();
    await renderCard(finished(runId, Date.now()));
    expect(screen.getByRole('button', { name: /save to github/i })).toBeTruthy();

    act(() => markSpecDrivenRunExpired(runId));

    expect(screen.getByText(/no longer available/)).toBeTruthy();
    offersNothingToFetch();
  });

  it('keeps a failed download that is not an expiry retryable', async () => {
    vi.mocked(downloadSpecDrivenOutput).mockRejectedValue(new ApiError(500, 'Server error'));
    await renderCard(finished(freshRunId(), Date.now()));

    fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

    await waitFor(() => expect(screen.getByText(/retry failed/i)).toBeTruthy());
    expect(screen.queryByText(/no longer available/)).toBeNull();
    expect(screen.getByRole('button', { name: /^download$/i })).toBeTruthy();
  });
});

describe('a finished run card with a longer archive than workspace', () => {
  beforeEach(() => {
    lifetimes.archive = 3 * 3600;
  });

  it('gives both deadlines while both still hold', async () => {
    const finishedAt = Date.now() - 30 * 60_000;
    await renderCard(finished(freshRunId(), finishedAt));
    expect(
      screen.getByText(
        `Download available until ${fmt(finishedAt + 3 * HOUR)}; save to GitHub until ${fmt(finishedAt + HOUR)}.`,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /save to github/i })).toBeTruthy();
  });

  it('keeps offering the download after the workspace is gone, without Save to GitHub', async () => {
    const finishedAt = Date.now() - 2 * HOUR;
    await renderCard(finished(freshRunId(), finishedAt));
    expect(screen.getByText(`Download available until ${fmt(finishedAt + 3 * HOUR)}.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^download$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save to github/i })).toBeNull();
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });

  it('is expired only once the archive lifetime has passed', async () => {
    await renderCard(finished(freshRunId(), Date.now() - 4 * HOUR), () => {});
    expect(
      screen.getByText(
        'This result is no longer available: generated files are kept for 3 hours. Generate again to get a new copy.',
      ),
    ).toBeTruthy();
    offersNothingToFetch();
  });
});

describe('a finished run card while the server lifetimes are unknown', () => {
  it.each(['failed', 'pending'] as const)(
    'keeps every action and expires nothing by the clock when the config load is %s',
    async (load) => {
      lifetimes.load = load;
      await renderCard(finished(freshRunId(), Date.now() - 2 * HOUR), () => {});
      expect(screen.queryByText(/no longer available/)).toBeNull();
      expect(screen.queryByText(/available until/i)).toBeNull();
      expect(screen.getByRole('button', { name: /^download$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /save to github/i })).toBeTruthy();
    },
  );

  it('turns expired when the download finds the run gone, without naming a lifetime', async () => {
    lifetimes.load = 'failed';
    vi.mocked(downloadSpecDrivenOutput).mockRejectedValue(new ApiError(404, 'Unknown or expired run ID'));
    await renderCard(finished(freshRunId(), Date.now() - 2 * HOUR), () => {});

    fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

    await waitFor(() =>
      expect(
        screen.getByText('This result is no longer available on the server. Generate again to get a new copy.'),
      ).toBeTruthy(),
    );
    offersNothingToFetch();
  });
});
