/**
 * The team notes a build proposes, on its run card (D3 K8): approve sends the text as the user edited it, with the
 * proposal it comes from; dismiss drops it; a refusal stays on the proposal.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/api-client';
import { createLabNote, dismissLabNoteProposal, type LabNoteProposal } from '../../../shared/api/lab';

const auth = vi.hoisted(() => ({ session: 'gh-session-0123456789' as string | null }));

vi.mock('../../../shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/github/githubAuth')>()),
  getGitHubSession: () => auth.session,
}));

vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  createLabNote: vi.fn(),
  dismissLabNoteProposal: vi.fn(),
}));

import { LabNoteProposals } from '../LabNoteProposals';

const CHANGE = '0123456789ab';
const PROPOSAL: LabNoteProposal = {
  id: 'p1',
  kind: 'convention',
  title: 'Register elements in components.ts',
  body: 'Every new element needs a row in components.ts.',
  repos: ['frontend', 'not-a-repo'],
  changeKinds: ['editor_element'],
  docsTarget: 'docs/source/contributing/new-diagram-guide.rst',
  why: 'The build forgot it twice.',
};

beforeEach(() => {
  auth.session = 'gh-session-0123456789';
  vi.mocked(createLabNote).mockResolvedValue({} as never);
  vi.mocked(dismissLabNoteProposal).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LabNoteProposals', () => {
  it('keeps a proposal with the edited text, naming the proposal it comes from', async () => {
    render(<LabNoteProposals changeId={CHANGE} proposals={[PROPOSAL]} />);
    expect(screen.getByText('Why: The build forgot it twice.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Register every element in components.ts.' } });
    fireEvent.click(screen.getByRole('button', { name: /Keep as a team note/ }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Kept as a team note/));
    expect(createLabNote).toHaveBeenCalledWith('gh-session-0123456789', {
      kind: 'convention',
      title: 'Register elements in components.ts',
      body: 'Register every element in components.ts.',
      repos: ['frontend'],
      changeKinds: ['editor_element'],
      docsTarget: 'docs/source/contributing/new-diagram-guide.rst',
      fromProposal: { changeId: CHANGE, id: 'p1' },
    });
    expect(dismissLabNoteProposal).not.toHaveBeenCalled();
  });

  it('dismisses a proposal', async () => {
    render(<LabNoteProposals changeId={CHANGE} proposals={[PROPOSAL]} />);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Dismissed/));
    expect(dismissLabNoteProposal).toHaveBeenCalledWith('gh-session-0123456789', { changeId: CHANGE, id: 'p1' });
    expect(createLabNote).not.toHaveBeenCalled();
  });

  it("shows the server's refusal on the proposal and keeps it to try again", async () => {
    vi.mocked(createLabNote).mockRejectedValueOnce(new ApiError(409, 'Team memory is off on this lab.'));
    render(<LabNoteProposals changeId={CHANGE} proposals={[PROPOSAL]} />);
    fireEvent.click(screen.getByRole('button', { name: /Keep as a team note/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Team memory is off on this lab.'));
    expect((screen.getByRole('button', { name: /Keep as a team note/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('cannot keep a note whose text was emptied', () => {
    render(<LabNoteProposals changeId={CHANGE} proposals={[PROPOSAL]} />);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: /Keep as a team note/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks to sign in instead of sending without a session', async () => {
    auth.session = null;
    render(<LabNoteProposals changeId={CHANGE} proposals={[PROPOSAL]} />);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/Sign in with GitHub/);
    expect(dismissLabNoteProposal).not.toHaveBeenCalled();
  });
});
