import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';
import { SPEC_DRIVEN_RUN_SUCCEEDED_EVENT } from '../../../spec-driven';
import { resetAutoPushedRunsForTests, useAutoPushFinishedRuns } from '../useAutoPushFinishedRuns';

const project = { id: 'p1', name: 'Library', diagrams: {} };
const loadProject = vi.fn(async () => undefined);
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project, loadProject }) }));
const dispatch = vi.fn();
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
const pushRunToRepo = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('../useSpecDrivenGithubPush', () => ({ pushRunToRepo }));
const info = vi.hoisted(() => vi.fn());
vi.mock('react-toastify', () => ({ toast: { info } }));

const finish = (runId: string, projectId = 'p1') =>
  act(() => {
    window.dispatchEvent(new CustomEvent(SPEC_DRIVEN_RUN_SUCCEEDED_EVENT, { detail: { projectId, runId } }));
  });

beforeEach(() => {
  localStorage.clear();
  resetAutoPushedRunsForTests();
  pushRunToRepo.mockClear();
  info.mockClear();
});
afterEach(() => localStorage.clear());

describe('useAutoPushFinishedRuns', () => {
  it('pushes a finished run to the linked repository and branch, once', () => {
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'quiz', branch: 'dev', pushRuns: true });
    renderHook(() => useAutoPushFinishedRuns({ githubSession: 'session' }));

    finish('run-1');
    finish('run-1');

    expect(pushRunToRepo).toHaveBeenCalledTimes(1);
    const [context, config] = pushRunToRepo.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(context).toMatchObject({ project, runId: 'run-1', githubSession: 'session', automatic: true });
    expect(context.linkedRepo).toMatchObject({ owner: 'ana', repo: 'quiz', branch: 'dev' });
    expect(config).toMatchObject({ useExisting: true, owner: 'ana', repoName: 'quiz', branch: 'dev', pushMode: 'commit' });
  });

  it('does nothing when the setting is off, or the run belongs to another project', () => {
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'quiz', branch: 'main' });
    setProjectGitHubLink('p2', { owner: 'ana', repo: 'other', branch: 'main', pushRuns: true });
    renderHook(() => useAutoPushFinishedRuns({ githubSession: 'session' }));

    finish('run-2');
    finish('run-3', 'p2');

    expect(pushRunToRepo).not.toHaveBeenCalled();
  });

  it('says so instead of pushing without a GitHub session in the tab, and pushes once signed in', () => {
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'quiz', branch: 'main', pushRuns: true });
    const { rerender } = renderHook(({ session }) => useAutoPushFinishedRuns({ githubSession: session }), {
      initialProps: { session: null as string | null },
    });

    finish('run-4');
    expect(pushRunToRepo).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/Connect GitHub/));

    rerender({ session: 'session' });
    finish('run-5');
    expect(pushRunToRepo).toHaveBeenCalledTimes(1);
  });
});
