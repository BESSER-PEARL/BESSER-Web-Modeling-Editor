/**
 * The run card's verification report — the UI that tells the user what the
 * delivered app actually enforces.
 *
 * A run can pass its checks and still deliver an app that does not enforce
 * some requested rules (e.g. OCL constraints that failed conversion); a single
 * blocker count hides which ones. These tests lock three properties:
 *
 *   1. `shippedUnenforced` is rendered expanded, with no interaction, and
 *      the card's headline stops claiming the app is ready.
 *   2. Counts come from `counts` (the true totals), not the capped lists.
 *   3. An absent `verification` degrades to the pre-existing summary.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import { extractVerification } from '@/main/features/spec-driven/state/specDrivenSlice';
import type { SpecDrivenMessageState } from '@/main/features/spec-driven/types';

// The card imports the shared download helper; mock it so jsdom never deals
// with URL.createObjectURL / anchor clicks.
vi.mock('@/main/shared/utils/specDrivenDownload', () => ({
  fetchAndSaveSpecDrivenArtifact: vi.fn(() =>
    Promise.resolve({ ok: true, sizeBytes: 42 }),
  ),
}));

afterEach(() => {
  cleanup();
});

const OCL_WHY =
  "the OCL converter rejected it (unsupported allInstances() on Booking), so it never reached the generated code; nothing checked whether it was re-implemented";

const doneCard = (
  verification?: SpecDrivenMessageState['verification'],
): SpecDrivenMessageState => ({
  runId: 'b'.repeat(32),
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  phases: [],
  warnings: [],
  text: '',
  status: 'done',
  fileName: 'app.zip',
  isZip: true,
  needsDownload: true,
  verification,
});

/** No liveKey => the card renders its own snapshot, no store needed. */
const renderCard = (card: SpecDrivenMessageState) =>
  render(<ChatMessage id="m1" role="assistant" content="" specDriven={card} />);

describe('run card — shippedUnenforced is the headline', () => {
  const unenforced: SpecDrivenMessageState['verification'] = {
    verified: [],
    notVerified: [],
    shippedUnenforced: [
      {
        kind: 'ocl_constraint',
        id: 'noDoubleBooking',
        what: "OCL invariant 'noDoubleBooking' on Booking: self.room.bookings->forAll(b | b.period->excludes(self.period))",
        why: OCL_WHY,
      },
      {
        kind: 'ocl_constraint',
        id: 'capacityRespected',
        what: "OCL invariant 'capacityRespected' on Room",
        why: 'the OCL converter rejected it (parse error), so it never reached the generated code',
      },
    ],
    counts: { verified: 0, notVerified: 0, shippedUnenforced: 2 },
  };

  it('renders every unenforced rule expanded, with no interaction', () => {
    renderCard(doneCard(unenforced));

    expect(
      screen.getByText(/Delivered, but 2 rules you asked for are not enforced/i),
    ).toBeTruthy();
    // Each rule shows up twice: as its id chip and inside `what`.
    expect(screen.getAllByText(/noDoubleBooking/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capacityRespected/).length).toBeGreaterThan(0);
  });

  it('shows the full `why` for each rule — the payload is not truncated', () => {
    renderCard(doneCard(unenforced));
    // The reason is rendered verbatim (the backend already caps it at 240
    // chars); nothing here clamps or ellipsises it.
    const [why] = screen.getAllByText(
      (_content, element) =>
        element?.tagName === 'P' &&
        (element.textContent ?? '').includes(OCL_WHY),
    );
    expect(why.textContent).toBe(`Why: ${OCL_WHY}`);
  });

  it('stops the card from claiming the app is ready', () => {
    renderCard(doneCard(unenforced));
    expect(screen.queryByText('Application ready')).toBeNull();
    expect(screen.getByText('Delivered — rules not enforced')).toBeTruthy();
    expect(screen.getByText(/2 rules? not\s+enforced/)).toBeTruthy();
  });

  it('reports the TRUE total when the backend capped the list', () => {
    renderCard(
      doneCard({
        ...unenforced,
        counts: { verified: 0, notVerified: 0, shippedUnenforced: 23 },
      }),
    );
    expect(
      screen.getByText(/Delivered, but 23 rules you asked for are not enforced/i),
    ).toBeTruthy();
    expect(screen.getByText(/Showing 2 of 23\./)).toBeTruthy();
  });
});

describe('run card — the other two states', () => {
  const mixed: SpecDrivenMessageState['verification'] = {
    verified: [
      {
        kind: 'api_workflow',
        id: 'book-a-room',
        what: "API workflow 'book-a-room'",
        how: '3 request(s) run against the app: POST /rooms, POST /bookings, GET /bookings',
      },
    ],
    notVerified: [
      {
        kind: 'check',
        id: '',
        what: 'runtime behaviour of the delivered app',
        why: 'no API workflow was run against it, so nothing here shows the app behaves as specified when it runs',
      },
    ],
    shippedUnenforced: [],
    counts: { verified: 11, notVerified: 4, shippedUnenforced: 0 },
  };

  it('summarises the counts in one row, with the sections behind it', () => {
    // Three always-open sections cost ~10 lines of card to say "0 / 4 / 11".
    // They collapse to one summary the user opens when they care.
    renderCard(doneCard(mixed));
    expect(screen.getByText(/11 verified/)).toBeTruthy();
    expect(screen.getByText(/4 unverified/)).toBeTruthy();
    // The sections themselves, and their detail, stay closed.
    expect(screen.queryByText('Could not verify')).toBeNull();
    expect(screen.queryByText(/3 request\(s\) run against the app/)).toBeNull();
  });

  it('opens the sections from the summary row', async () => {
    const user = userEvent.setup();
    renderCard(doneCard(mixed));
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Could not verify')).toBeTruthy();
    expect(screen.getByText('Not enforced')).toBeTruthy();
    expect(
      screen.getByText(/Nothing we checked was found missing/i),
    ).toBeTruthy();
  });

  it('reveals what was actually RUN behind the verified disclosure', async () => {
    const user = userEvent.setup();
    renderCard(doneCard(mixed));
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    await user.click(screen.getByRole('button', { name: /Verified/ }));
    expect(
      screen.getByText(
        /3 request\(s\) run against the app: POST \/rooms, POST \/bookings, GET \/bookings/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Showing 1 of 11\./)).toBeTruthy();
  });

  it('reveals why a check could not conclude', async () => {
    const user = userEvent.setup();
    renderCard(doneCard(mixed));
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    await user.click(screen.getByRole('button', { name: /Could not verify/ }));
    expect(
      screen.getByText(/no API workflow was run against it/),
    ).toBeTruthy();
  });
});

describe('run card — found in the code, not run', () => {
  const cited: SpecDrivenMessageState['verification'] = {
    verified: [
      {
        kind: 'api_workflow',
        id: 'place-order',
        what: "API workflow 'place-order'",
        how: 'a test the agent wrote passed: 2 request(s) run against the app: POST /orders, GET /orders',
      },
    ],
    foundInCode: [
      {
        kind: 'requirement',
        id: 'R4',
        what: 'an order total is never negative',
        how: 'implementation cited and re-checked against the delivered source: backend/app/orders.py:42; screens not run (no frontend)',
      },
    ],
    notVerified: [],
    shippedUnenforced: [],
    counts: { verified: 1, foundInCode: 9, notVerified: 0, shippedUnenforced: 0 },
  };

  const openPanel = async () => {
    const user = userEvent.setup();
    renderCard(doneCard(cited));
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    return user;
  };

  it('counts it in the summary row apart from what was verified', () => {
    renderCard(doneCard(cited));
    expect(screen.getByText(/1 verified/)).toBeTruthy();
    expect(screen.getByText(/9 found in code/)).toBeTruthy();
  });

  it('lists it in its own section, with its true total and the evidence as sent', async () => {
    const user = await openPanel();
    const section = screen.getByRole('button', { name: /Found in the code, not run/ });
    expect(section.textContent).toContain('9');
    await user.click(section);
    expect(screen.getByText('an order total is never negative')).toBeTruthy();
    const [how] = screen.getAllByText(
      (_content, element) =>
        element?.tagName === 'P' && (element.textContent ?? '').includes('backend/app/orders.py:42'),
    );
    expect(how.textContent).toBe(
      'Checked by: implementation cited and re-checked against the delivered source: backend/app/orders.py:42; screens not run (no frontend)',
    );
    expect(screen.getByText(/Showing 1 of 9\./)).toBeTruthy();
  });

  it('places it between Could not verify and Verified', async () => {
    await openPanel();
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((text) => /Could not verify|Found in the code|^Verified/.test(text));
    expect(labels.map((text) => text.replace(/\d.*$/, ''))).toEqual([
      'Could not verify',
      'Found in the code, not run',
      'Verified',
    ]);
  });

  it('says verified means a call to the running app, not a re-check of the code', async () => {
    await openPanel();
    expect(screen.queryByText(/ran or re-checked/)).toBeNull();
    expect(screen.getByText(/Verified means a call to the running app exercised it/)).toBeTruthy();
    expect(screen.getByText(/Found in the code means/)).toBeTruthy();
  });

  it('renders a saved card from before the state existed without the section', async () => {
    const user = userEvent.setup();
    renderCard(
      doneCard({
        verified: cited!.verified,
        notVerified: [],
        shippedUnenforced: [],
        counts: { verified: 1, notVerified: 0, shippedUnenforced: 0 },
      }),
    );
    expect(screen.queryByText(/found in code/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByText('Found in the code, not run')).toBeNull();
  });

  it('keeps the old wording for a live report from a backend without the state', async () => {
    // That backend still lists source citations under verified.
    const user = userEvent.setup();
    renderCard(
      doneCard(
        extractVerification({
          verified: cited!.foundInCode,
          notVerified: [],
          shippedUnenforced: [],
          counts: { verified: 1, notVerified: 0, shippedUnenforced: 0 },
        }),
      ),
    );
    expect(screen.queryByText(/found in code/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    expect(screen.queryByText('Found in the code, not run')).toBeNull();
    expect(screen.queryByText(/a call to the running app/)).toBeNull();
    expect(screen.getByText(/ran or re-checked/)).toBeTruthy();
  });
});

describe('run card — degradation', () => {
  it('falls back to the existing summary when verification is absent', () => {
    renderCard(doneCard(undefined));
    expect(screen.getByText('Application ready')).toBeTruthy();
    expect(screen.queryByText('Not enforced')).toBeNull();
    expect(screen.queryByText('Could not verify')).toBeNull();
  });

  it('collapses an all-zero report to one summary row', () => {
    // `extractVerification` returns undefined for this, but a persisted card
    // from another producer could still carry it — it must not become an
    // empty shell of three zero rows on top of a healthy run. The summary row
    // is that guarantee, stated as one line instead of three sections.
    renderCard(
      doneCard({
        verified: [],
        notVerified: [],
        shippedUnenforced: [],
        counts: { verified: 0, notVerified: 0, shippedUnenforced: 0 },
      }),
    );
    expect(screen.getByText('Application ready')).toBeTruthy();
    expect(screen.getByText(/0 verified/)).toBeTruthy();
    expect(
      screen.queryByText(/Nothing was confirmed working in this run/i),
    ).toBeNull();
    expect(screen.queryByText('Could not verify')).toBeNull();
  });
});

describe('run card — not verified, not confirmed and real blockers', () => {
  const REASON =
    'The app was generated, but it was never started, so nothing shows it runs (its startup timed out).';
  /** The card's first row: the headline and its qualifiers. */
  const headline = (text: RegExp) => screen.getByText(text).parentElement!.textContent;
  const finished = (fields: Partial<SpecDrivenMessageState>): SpecDrivenMessageState => ({
    ...doneCard(undefined),
    incomplete: false,
    ...fields,
  });

  it('heads a run with no evidence for a class of checks as not verified, with the reason', () => {
    renderCard(finished({ blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 0, unverified: true, unverifiedReason: REASON }));
    expect(headline(/— not verified/)).toBe('Generated — not verified');
    expect(screen.getByText(REASON)).toBeTruthy();
    expect(screen.queryByText('Application ready')).toBeNull();
  });

  it('states the real blocker of a run that is not verified too', () => {
    renderCard(finished({ blockerCount: 2, notConfirmedCount: 0, unresolvedBlockerCount: 1, unverified: true, unverifiedReason: REASON }));
    expect(headline(/— not verified/)).toBe('Generated — not verified· 1 unresolved blocker');
  });

  it('heads an edit run with no such evidence as an update that was not verified', () => {
    const updated = 'The app was updated, but it was never started, so nothing shows it runs (its startup timed out).';
    renderCard(finished({
      runMode: 'modify', blockerCount: 2, notConfirmedCount: 2, unresolvedBlockerCount: 0, unverified: true, unverifiedReason: updated,
    }));
    expect(headline(/— not verified/)).toBe('Updated — not verified');
    expect(screen.getByText(updated)).toBeTruthy();
  });

  it('counts findings not confirmed from their own field, with no blocker', () => {
    renderCard(finished({ blockerCount: 3, notConfirmedCount: 3, unresolvedBlockerCount: 0 }));
    expect(headline(/Application ready/)).toBe('Application ready· 3 could not be confirmed');
  });

  it('shows the real blockers as blockers and the rest as not confirmed', () => {
    renderCard(finished({ blockerCount: 5, notConfirmedCount: 3, unresolvedBlockerCount: 2 }));
    expect(headline(/— blockers remain/)).toBe(
      'Generated — blockers remain· 2 unresolved blockers· 3 could not be confirmed',
    );
    expect(screen.queryByText('Application ready')).toBeNull();
  });

  it('never heads a complete run with real blockers as ready, for an edit either', () => {
    renderCard(finished({ runMode: 'modify', blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 1 }));
    expect(headline(/— blockers remain/)).toBe('Updated — blockers remain· 1 unresolved blocker');
    expect(screen.queryByText('Application ready')).toBeNull();
  });

  it('takes the real blockers from the count when the server sends it, not from blockerCount', () => {
    // blockerCount still counts the note of a check switched off on the server.
    renderCard(finished({ blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 0, checksOff: ['build'], unverified: false }));
    expect(headline(/Application ready/)).toBe('Application ready');
    expect(screen.getByText('Not checked on this server: build')).toBeTruthy();
  });

  it('subtracts the findings not confirmed for a backend without the real count', () => {
    renderCard(finished({ blockerCount: 5, notConfirmedCount: 3 }));
    expect(headline(/Application ready/)).toBe(
      'Application ready· 2 unresolved blockers· 3 could not be confirmed',
    );
  });

  it('keeps an incomplete run as it was, with its findings not confirmed next to it', () => {
    renderCard(finished({ incomplete: true, blockerCount: 2, notConfirmedCount: 1 }));
    expect(headline(/Generated — incomplete/)).toBe(
      'Generated — incomplete· 2 unresolved blockers· 1 could not be confirmed',
    );
  });

  it.each([
    [{ incomplete: false, blockerCount: 2 }, /Application ready/, 'Application ready· 2 could not be verified'],
    [{ incomplete: true, blockerCount: 2 }, /Generated — incomplete/, 'Generated — incomplete· 2 unresolved blockers'],
    [{ incomplete: false, blockerCount: 0 }, /Application ready/, 'Application ready'],
  ])('reads an older backend exactly as before (%o)', (fields, text, expected) => {
    renderCard(finished(fields));
    expect(headline(text)).toBe(expected);
    expect(screen.queryByText(/could not be confirmed|not verified/)).toBeNull();
  });
});

describe('run card — ran and failed', () => {
  const report: SpecDrivenMessageState['verification'] = {
    verified: [],
    foundInCode: [],
    notVerified: [],
    shippedUnenforced: [],
    failed: [
      {
        kind: 'api_workflow',
        id: 'place-order',
        what: "API workflow 'place-order'",
        why: 'a test the agent wrote ran against the app and failed; it is not a rule from your request, and the test or the app may be wrong',
      },
    ],
    counts: { verified: 0, foundInCode: 0, notVerified: 0, shippedUnenforced: 0, failed: 1 },
  };

  it('counts it in the summary row and lists it in its own section', async () => {
    const user = userEvent.setup();
    renderCard(doneCard(report));
    expect(screen.getByText('1 ran and failed')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    const section = screen.getByRole('button', { name: /Ran and failed/ });
    expect(section.textContent).toContain('1');
    await user.click(section);
    expect(screen.getByText("API workflow 'place-order'")).toBeTruthy();
    expect(screen.getByText(/the test or the app may be wrong$/)).toBeTruthy();
  });

  it('is read from the done event, and left out for a backend that does not send it', () => {
    expect(extractVerification(report)?.failed).toHaveLength(1);
    expect(extractVerification(report)?.counts.failed).toBe(1);
    const older = extractVerification({ verified: [], notVerified: [], shippedUnenforced: [], counts: { verified: 1 } });
    expect(older).not.toHaveProperty('failed');
    expect(older?.counts).not.toHaveProperty('failed');
  });

  it('shows no section for a report without it', async () => {
    const user = userEvent.setup();
    renderCard(doneCard({ verified: [], notVerified: [], shippedUnenforced: [], counts: { verified: 1, notVerified: 0, shippedUnenforced: 0 } }));
    expect(screen.queryByText(/ran and failed/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /Verification/ }));
    expect(screen.queryByText('Ran and failed')).toBeNull();
  });
});

describe('run card — checks switched off on the server', () => {
  it('says so in one quiet line, without a not-verified headline or a count', () => {
    renderCard({
      ...doneCard(undefined),
      incomplete: false,
      blockerCount: 2,
      notConfirmedCount: 0,
      unresolvedBlockerCount: 0,
      unverified: false,
      checksOff: ['build', 'requirements'],
    });
    expect(screen.getByText('Not checked on this server: build, requirements')).toBeTruthy();
    expect(screen.getByText('Application ready').parentElement!.textContent).toBe('Application ready');
  });

  it('says nothing when the list is absent', () => {
    renderCard(doneCard(undefined));
    expect(screen.queryByText(/Not checked on this server/)).toBeNull();
  });
});
