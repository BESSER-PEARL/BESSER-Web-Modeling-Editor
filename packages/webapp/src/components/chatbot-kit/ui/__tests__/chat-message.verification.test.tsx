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

import { ChatMessage, type SpecDrivenMessageState } from '../chat-message';

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
