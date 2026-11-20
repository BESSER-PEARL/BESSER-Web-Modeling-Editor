/**
 * Stop on a running BESSER Lab card (E2E C-D3): the server ends a lab run only once
 * its current step or check ends (33 s in run 4ffdab62), so the card says it is stopping,
 * and names a check it is interrupting. A Spec-Driven card is unchanged.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpecDrivenMessageState, SpecDrivenPhaseView } from '@/main/features/spec-driven/types';

const cancel = vi.hoisted(() =>
  vi.fn<(runId: string, options?: { githubSession?: string | null }) => Promise<boolean>>(),
);
vi.mock('@/main/shared/api/specDriven', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/shared/api/specDriven')>()),
  cancelSpecDrivenRun: cancel,
}));

const SESSION = 'gh-session-0123456789';
vi.mock('@/main/shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/shared/services/github/githubAuth')>()),
  getGitHubAuthState: () => ({ status: 'signed-in', username: 'jordi', session: SESSION, redirecting: false }),
}));

const { ChatMessage } = await import('../chat-message');

const RUN_ID = 'd'.repeat(32);

const phase = (name: string, message: string, toolCalls: SpecDrivenPhaseView['toolCalls'] = []): SpecDrivenPhaseView => ({
  phase: name,
  label: name === 'check' ? 'Running the checks' : 'Building the change',
  message,
  toolCalls,
});

const running = (phases: SpecDrivenPhaseView[], isLabRun = true): SpecDrivenMessageState => ({
  runId: RUN_ID,
  phases,
  warnings: [],
  text: '',
  status: 'running',
  elapsedSeconds: 27,
  isLabRun,
});

const renderCard = (card: SpecDrivenMessageState) =>
  render(<ChatMessage id="m1" role="assistant" content="" specDriven={card} isStreaming />);

const pressStop = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
  });
};

afterEach(() => {
  cleanup();
  cancel.mockReset();
});

describe('Stop on a running lab card', () => {
  it('says the run is stopping and names the check being interrupted', async () => {
    cancel.mockResolvedValue(true);
    // The model's run_checks: its executing call sits on the build row, each check opens a `check` row.
    renderCard(
      running([
        phase('build', 'Building the change', [{ turn: 7, tool: 'run_checks' }]),
        phase('check', 'Ruff (besser)'),
        phase('check', 'Tests of the touched areas (besser)'),
      ]),
    );
    await pressStop();
    // With the lab user's session: the lab's cancel route refuses a request without one (E2E C-D6).
    expect(cancel).toHaveBeenCalledWith(RUN_ID, { githubSession: SESSION });
    expect(screen.getByText('Stopping')).toBeTruthy();
    expect(screen.queryByText('Running')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(
      'Stopping. The running check, Tests of the touched areas (besser), is being interrupted.',
    );
  });

  it('says it stops after the current step when no check is running', async () => {
    cancel.mockResolvedValue(true);
    // run_checks returned (its done call landed on the last check row): no check is running.
    renderCard(
      running([
        phase('build', 'Building the change', [{ turn: 7, tool: 'run_checks' }]),
        phase('check', 'Ruff (besser)', [{ turn: 7, tool: 'run_checks' }]),
      ]),
    );
    await pressStop();
    expect(screen.getByText('Stopping')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Stopping. The lab agent stops once its current step ends.');
  });

  it('goes back to running when the server does not accept the stop', async () => {
    cancel.mockResolvedValue(false);
    renderCard(running([phase('build', 'Building the change')]));
    await pressStop();
    expect(screen.queryByText('Stopping')).toBeNull();
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('leaves a Spec-Driven card as it was', async () => {
    cancel.mockResolvedValue(true);
    renderCard(running([phase('check', 'Ruff (besser)')], false));
    await pressStop();
    // A Spec-Driven run's cancel is unchanged: no session.
    expect(cancel).toHaveBeenCalledWith(RUN_ID);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.queryByText(/is being interrupted/)).toBeNull();
    expect(screen.getByText('Working…')).toBeTruthy();
  });
});
