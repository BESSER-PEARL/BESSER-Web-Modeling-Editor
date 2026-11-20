/**
 * The surface's pull-request handler ("Push to the pull requests") reaches a
 * lab build card through ChatMessage with the run's details, both on a finished
 * card and on a live one (which renders from the Redux slice). Before the change
 * has pull requests, "Open pull request" asks the change view for its dialog.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import { store } from '@/main/app/store/store';
import {
  applySpecDrivenEvent,
  liveRunEnded,
  liveRunEvent,
  liveRunStarted,
} from '@/main/features/spec-driven/state/specDrivenSlice';
import type { SpecDrivenEvent, SpecDrivenMessageState } from '@/main/features/spec-driven/types';
import type { LabRunDetails } from '../lab-run-result';
import { requestLabView } from '@/main/shared/services/labSession';

vi.mock('@/main/shared/services/labSession', () => ({ requestLabView: vi.fn() }));

const RUN_ID = 'c'.repeat(32);

const DONE = {
  event: 'done',
  runId: RUN_ID,
  downloadUrl: '',
  fileName: '',
  isZip: false,
  recipe: {},
  mode: 'modify',
  changedFiles: ['besser/besser/generators/toml/__init__.py'],
  changedFileCount: 1,
  lab: {
    step: 'build',
    changeId: '0123456789ab',
    title: 'Add a TOML generator',
    kind: 'generator',
    plan: null,
    modelProposal: null,
    repoChanges: [
      {
        repo: 'besser',
        branch: 'lab/jordi/toml-generator',
        base: 'development',
        files: [{ path: 'besser/generators/toml/__init__.py', status: 'added' }],
      },
    ],
    checks: [],
    checklist: [],
    summary: '',
    stopReason: 'completed',
  },
} as unknown as SpecDrivenEvent;

/** The change already has a pull request, so a later build is pushed to it. */
const PUSHED: LabRunDetails = {
  report: null,
  cost: { usd: 0.9, turns: 9, elapsedSeconds: 90, runs: 2 },
  pullRequests: [{ repo: 'besser', number: 7, url: 'https://github.com/o/besser/pull/7', branch: 'lab/jordi/toml-generator', base: 'development' }],
  noteProposals: [],
  planVersion: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Push to the pull requests on a lab build card', () => {
  it('calls the handler the surface passes to ChatMessage on a finished card', () => {
    const card = applySpecDrivenEvent({ phases: [], warnings: [], text: '', status: 'running', runId: RUN_ID }, DONE);
    const onOpenPullRequest = vi.fn();
    render(
      <ChatMessage id="m1" role="assistant" content="" specDriven={card} labRun={PUSHED} onOpenPullRequest={onOpenPullRequest} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Push to the pull requests/ }));
    expect(onOpenPullRequest).toHaveBeenCalledWith('0123456789ab');
  });

  it('calls it on a live card too', () => {
    const liveKey = 'live-lab-card';
    store.dispatch(liveRunStarted({ key: liveKey }));
    store.dispatch(liveRunEvent({ key: liveKey, event: DONE }));
    const stub: SpecDrivenMessageState = { liveKey, phases: [], warnings: [], text: '', status: 'running' };
    const onOpenPullRequest = vi.fn();
    try {
      render(
        <Provider store={store}>
          <ChatMessage id="m2" role="assistant" content="" specDriven={stub} labRun={PUSHED} onOpenPullRequest={onOpenPullRequest} />
        </Provider>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Push to the pull requests/ }));
      expect(onOpenPullRequest).toHaveBeenCalledWith('0123456789ab');
    } finally {
      store.dispatch(liveRunEnded({ key: liveKey }));
    }
  });
});

describe('Open pull request on a lab build card', () => {
  it('asks the change view for its pull-request dialog while the change has none', async () => {
    const card = applySpecDrivenEvent({ phases: [], warnings: [], text: '', status: 'running', runId: RUN_ID }, DONE);
    const onOpenPullRequest = vi.fn();
    render(
      <ChatMessage
        id="m3"
        role="assistant"
        content=""
        specDriven={card}
        labRun={{ ...PUSHED, pullRequests: [] }}
        onOpenPullRequest={onOpenPullRequest}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open pull request/ }));
    await waitFor(() => expect(requestLabView).toHaveBeenCalledWith({ kind: 'pullRequest', changeId: '0123456789ab' }));
    expect(onOpenPullRequest).not.toHaveBeenCalled();
  });
});
