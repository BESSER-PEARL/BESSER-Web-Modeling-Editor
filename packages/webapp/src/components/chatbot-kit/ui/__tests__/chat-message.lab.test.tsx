/**
 * The finished run card of a BESSER Lab run: the plan, or the change with its checks and checklist; and the lab's
 * other chat messages: a teammate's message under their login, a notice, and the review card.
 */

import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import { LabRunResult } from '../lab-run-result';
import { store } from '@/main/app/store/store';
import {
  applySpecDrivenEvent,
  extractLabRun,
  liveRunEnded,
  liveRunStarted,
} from '@/main/features/spec-driven/state/specDrivenSlice';
import type { SpecDrivenEvent, SpecDrivenLabView, SpecDrivenMessageState } from '@/main/features/spec-driven/types';
import type { LabReviewResponse } from '@/main/shared/api/lab';
import { requestLabView } from '@/main/shared/services/labSession';

vi.mock('@/main/shared/services/labSession', () => ({ requestLabView: vi.fn() }));

const RUN_ID = 'b'.repeat(32);

/** A `done` event's `lab` payload as the HTTP contract states it. */
const BUILD_PAYLOAD = {
  step: 'build',
  changeId: 'c1',
  title: 'Add a note element',
  kind: 'editor_element',
  plan: null,
  modelProposal: null,
  repoChanges: [
    {
      repo: 'frontend',
      branch: 'lab/jordi/note-element',
      base: 'develop',
      files: [
        { path: 'packages/editor/src/main/packages/components.ts', status: 'modified' },
        { path: 'packages/editor/src/main/packages/uml-class-diagram/note/note.ts', status: 'added' },
      ],
    },
    {
      repo: 'besser',
      branch: 'lab/jordi/note-element',
      base: 'development',
      files: [{ path: 'besser/old.py', status: 'deleted' }],
    },
  ],
  checks: [
    { id: 'frontend:vitest', repo: 'frontend', title: 'Tests of the touched areas', passed: true, skipped: false, summary: '12 passed' },
    { id: 'frontend:lint', repo: 'frontend', title: 'Lint', passed: false, skipped: false, summary: '2 errors in note.ts' },
    { id: 'frontend:i18n', repo: 'frontend', title: 'Translations', passed: false, skipped: true, summary: 'no tests found for x' },
  ],
  checklist: [
    { id: 'editor_element.components', text: 'Registered in components.ts', done: true },
    { id: 'editor_element.popups', text: 'Registered in popups.ts', done: false },
    { id: 'every.i18n', text: 'New strings in webapp.json', done: null },
  ],
  summary: 'frontend: 2 files',
  stopReason: 'completed',
};

const PLAN_PAYLOAD = {
  step: 'plan',
  changeId: 'c2',
  title: 'Add a TOML generator',
  kind: 'generator',
  plan: {
    kind: 'generator',
    title: 'Add a TOML generator',
    summary: 'A deterministic generator that writes the class diagram as TOML.',
    steps: ['Create besser/generators/toml', 'Register it in registry.py'],
    repos: ['besser'],
    questions: ['Should enumerations become TOML tables?'],
  },
  modelProposal: { title: 'TOML', diagramType: 'ClassDiagram', model: { elements: {} } },
  repoChanges: [],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
};

const startCard = (): SpecDrivenMessageState => ({ phases: [], warnings: [], text: '', status: 'running', runId: RUN_ID });

/** A card after the backend's `done` event, through the real reducer. */
function cardAfterDone(lab: unknown): SpecDrivenMessageState {
  const done = {
    event: 'done',
    runId: RUN_ID,
    downloadUrl: '',
    fileName: '',
    isZip: false,
    recipe: {},
    mode: 'modify',
    changedFiles: ['frontend/packages/editor/src/main/packages/components.ts'],
    changedFileCount: 1,
    lab,
  } as unknown as SpecDrivenEvent;
  return applySpecDrivenEvent(startCard(), done);
}

const renderCard = (specDriven: SpecDrivenMessageState, onPushToGithub?: (runId: string) => void) =>
  render(
    <ChatMessage id="m1" role="assistant" content="" specDriven={specDriven} isStreaming={false} onPushToGithub={onPushToGithub} />,
  );

afterEach(cleanup);

describe('lab payload on the card state', () => {
  it('keeps the plan or change and leaves the proposed model out of the chat history', () => {
    const lab = cardAfterDone(PLAN_PAYLOAD).lab;
    expect(lab?.step).toBe('plan');
    expect(lab?.plan?.questions).toEqual(['Should enumerations become TOML tables?']);
    expect(lab).not.toHaveProperty('modelProposal');
  });

  it('drops malformed entries instead of rendering them', () => {
    const lab = extractLabRun({
      ...BUILD_PAYLOAD,
      repoChanges: [{ repo: 'besser', branch: 'b', base: 'development', files: [{ status: 'added' }, null, { path: 'a.py', status: 'added' }] }, { files: [] }],
      checks: [{ id: 'x', passed: true }, 'nope'],
      checklist: [{ id: 'y', text: 'Docs page', done: 'yes' }],
    }) as SpecDrivenLabView;
    expect(lab.repoChanges).toEqual([{ repo: 'besser', branch: 'b', base: 'development', files: [{ path: 'a.py', status: 'added' }] }]);
    expect(lab.checks).toEqual([]);
    expect(lab.checklist).toEqual([{ id: 'y', text: 'Docs page', done: null }]);
  });

  it('marks nothing as a lab run when the done event carries no lab payload', () => {
    expect(cardAfterDone(undefined).lab).toBeUndefined();
    // The backend sends `"lab": null` on every ordinary Spec-Driven run's done event.
    expect(cardAfterDone(null).lab).toBeUndefined();
    expect(extractLabRun({ step: 'deploy' })).toBeUndefined();
  });
});

describe('lab run card: plan', () => {
  it('shows the summary, the steps and the open questions', async () => {
    renderCard(cardAfterDone(PLAN_PAYLOAD));
    // The card's lab module loads on demand, so the public main chunk does not carry it.
    expect(await screen.findByText('Plan ready')).toBeTruthy();
    const plan = within(screen.getByRole('region', { name: 'Plan' }));
    expect(plan.getByText(/writes the class diagram as TOML/)).toBeTruthy();
    expect(plan.getByText('Register it in registry.py')).toBeTruthy();
    expect(plan.getByText('Should enumerations become TOML tables?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open pull request/ })).toBeNull();
  });

  it('renders the plan summary, steps and questions as Markdown (E2E A-5)', () => {
    const plan = {
      ...PLAN_PAYLOAD.plan,
      summary: 'Adds a `glossary` package with **Term** and `Relation`.',
      steps: ['Create `besser/BUML/metamodel/glossary/glossary.py`'],
      questions: ['Should `Term` extend **Element**?'],
    };
    renderCard(cardAfterDone({ ...PLAN_PAYLOAD, plan }));
    const region = screen.getByRole('region', { name: 'Plan' });
    expect(region.textContent).not.toContain('`');
    expect(region.textContent).not.toContain('**');
    expect(within(region).getByText('glossary').tagName).toBe('CODE');
    expect(within(region).getByText('besser/BUML/metamodel/glossary/glossary.py').tagName).toBe('CODE');
    expect(within(region).getByText('Element').tagName).toBe('STRONG');
  });

  it('says planning stopped when the model never submitted a plan', () => {
    renderCard(cardAfterDone({ ...PLAN_PAYLOAD, plan: null, stopReason: 'cost_cap' }));
    expect(screen.getByText('Planning stopped early')).toBeTruthy();
  });

  it('shows a plan step that ended with a question as a question to answer, not as a stop', () => {
    // session.py: no submit_plan and a completed loop is "often a question back to the user".
    const question = { ...PLAN_PAYLOAD, changeId: '', plan: null, modelProposal: null, summary: 'Which file format: TOML or YAML?' };
    renderCard(cardAfterDone(question));
    expect(screen.getByText('The lab agent has a question')).toBeTruthy();
    expect(screen.queryByText('Planning stopped early')).toBeNull();
    expect(screen.getByText('Which file format: TOML or YAML?')).toBeTruthy();
    expect(screen.getByText(/Reply to answer it/)).toBeTruthy();
  });

  it('offers "Build this plan" for the card\'s change, and says a reply revises the plan', () => {
    const onBuildPlan = vi.fn();
    render(
      <Provider store={store}>
        <LabRunResult lab={extractLabRun(PLAN_PAYLOAD) as SpecDrivenLabView} onBuildPlan={onBuildPlan} />
      </Provider>,
    );
    expect(screen.getByText(/the lab agent revises the plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Build this plan/ }));
    expect(onBuildPlan).toHaveBeenCalledWith('c2');
  });

  it('disables "Build this plan" while a run is in flight', () => {
    const onBuildPlan = vi.fn();
    store.dispatch(liveRunStarted({ key: 'another-run', isLabRun: true }));
    try {
      render(
        <Provider store={store}>
          <LabRunResult lab={extractLabRun(PLAN_PAYLOAD) as SpecDrivenLabView} onBuildPlan={onBuildPlan} />
        </Provider>,
      );
      const button = screen.getByRole('button', { name: /Build this plan/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(onBuildPlan).not.toHaveBeenCalled();
    } finally {
      act(() => {
        store.dispatch(liveRunEnded({ key: 'another-run' }));
      });
    }
    expect((screen.getByRole('button', { name: /Build this plan/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('has no "Build this plan" without a handler (an older card) or without a plan', () => {
    render(<LabRunResult lab={extractLabRun(PLAN_PAYLOAD) as SpecDrivenLabView} />);
    expect(screen.queryByRole('button', { name: /Build this plan/ })).toBeNull();
    cleanup();
    render(<LabRunResult lab={extractLabRun({ ...PLAN_PAYLOAD, plan: null }) as SpecDrivenLabView} onBuildPlan={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Build this plan/ })).toBeNull();
  });

  it('shows a plan that touches no repository as an answer, with nothing to build (E2E C-D4)', () => {
    // The lab agent found the request already met: the session started no change and no branch.
    const payload = {
      ...PLAN_PAYLOAD,
      changeId: '',
      plan: { ...PLAN_PAYLOAD.plan, steps: [], repos: [], questions: [], summary: 'The docstring already says this.' },
      modelProposal: null,
    };
    renderCard(cardAfterDone(payload));
    expect(screen.getByText('No change needed')).toBeTruthy();
    expect(screen.getByText(/No change was started and no branch was created/)).toBeTruthy();
    expect(screen.queryByText(/the lab agent revises the plan/)).toBeNull();
    cleanup();
    render(
      <Provider store={store}>
        <LabRunResult lab={extractLabRun(payload) as SpecDrivenLabView} onBuildPlan={vi.fn()} />
      </Provider>,
    );
    expect(screen.queryByRole('button', { name: /Build this plan/ })).toBeNull();
  });
});

describe('lab run card: header', () => {
  const inRouter = (_path: string, payload: unknown) =>
    render(<LabRunResult lab={extractLabRun(payload) as SpecDrivenLabView} />);

  it.each([
    ['plan', PLAN_PAYLOAD],
    ['build', BUILD_PAYLOAD],
  ])('names the change of a %s card, with no link to the phase 1 lab page', (_step, payload) => {
    inRouter('/', payload);
    expect(screen.getByText((payload as { title: string }).title)).toBeTruthy();
    // Phase 1's "/lab" page is gone: the card is inside its change's own view.
    expect(screen.queryByRole('link', { name: /Manage changes/ })).toBeNull();
  });

  it('names the lab branch of the change, on a plan card too (E2E A, where am I)', () => {
    const planOnBranches = {
      ...PLAN_PAYLOAD,
      repoChanges: [
        { repo: 'besser', branch: 'lab/jordi/toml-generator', base: 'development', files: [] },
        { repo: 'frontend', branch: 'lab/jordi/toml-generator', base: 'develop', files: [] },
      ],
    };
    inRouter('/', planOnBranches);
    expect(screen.getByText('lab/jordi/toml-generator')).toBeTruthy();
    cleanup();
    // Repositories on different branches: each repository's row names its own, so the header does not.
    const mixed = {
      ...PLAN_PAYLOAD,
      repoChanges: [
        { repo: 'besser', branch: 'lab/jordi/a', base: 'development', files: [] },
        { repo: 'frontend', branch: 'lab/jordi/b', base: 'develop', files: [] },
      ],
    };
    inRouter('/', mixed);
    expect(screen.queryByText('lab/jordi/a')).toBeNull();
  });

  it('names BESSER Forge on a finished lab card, and not on a Spec-Driven one (E2E A, where am I)', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    expect(screen.getByText(/BESSER Forge/)).toBeTruthy();
    cleanup();
    renderCard(cardAfterDone(undefined));
    expect(screen.queryByText(/BESSER Forge/)).toBeNull();
  });

  it('names the change kind in words, as the lab page does', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    expect(screen.getByText('editor element')).toBeTruthy();
    expect(screen.queryByText('editor_element')).toBeNull();
  });

  it('says why a run stopped early: a cost cap is not a time limit', () => {
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, stopReason: 'cost_cap' }));
    expect(screen.getByRole('status').textContent).toMatch(/reached its cost cap/);
    cleanup();
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, stopReason: 'timeout' }));
    expect(screen.getByRole('status').textContent).toMatch(/reached its time limit/);
    cleanup();
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('names BESSER Forge, not the Spec-Driven Agent, while a lab run streams', () => {
    renderCard({ phases: [], warnings: [], text: '', status: 'running', runId: RUN_ID, isLabRun: true });
    expect(screen.getByText('BESSER Forge')).toBeTruthy();
    expect(screen.queryByText('Spec-Driven Agent')).toBeNull();
    cleanup();
    renderCard({ phases: [], warnings: [], text: '', status: 'running', runId: RUN_ID });
    expect(screen.getByText('Spec-Driven Agent')).toBeTruthy();
  });
});

describe('lab run card: build', () => {
  it('groups the changed files by repository with their status', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    const files = within(screen.getByRole('region', { name: 'Changed files' }));
    expect(files.getByText('Web editor')).toBeTruthy();
    expect(files.getByText('BESSER')).toBeTruthy();
    expect(files.getByText(/lab\/jordi\/note-element → develop$/)).toBeTruthy();
    const added = files.getByText('packages/editor/src/main/packages/uml-class-diagram/note/note.ts');
    expect(added.parentElement?.textContent).toMatch(/^added/);
    expect(files.getByText('besser/old.py').parentElement?.textContent).toMatch(/^deleted/);
  });

  it('shows each check as passed, failed or skipped, and titles the card by the failure', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    expect(screen.getByText('Change built, checks failing')).toBeTruthy();
    const checks = within(screen.getByRole('region', { name: 'Checks' }));
    expect(checks.getAllByRole('img', { name: 'Passed' })).toHaveLength(1);
    expect(checks.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
    expect(checks.getAllByRole('img', { name: 'Skipped' })).toHaveLength(1);
    expect(checks.getByText('2 errors in note.ts')).toBeTruthy();
  });

  it('shows the checklist, including rules that could not be judged', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD));
    const list = within(screen.getByRole('region', { name: 'Checklist' }));
    expect(list.getByText('Registered in popups.ts')).toBeTruthy();
    expect(list.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
    expect(list.getAllByRole('img', { name: 'Missing' })).toHaveLength(1);
    expect(list.getAllByRole('img', { name: 'Could not be judged from the files' })).toHaveLength(1);
  });

  it('titles a clean build as built', () => {
    const allPass = { ...BUILD_PAYLOAD, checks: [BUILD_PAYLOAD.checks[0], BUILD_PAYLOAD.checks[2]] };
    renderCard(cardAfterDone(allPass));
    expect(screen.getByText('Change built')).toBeTruthy();
  });

  it('titles a build without changes and one the loop cut short', () => {
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, repoChanges: [] }));
    expect(screen.getByText('Build finished without changes')).toBeTruthy();
    cleanup();
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, stopReason: 'max_turns' }));
    expect(screen.getByText('Build stopped early')).toBeTruthy();
  });

  it("shows the agent's own account above the files, rendered as Markdown (E2E A-5)", () => {
    // The account as run bbecb66a sent it: bold headings, bullets and code spans.
    const finalText = '**What it contains**\n- **`RelationType`:** BROADER_THAN and RELATED_TO\n- Registered in <b>components.ts</b>.';
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, finalText }));
    const account = screen.getByRole('region', { name: "In the lab agent's words" });
    expect(account.textContent).not.toContain('**');
    expect(account.textContent).not.toContain('`');
    expect(within(account).getByText('What it contains').tagName).toBe('STRONG');
    expect(within(account).getByText('RelationType').tagName).toBe('CODE');
    expect(account.querySelectorAll('li')).toHaveLength(2);
    // The model's text is never parsed as HTML.
    expect(account.querySelector('b')).toBeNull();
    const files = screen.getByRole('region', { name: 'Changed files' });
    expect(account.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows how long each check took when the API sends it, and nothing when it does not (E2E B)', () => {
    const lab = extractLabRun(BUILD_PAYLOAD) as SpecDrivenLabView;
    // `durationSeconds` is read defensively: older backends do not send it.
    const timed = {
      ...lab,
      checks: [
        { ...lab.checks[0], durationSeconds: 52.7 },
        { ...lab.checks[1], durationSeconds: 0.24 },
        { ...lab.checks[2], durationSeconds: 3 },
        { ...lab.checks[0], id: 'besser:docs', title: 'Documentation build', durationSeconds: 109.6 },
        { ...lab.checks[0], id: 'besser:odd', title: 'Odd value', durationSeconds: 'soon' },
      ],
    } as unknown as SpecDrivenLabView;
    render(<LabRunResult lab={timed} />);
    const checks = within(screen.getByRole('region', { name: 'Checks' }));
    expect(checks.getByText('Tests of the touched areas').parentElement?.textContent).toContain('· 53s');
    expect(checks.getByText('Lint').parentElement?.textContent).toContain('· 0.2s');
    expect(checks.getByText('Documentation build').parentElement?.textContent).toContain('· 1m 50s');
    // A skipped check did not run, and a malformed value is left out.
    expect(checks.getByText('Translations').parentElement?.textContent).not.toMatch(/\d+(\.\d)?s/);
    expect(checks.getByText('Odd value').parentElement?.textContent).not.toMatch(/\d+(\.\d)?s/);
    cleanup();
    render(<LabRunResult lab={lab} />);
    expect(within(screen.getByRole('region', { name: 'Checks' })).queryByText(/\d+(\.\d)?s$/)).toBeNull();
  });

  it("keeps the server's check durations on the card through the done event (E2E B)", () => {
    const checks = [
      { ...BUILD_PAYLOAD.checks[0], durationSeconds: 52.7 },
      { ...BUILD_PAYLOAD.checks[1], durationSeconds: -1 },
      BUILD_PAYLOAD.checks[2],
    ];
    const card = cardAfterDone({ ...BUILD_PAYLOAD, checks });
    expect(card.lab?.checks.map((c) => c.durationSeconds)).toEqual([52.7, undefined, undefined]);
    renderCard(card);
    const shown = within(screen.getByRole('region', { name: 'Checks' }));
    expect(shown.getByText('Tests of the touched areas').parentElement?.textContent).toContain('· 53s');
  });

  it('shows the checks a cancelled build ran, under why it stopped (E2E C-D3)', () => {
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, stopReason: 'cancelled' }));
    expect(screen.getByText('Build stopped early')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/It was stopped/);
    const checks = within(screen.getByRole('region', { name: 'Checks' }));
    expect(checks.getByText('Tests of the touched areas')).toBeTruthy();
    expect(checks.getByText('2 errors in note.ts')).toBeTruthy();
  });

  it("shows no account when the agent's final text is empty", () => {
    renderCard(cardAfterDone({ ...BUILD_PAYLOAD, finalText: '  \n' }));
    expect(screen.queryByRole('region', { name: "In the lab agent's words" })).toBeNull();
    expect(cardAfterDone(BUILD_PAYLOAD).lab?.finalText).toBe('');
  });

  it('hides the application parts of the done card', () => {
    renderCard(cardAfterDone(BUILD_PAYLOAD), vi.fn());
    expect(screen.queryByText('Application ready')).toBeNull();
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /View files/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save to GitHub/ })).toBeNull();
    // The done event is `mode: "modify"` for the card's sake; the app's "What changed" block stays out.
    expect(screen.queryByRole('region', { name: 'What changed' })).toBeNull();
  });
});

describe('Push to the pull requests', () => {
  const build = (payload: unknown) => extractLabRun(payload) as SpecDrivenLabView;
  const pushed = {
    report: null,
    cost: { usd: 0.5, turns: 4, elapsedSeconds: 30, runs: 1 },
    pullRequests: [{ repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/jordi/note-element', base: 'develop' }],
    noteProposals: [],
    planVersion: null,
  };

  it('calls the handler once until it settles', async () => {
    let settle: () => void = () => undefined;
    const open = vi.fn(() => new Promise<void>((resolve) => { settle = resolve; }));
    render(<LabRunResult lab={build(BUILD_PAYLOAD)} details={pushed} onOpenPullRequest={open} />);
    const button = screen.getByRole('button', { name: /Push to the pull requests/ }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(open).toHaveBeenCalledTimes(1);
    // The card's own change.
    expect(open).toHaveBeenCalledWith('c1');
    expect(button.disabled).toBe(true);
    await act(async () => settle());
    expect(button.disabled).toBe(false);
  });

  it('is hidden, with Open pull request, when the build changed no files', () => {
    render(<LabRunResult lab={build({ ...BUILD_PAYLOAD, repoChanges: [] })} details={pushed} onOpenPullRequest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /pull request/ })).toBeNull();
    expect(screen.getByText('No files changed.')).toBeTruthy();
  });

  it('is hidden, with Open pull request, when the surface supplies no handler', () => {
    render(<LabRunResult lab={build(BUILD_PAYLOAD)} details={pushed} />);
    expect(screen.queryByRole('button', { name: /pull request/ })).toBeNull();
  });
});

describe("a change's thread in the chat", () => {
  it("puts a teammate's message on the left under their login, and the user's own on the right", () => {
    render(<ChatMessage id="m1" role="user" content="Also give it a colour" sender={{ login: 'ana', self: false }} />);
    const own = render(<ChatMessage id="m2" role="user" content="Add a note" sender={{ login: 'jordi', self: true }} />);
    const [teammate] = screen.getAllByText('Also give it a colour');
    expect(teammate.closest('.items-start')).not.toBeNull();
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(within(own.container).getByText('Add a note').closest('.items-end')).not.toBeNull();
  });

  it('shows a notice as a centred line for every viewer', () => {
    render(<ChatMessage id="n1" role="assistant" content="The change was merged; the lab closed it." isNotice />);
    expect(screen.getByRole('note').textContent).toBe('The change was merged; the lab closed it.');
  });

  it("passes the run's details to its card: the report and the change's cost", () => {
    render(
      <ChatMessage
        id="m1"
        role="assistant"
        content=""
        specDriven={cardAfterDone(BUILD_PAYLOAD)}
        labRun={{
          report: { summary: 'Added the note element.', deviations: [], notDone: ['Docs page'] },
          cost: { usd: 2.5, turns: 30, elapsedSeconds: 200, runs: 2 },
          pullRequests: [],
          noteProposals: [],
          planVersion: null,
        }}
      />,
    );
    expect(screen.getByText('Added the note element.')).toBeTruthy();
    expect(screen.getByText('Docs page')).toBeTruthy();
    expect(screen.getByText('This change so far: $2.50 over 2 runs')).toBeTruthy();
  });
});

describe('the review card in the chat', () => {
  const REVIEW: LabReviewResponse = {
    changeId: 'c1',
    pullRequests: [
      {
        repo: 'frontend',
        number: 41,
        url: 'https://github.com/o/editor/pull/41',
        draft: true,
        headSha: 'a'.repeat(40),
        state: 'open',
        pushedSha: 'a'.repeat(40),
        mergeable: 'mergeable',
        mergeState: 'clean',
        reviewDecision: null,
        checksState: 'failure',
        checks: [{ name: 'Lint', app: 'github-actions', state: 'failure', url: null, logTail: 'error x', logNote: '' }],
        reviews: [],
        comments: [],
      },
    ],
    lifecycle: 'open',
    closable: false,
    closableNote: '',
    nextPollSeconds: 30,
    fetchedAt: 0,
  };

  it("renders the change's review status, and its actions go to the surface's handler with the change", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ChatMessage id="r1" role="assistant" content="" labReview={{ changeId: 'c1', review: REVIEW }} onLabReviewAction={onAction} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Fix CI/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('c1', { kind: 'fixCi', repo: 'frontend' }));
    fireEvent.click(screen.getByRole('button', { name: /View changes/ }));
    await waitFor(() => expect(requestLabView).toHaveBeenCalledWith({ kind: 'changes', changeId: 'c1' }));
  });

  it('offers no action without a handler', async () => {
    render(<ChatMessage id="r1" role="assistant" content="" labReview={{ changeId: 'c1', review: REVIEW }} />);
    expect(await screen.findByRole('button', { name: /View changes/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fix CI/ })).toBeNull();
  });
});
