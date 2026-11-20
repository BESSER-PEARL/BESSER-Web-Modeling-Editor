import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGitHubAuthForTests } from '../../../shared/services/github/githubAuth';
import { reportError } from '../../../shared/services/errors/reportError';
import { LabAuthGate } from '../LabAuthGate';
import { LabRefused, takeLabRefusal } from '../LabRefused';

vi.mock('../../../shared/services/labConfig', () => ({ resolveLabEnabled: vi.fn(async () => true) }));
vi.mock('../../../shared/services/errors/reportError', () => ({ reportError: vi.fn(), notifyError: vi.fn() }));

const go = (url: string) => window.history.replaceState(null, '', url);

beforeEach(() => {
  resetGitHubAuthForTests();
  vi.mocked(reportError).mockClear();
});
afterEach(() => {
  cleanup();
  go('/');
});

describe('the sign-in refusal', () => {
  it("shows the refused login and clears it from the address bar", () => {
    go('/?error=not_allowed#login=x');
    render(<LabAuthGate>{null}</LabAuthGate>);

    expect(screen.getByText(/@x is not on this lab's list of GitHub logins/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This lab is for the BESSER team' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    // Not reported as a failed sign-in: the refusal was read before the GitHub sign-in started.
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reads nothing from an address that is not a refusal and leaves it alone', () => {
    go('/c/0123456789ab?tab=try#x=1');
    expect(takeLabRefusal()).toBeNull();
    expect(window.location.search).toBe('?tab=try');
    expect(window.location.hash).toBe('#x=1');
  });

  it('drops a fragment that is not a GitHub login', () => {
    go('/?error=not_allowed#login=%3Cscript%3E');
    expect(takeLabRefusal()).toEqual({ login: null });
    render(<LabRefused login={null} />);
    expect(screen.getByText(/Your GitHub login is not on this lab's list/)).toBeInTheDocument();
  });

  it('offers a sign-in with the account chooser and the public editor', () => {
    render(<LabRefused login="x" />);
    expect(screen.getByRole('button', { name: /Sign in with another account/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the public editor/ })).toHaveAttribute(
      'href',
      'https://editor.besser-pearl.org',
    );
  });
});
