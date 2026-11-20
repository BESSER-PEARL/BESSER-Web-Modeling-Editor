import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import { openLabPullRequests, type LabIssue, type LabPullRequestsResponse } from '../../../shared/api/lab';
import { LabPullRequestDialog } from '../LabPullRequestDialog';

vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  openLabPullRequests: vi.fn(),
}));

const SESSION = 'gh-session-0123456789';
const ISSUES: LabIssue[] = [
  { repo: 'besser', number: 744, title: 'Glossary generator', closes: false },
  { repo: 'frontend', number: 12, title: 'Note element in class diagrams', closes: true },
];
const OPENED: LabPullRequestsResponse = {
  pullRequests: [{ repo: 'besser', number: 812, url: 'https://github.com/BESSER-PEARL/BESSER/pull/812', branch: 'lab/note', base: 'development' }],
  checksNote: '',
};

function renderDialog(issues = ISSUES) {
  const onOpened = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LabPullRequestDialog
      open
      onOpenChange={onOpenChange}
      githubSession={SESSION}
      changeId="c1"
      title="Note element"
      issues={issues}
      onOpened={onOpened}
    />,
  );
  return { onOpened, onOpenChange };
}

beforeEach(() => {
  // A function returned from beforeEach is a cleanup hook, so this one returns nothing.
  vi.mocked(openLabPullRequests).mockReset();
});
afterEach(cleanup);

describe('LabPullRequestDialog', () => {
  it("sends the ticked issues as closesIssues, with the plan's title by default", async () => {
    vi.mocked(openLabPullRequests).mockResolvedValue(OPENED);
    const { onOpened, onOpenChange } = renderDialog();
    expect(screen.getByLabelText('Title')).toHaveValue('Note element');
    // The stored tick is shown; the user ticks the other issue too.
    expect(screen.getByRole('checkbox', { name: /Web editor #12/ })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /BESSER #744/ }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Add a Note element' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open draft pull requests' }));
    });
    expect(openLabPullRequests).toHaveBeenCalledWith(SESSION, 'c1', {
      title: 'Add a Note element',
      closesIssues: [
        { repo: 'besser', number: 744 },
        { repo: 'frontend', number: 12 },
      ],
    });
    expect(onOpened).toHaveBeenCalledWith(OPENED);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends no issue the user unticked', async () => {
    vi.mocked(openLabPullRequests).mockResolvedValue(OPENED);
    renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Web editor #12/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open draft pull requests' }));
    });
    expect(vi.mocked(openLabPullRequests).mock.calls[0][2]).toMatchObject({ closesIssues: [] });
  });

  it('says that GitHub closes an issue at release, not at the merge into development', () => {
    renderDialog();
    expect(screen.getByTestId('lab-pull-request-release-note')).toHaveTextContent(
      'GitHub closes the issue when this reaches master/main (at release), not when it merges into development.',
    );
  });

  it('shows no issue section for a change without issues', () => {
    renderDialog([]);
    expect(screen.queryByTestId('lab-pull-request-release-note')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it("keeps the dialog open with the server's refusal in plain words", async () => {
    vi.mocked(openLabPullRequests).mockImplementation(async () => {
      throw new ApiError(409, 'The change has uncommitted conflict markers in besser.', 'The change has uncommitted conflict markers in besser.');
    });
    const { onOpened, onOpenChange } = renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open draft pull requests' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('The pull request was not opened.');
    expect(screen.getByRole('alert')).toHaveTextContent('The change has uncommitted conflict markers in besser.');
    expect(onOpened).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
