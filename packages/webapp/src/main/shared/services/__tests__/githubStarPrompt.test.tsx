/**
 * The GitHub star prompt after a first successful generation.
 *
 * It must appear at most once per browser, never for someone already known to
 * have starred, and a broken `localStorage` must neither throw nor turn it
 * into a prompt on every generation.
 */
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';

import { markGitHubStarPromptDone, promptForGitHubStarOnce } from '../githubStarPrompt';

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn() },
}));

const storageFailure = () => {
  throw new DOMException('Storage disabled', 'SecurityError');
};

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('promptForGitHubStarOnce', () => {
  it('shows a longer-lived toast with a link to the BESSER repo', () => {
    promptForGitHubStarOnce();

    expect(toast.info).toHaveBeenCalledTimes(1);
    const [content, options] = vi.mocked(toast.info).mock.calls[0];
    expect(options).toMatchObject({ autoClose: 10000 });

    render(content as ReactElement);
    expect(screen.getByText(/Your code is ready/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Star on GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/BESSER-PEARL/BESSER');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('is shown only once per browser', () => {
    promptForGitHubStarOnce();
    promptForGitHubStarOnce();
    promptForGitHubStarOnce();

    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('is not shown to a user already known to have starred', () => {
    markGitHubStarPromptDone();
    promptForGitHubStarOnce();

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('is skipped when localStorage cannot be read', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(storageFailure);

    expect(() => promptForGitHubStarOnce()).not.toThrow();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('is skipped when the flag cannot be written, so it never repeats', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(storageFailure);

    expect(() => promptForGitHubStarOnce()).not.toThrow();
    expect(() => markGitHubStarPromptDone()).not.toThrow();
    expect(toast.info).not.toHaveBeenCalled();
  });
});
