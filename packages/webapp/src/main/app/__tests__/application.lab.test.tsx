import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGitHubAuthForTests } from '../../shared/services/github/githubAuth';
import { RoutedApplication } from '../application';

// vitest defines no `process.env.LAB_BUILD`, so the build flag is set here per test.
const build = vi.hoisted(() => ({ lab: false }));
vi.mock('../../shared/constants/constant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/constants/constant')>();
  return {
    ...actual,
    get LAB_BUILD() {
      return build.lab;
    },
  };
});

// Records whether the lab chunk was ever imported; the real module otherwise.
const labChunk = vi.hoisted(() => ({ loaded: false }));
vi.mock('../../features/lab/LabApplication', async (importOriginal) => {
  labChunk.loaded = true;
  return importOriginal();
});

// The public shell, spied on so the test sees it render; the real component.
vi.mock('../shell/WorkspaceShell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/WorkspaceShell')>();
  return { ...actual, WorkspaceShell: vi.fn(actual.WorkspaceShell) };
});

vi.mock('../../shared/services/labConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/services/labConfig')>()),
  resolveLabEnabled: vi.fn(async () => true),
}));

const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
const requestedUrls = () => fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));

beforeEach(() => {
  resetGitHubAuthForTests();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the application root', () => {
  it('renders the public WorkspaceShell when LAB_BUILD is false, and never loads the lab or calls a lab route', async () => {
    build.lab = false;
    const { WorkspaceShell } = await import('../shell/WorkspaceShell');
    render(<RoutedApplication />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(WorkspaceShell).toHaveBeenCalled();
    expect(screen.queryByText('Sign in with GitHub')).not.toBeInTheDocument();
    expect(labChunk.loaded).toBe(false);
    expect(requestedUrls().filter((url) => /\/lab(\/|\?|$)/.test(url))).toEqual([]);
  });

  it('renders the lab application instead when LAB_BUILD is true: without a session, the sign-in', async () => {
    build.lab = true;
    const { WorkspaceShell } = await import('../shell/WorkspaceShell');
    vi.mocked(WorkspaceShell).mockClear();
    render(<RoutedApplication />);

    expect(await screen.findByRole('button', { name: 'Sign in with GitHub' }, { timeout: 5000 })).toBeInTheDocument();
    expect(labChunk.loaded).toBe(true);
    expect(WorkspaceShell).not.toHaveBeenCalled();
  });
});
