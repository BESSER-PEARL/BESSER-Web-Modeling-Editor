/**
 * A change's thread as the chat shows it (D4 test 10, cards part): what each login said, a card per finished run
 * with its plan version, the pull requests and the notices; a run in progress is followed, not shown as a card.
 */
import { describe, expect, it } from 'vitest';

import type { LabDone, LabThreadItem } from '../../../shared/api/lab';
import { labRunInProgress, mergeThreadMessages, threadToMessages } from '../labThread';

const CHANGE = '0123456789ab';

const done = (step: 'plan' | 'build', extra: Partial<LabDone> = {}): LabDone => ({
  step,
  changeId: CHANGE,
  title: 'Note element',
  kind: 'editor_element',
  plan:
    step === 'plan'
      ? { kind: 'editor_element', title: 'Note element', summary: 'Add it.', steps: ['Register it'], repos: ['frontend'], questions: [] }
      : null,
  modelProposal: { title: 'Note', diagramType: 'ClassDiagram', model: { type: 'ClassDiagram' } },
  repoChanges: [],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
  finalText: '',
  report: null,
  pullRequests: [],
  cost: { usd: 1.2, turns: 10, elapsedSeconds: 60, runs: 2 },
  issues: [],
  noteProposals: [],
  ...extra,
});

const run = (runId: string, status: 'running' | 'done' | 'failed' | 'cancelled', lab: LabDone | null, planVersion: number | null, at: number): LabThreadItem => ({
  type: 'run',
  runId,
  at,
  login: 'ana',
  status,
  lab,
  error: status === 'failed' ? { code: 'API_ERROR', message: 'The provider failed.' } : null,
  costUsd: lab ? 0.6 : null,
  planVersion,
});

const THREAD: LabThreadItem[] = [
  { type: 'message', id: 'm1', at: 1000, login: 'jordi', text: 'Add a note element', action: 'auto', model: null },
  run('r1', 'done', done('plan'), 1, 1001),
  { type: 'message', id: 'm2', at: 1010, login: 'ana', text: 'Also give it a colour', action: 'plan', model: null },
  run('r2', 'done', done('plan'), 2, 1011),
  {
    type: 'pull_requests',
    at: 1020,
    login: 'ana',
    pullRequests: [{ repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/note', base: 'develop' }],
    checksNote: 'The quick checks passed.',
  },
  { type: 'notice', at: 1030, login: 'ana', text: 'development was merged into the change.' },
  run('r3', 'running', null, null, 1040),
];

describe('threadToMessages', () => {
  it('shows both senders, the plan versions, the pull requests and the notice, and no card for a running run', () => {
    const messages = threadToMessages(THREAD, 'ana');

    expect(messages.map((m) => m.id)).toEqual(['m1', 'run-r1', 'm2', 'run-r2', 'pull-requests-1020', 'notice-1030']);
    // Two logins: the viewer's own message and a teammate's.
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Add a note element', sender: { login: 'jordi', self: false } });
    expect(messages[2]).toMatchObject({ role: 'user', sender: { login: 'ana', self: true } });
    // A card per finished run, with its plan version; the proposed model stays out of the chat.
    expect(messages[1].specDriven).toMatchObject({ runId: 'r1', status: 'done', isLabRun: true, costUsd: 0.6 });
    expect(messages[1].specDriven?.lab?.plan?.steps).toEqual(['Register it']);
    expect(messages[1].specDriven?.lab).not.toHaveProperty('modelProposal');
    expect(messages[1].labRun?.planVersion).toBe(1);
    expect(messages[3].labRun).toMatchObject({ planVersion: 2, cost: { usd: 1.2, runs: 2 } });
    // The pull-request event, with who opened them.
    expect(messages[4].content).toBe(
      '@ana opened or updated the draft pull requests:\n' +
        '- [Web editor #41](https://github.com/o/editor/pull/41): `lab/note` into `develop`\n' +
        '\n' +
        'The quick checks passed.',
    );
    expect(messages[5]).toMatchObject({ isNotice: true, content: 'development was merged into the change.' });
    expect(messages[5].createdAt).toEqual(new Date(1_030_000));
  });

  it('says how a run without a result ended', () => {
    const messages = threadToMessages([run('f1', 'failed', null, null, 1), run('c1', 'cancelled', null, null, 2)], 'ana');
    expect(messages.map((m) => m.content)).toEqual([
      '❌ BESSER Bootstrapped error (API_ERROR): The provider failed.',
      '⏹ BESSER Bootstrapped run stopped by user.',
    ]);
    expect(messages[0].isError).toBe(true);
  });
});

describe('labRunInProgress', () => {
  it('names the running run, to be followed through its event log', () => {
    expect(labRunInProgress(THREAD)).toEqual({ runId: 'r3', login: 'ana', startedAt: 1_040_000 });
  });

  it('is null when the newest run has ended', () => {
    expect(labRunInProgress(THREAD.slice(0, -1))).toBeNull();
  });
});

describe('mergeThreadMessages', () => {
  it("keeps what this tab added that the thread lacks, and shows the thread's copy of the rest once", () => {
    const fromThread = threadToMessages(THREAD.slice(0, 2), 'jordi');
    const local = [
      { id: 'local-user', role: 'user', content: 'Add a note element', createdAt: new Date(999_000) },
      { id: 'local-card', role: 'assistant', content: '', createdAt: new Date(1_001_500), specDriven: { runId: 'r1', phases: [], warnings: [], text: '', status: 'done' as const } },
      { id: 'local-new', role: 'user', content: 'Build it', createdAt: new Date(2_000_000) },
    ];
    expect(mergeThreadMessages(fromThread, local).map((m) => m.id)).toEqual(['m1', 'run-r1', 'local-new']);
  });

  it('orders by time, so a review card posted earlier stays where it was', () => {
    const fromThread = threadToMessages(THREAD.slice(0, 4), 'ana');
    const review = { id: 'review', role: 'assistant', content: '', createdAt: new Date(1_005_000) };
    expect(mergeThreadMessages(fromThread, [review]).map((m) => m.id)).toEqual(['m1', 'run-r1', 'review', 'm2', 'run-r2']);
  });
});
