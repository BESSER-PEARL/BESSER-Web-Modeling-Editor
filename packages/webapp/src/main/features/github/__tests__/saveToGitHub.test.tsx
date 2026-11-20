/**
 * Live 2026-11-20 on experimental: "save to github" in the chat opened Deploy
 * to Render, and a web app generated from the Generate menu had no way to
 * GitHub (the user went through the GitHub settings and help looking for one).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OPEN_GITHUB_PANEL_EVENT, OPEN_GITHUB_SAVE_EVENT } from '../../../shared/api/github';
import { setProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import { writeProjectLastRun } from '../../../shared/services/storage/specDrivenRunRecords';
import { openPushDialog } from '../../spec-driven';
import { offerGeneratedCodeOnGitHub, openSaveToGitHub } from '../saveToGitHub';

const auth = vi.hoisted(() => ({ status: 'signed-out', session: null as string | null }));
vi.mock('../../../shared/services/github/githubAuth', () => ({
  getGitHubAuthState: () => ({ status: auth.status }),
  getGitHubSession: () => auth.session,
}));
const config = vi.hoisted(() => ({ value: null as { download_ttl_seconds: number } | null }));
vi.mock('../../../shared/services/specDrivenConfig', () => ({ peekServerSpecDrivenConfig: () => config.value }));
const storeGeneratedCodeForPush = vi.hoisted(() => vi.fn(async () => 'f'.repeat(32) as string | null));
vi.mock('../../../shared/services/github/saveGeneratedCode', () => ({ storeGeneratedCodeForPush }));
const dispatch = vi.hoisted(() => vi.fn());
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
const info = vi.hoisted(() => vi.fn());
vi.mock('react-toastify', () => ({ toast: { info } }));

const RUN = 'a'.repeat(32);
const events: string[] = [];
const record = (event: Event) => events.push(event.type);

beforeEach(() => {
  localStorage.clear();
  auth.status = 'signed-out';
  auth.session = null;
  config.value = null;
  events.length = 0;
  dispatch.mockClear();
  info.mockClear();
  storeGeneratedCodeForPush.mockClear();
  window.addEventListener(OPEN_GITHUB_SAVE_EVENT, record);
  window.addEventListener(OPEN_GITHUB_PANEL_EVENT, record);
});
afterEach(() => {
  window.removeEventListener(OPEN_GITHUB_SAVE_EVENT, record);
  window.removeEventListener(OPEN_GITHUB_PANEL_EVENT, record);
});

describe('openSaveToGitHub (the chat\'s "save to github")', () => {
  it('opens the push dialog of the app the project just generated', () => {
    config.value = { download_ttl_seconds: 3600 };
    writeProjectLastRun('p1', RUN, Date.now() - 60_000);

    openSaveToGitHub(dispatch, 'p1');

    expect(dispatch).toHaveBeenCalledWith(openPushDialog(RUN));
    expect(events).toEqual([]);
  });

  it('saves the model when the last run\'s code is gone from the server', () => {
    config.value = { download_ttl_seconds: 3600 };
    writeProjectLastRun('p1', RUN, Date.now() - 2 * 3600_000);
    auth.status = 'signed-in';
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'quiz', branch: 'main' });

    openSaveToGitHub(dispatch, 'p1');

    expect(dispatch).not.toHaveBeenCalled();
    expect(events).toEqual([OPEN_GITHUB_SAVE_EVENT]);
  });

  it('opens the GitHub menu (sign-in or linking) when the model cannot be saved yet', () => {
    openSaveToGitHub(dispatch, 'p1');
    auth.status = 'signed-in';
    openSaveToGitHub(dispatch, 'p1');

    expect(events).toEqual([OPEN_GITHUB_PANEL_EVENT, OPEN_GITHUB_PANEL_EVENT]);
  });
});

describe('offerGeneratedCodeOnGitHub (after the Generate menu)', () => {
  const zip = new Blob(['PK'], { type: 'application/zip' });

  it('offers nothing without a GitHub session in the tab', () => {
    offerGeneratedCodeOnGitHub(zip, 'web_app.zip');
    expect(info).not.toHaveBeenCalled();
  });

  it('offers Save to GitHub, which stores the file and opens the push dialog', async () => {
    auth.session = 'session';
    offerGeneratedCodeOnGitHub(zip, 'web_app.zip');
    expect(info).toHaveBeenCalledTimes(1);

    const closeToast = vi.fn();
    const content = info.mock.calls[0][0] as React.ReactElement<{ closeToast?: () => void }>;
    render(React.cloneElement(content, { closeToast }));
    fireEvent.click(screen.getByRole('button', { name: /save to github/i }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(openPushDialog('f'.repeat(32))));
    expect(storeGeneratedCodeForPush).toHaveBeenCalledWith(zip, 'web_app.zip');
    expect(closeToast).toHaveBeenCalled();
  });
});
