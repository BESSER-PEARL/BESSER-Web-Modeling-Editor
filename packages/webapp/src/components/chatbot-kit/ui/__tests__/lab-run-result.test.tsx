/**
 * The run card's phase 2 parts (D2 WP7, D3 K8, R20, R21): the build report, the change's cost, the plan version,
 * the views it asks the change view for (View changes, Try it, Open pull request) through `requestLabView`,
 * "Push to the pull requests" once the change has pull requests, and the note proposals.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extractLabRun } from '@/main/features/spec-driven/state/specDrivenSlice';
import type { SpecDrivenLabView } from '@/main/features/spec-driven/types';
import { requestLabView } from '@/main/shared/services/labSession';

vi.mock('@/main/shared/services/labSession', () => ({ requestLabView: vi.fn() }));

const { LabRunResult } = await import('../lab-run-result');
type Details = NonNullable<React.ComponentProps<typeof LabRunResult>['details']>;

const CHANGE = '0123456789ab';

const BUILD = extractLabRun({
  step: 'build',
  changeId: CHANGE,
  title: 'Note element',
  kind: 'editor_element',
  repoChanges: [
    { repo: 'frontend', branch: 'lab/ana/note', base: 'develop', files: [{ path: 'packages/editor/x.ts', status: 'modified' }] },
  ],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
  finalText: 'Free text the report replaces.',
}) as SpecDrivenLabView;

const PLAN = extractLabRun({
  step: 'plan',
  changeId: CHANGE,
  title: 'Note element',
  kind: 'editor_element',
  plan: { kind: 'editor_element', title: 'Note element', summary: 'Add it.', steps: ['Register it'], repos: ['frontend'], questions: [] },
  repoChanges: [],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
}) as SpecDrivenLabView;

const details = (extra: Partial<Details> = {}): Details => ({
  report: null,
  cost: { usd: 1.82, turns: 40, elapsedSeconds: 300, runs: 3 },
  pullRequests: [],
  noteProposals: [],
  planVersion: null,
  ...extra,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the build report and the cost', () => {
  it("shows the agent's report (summary, departures, not done) instead of its free text, and the change's cost", () => {
    render(
      <LabRunResult
        lab={BUILD}
        details={details({
          report: { summary: 'Added the **Note** element.', deviations: ['Kept the old icon'], notDone: ['Docs page'] },
        })}
      />,
    );
    const report = screen.getByRole('region', { name: "In the lab agent's words" });
    expect(report.textContent).toContain('Added the Note element.');
    expect(within(report).getByText('Departures from the plan')).toBeTruthy();
    expect(within(report).getByText('Kept the old icon')).toBeTruthy();
    expect(within(report).getByText('Not done')).toBeTruthy();
    expect(within(report).getByText('Docs page')).toBeTruthy();
    expect(screen.queryByText('Free text the report replaces.')).toBeNull();
    expect(screen.getByText('This change so far: $1.82 over 3 runs')).toBeTruthy();
  });

  it('keeps the free text when the agent gave no report, and shows no cost for a card saved without it', () => {
    render(<LabRunResult lab={BUILD} />);
    expect(screen.getByText('Free text the report replaces.')).toBeTruthy();
    expect(screen.queryByText(/This change so far/)).toBeNull();
  });
});

describe('the plan version', () => {
  it('names a revised plan "Plan v2", and the first plan nothing', () => {
    const { rerender } = render(<LabRunResult lab={PLAN} details={details({ planVersion: 2 })} />);
    expect(screen.getByText('Plan v2')).toBeTruthy();
    rerender(<LabRunResult lab={PLAN} details={details({ planVersion: 1 })} />);
    expect(screen.queryByText(/Plan v/)).toBeNull();
  });
});

describe('what the card asks the change view for', () => {
  it('asks for the changes and for Try it, for the card change', async () => {
    render(<LabRunResult lab={BUILD} details={details()} />);
    fireEvent.click(screen.getByRole('button', { name: /View changes/ }));
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }));
    await waitFor(() => expect(requestLabView).toHaveBeenCalledTimes(2));
    expect(vi.mocked(requestLabView).mock.calls.map(([request]) => request)).toEqual([
      { kind: 'changes', changeId: CHANGE },
      { kind: 'tryIt', changeId: CHANGE },
    ]);
  });

  it('opens the pull-request dialog of the change view while the change has no pull request', async () => {
    const push = vi.fn();
    render(<LabRunResult lab={BUILD} details={details()} onOpenPullRequest={push} />);
    expect(screen.queryByRole('button', { name: /Push to the pull requests/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open pull request/ }));
    await waitFor(() => expect(requestLabView).toHaveBeenCalledWith({ kind: 'pullRequest', changeId: CHANGE }), { timeout: 5000 });
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes to the pull requests through the handler once the change has them', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    render(
      <LabRunResult
        lab={BUILD}
        details={details({
          pullRequests: [{ repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/ana/note', base: 'develop' }],
        })}
        onOpenPullRequest={push}
      />,
    );
    expect(screen.queryByRole('button', { name: /Open pull request/ })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Push to the pull requests/ }));
    });
    expect(push).toHaveBeenCalledWith(CHANGE);
    expect(requestLabView).not.toHaveBeenCalled();
  });

  it('offers none of them on a plan', () => {
    render(<LabRunResult lab={PLAN} details={details()} onOpenPullRequest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /View changes|Try it|pull request/ })).toBeNull();
  });
});

describe('note proposals', () => {
  it("lists the build's proposals on the card", async () => {
    render(
      <LabRunResult
        lab={BUILD}
        details={details({
          noteProposals: [
            { id: 'p1', kind: 'mistake', title: 'Run the lint', body: 'Lint before pushing.', repos: [], changeKinds: [], docsTarget: '', why: '' },
          ],
        })}
      />,
    );
    const section = await screen.findByRole('region', { name: 'Team notes the lab agent proposes' });
    expect((within(section).getByDisplayValue('Run the lint') as HTMLInputElement).value).toBe('Run the lint');
    expect(within(section).getByRole('button', { name: /Keep as a team note/ })).toBeTruthy();
    expect(within(section).getByRole('button', { name: /Dismiss/ })).toBeTruthy();
  });
});
