/**
 * The `step` event: what the run is doing now inside a long phase.
 *
 * Validation (checks, requirement judging, fix attempts) can run for twenty
 * minutes with single LLM calls of one to two and a half minutes. Without a
 * step the card kept the previous phase's last line on screen for all of it,
 * and a working run read as hung.
 */
import { describe, expect, it } from 'vitest';

import { applySpecDrivenEvent } from '../specDrivenSlice';
import type { SpecDrivenEvent, SpecDrivenMessageState } from '../../types';

const CARD: SpecDrivenMessageState = { phases: [], warnings: [], text: '', status: 'running' };

const UNTIL_VALIDATION: SpecDrivenEvent[] = [
  { event: 'phase', phase: 'customize', message: 'LLM customising generator output', elapsedSeconds: 40 },
  { event: 'tool_call', turn: 1, tool: 'modify_file', status: 'executing', detail: 'path=src/App.tsx' },
  { event: 'text', delta: 'The order form now validates the quantity.' },
  { event: 'phase', phase: 'validate', message: 'Validating', elapsedSeconds: 380 },
];

const replay = (events: SpecDrivenEvent[], from = CARD) => events.reduce(applySpecDrivenEvent, from);

describe('step events', () => {
  it('keep the current step with when it started and what came before it', () => {
    const card = replay([
      ...UNTIL_VALIDATION,
      { event: 'step', phase: 'validate', message: 'First check: checking 35 requirements against the code', elapsedSeconds: 412.5 },
    ]);
    expect(card.step).toEqual({
      message: 'First check: checking 35 requirements against the code',
      startedAt: 412.5,
      toolCallsBefore: 1,
      textBefore: 'The order form now validates the quantity.'.length,
    });
  });

  it('replace each other: only the latest step is current', () => {
    const card = replay([
      ...UNTIL_VALIDATION,
      { event: 'step', phase: 'validate', message: 'First check: checking the code for errors', elapsedSeconds: 380 },
      { event: 'step', phase: 'validate', message: 'Fix attempt 1: fixing 24 blockers (20 about requirements)', elapsedSeconds: 520 },
    ]);
    expect(card.step?.message).toBe('Fix attempt 1: fixing 24 blockers (20 about requirements)');
    expect(card.step?.startedAt).toBe(520);
  });

  it('end when the next phase starts or the run ends', () => {
    const stepped = replay([
      ...UNTIL_VALIDATION,
      { event: 'step', phase: 'validate', message: 'Packaging the result', elapsedSeconds: 900 },
    ]);
    expect(replay([{ event: 'phase', phase: 'validate', message: 'Validating' }], stepped).step).toBeUndefined();
    expect(replay([{ event: 'done', downloadUrl: '/d', fileName: 'app.zip', isZip: true, recipe: {} }], stepped).step)
      .toBeUndefined();
    expect(replay([{ event: 'error', code: 'CANCELLED', message: 'Cancelled' }], stepped).step).toBeUndefined();
    // A non-terminal warning does not end the step.
    expect(replay([{ event: 'error', code: 'TIMEOUT', message: 'Runtime cap' }], stepped).step?.message)
      .toBe('Packaging the result');
  });

  it('do not add a tool call or a phase row', () => {
    const before = replay(UNTIL_VALIDATION);
    const after = replay([{ event: 'step', phase: 'validate', message: 'Fix attempt 1: fixing 2 blockers' }], before);
    expect(after.phases).toEqual(before.phases);
    expect(after.step?.startedAt).toBeUndefined();
  });

  it('are ignored when they name another phase than the current row', () => {
    // A validation helper that also runs during customisation must not label that phase.
    const customising = replay(UNTIL_VALIDATION.slice(0, 3));
    const card = replay(
      [{ event: 'step', phase: 'validate', message: 'Validation: starting the backend', elapsedSeconds: 60 }],
      customising,
    );
    expect(card.step).toBeUndefined();
  });

  it('match the latest backend phase row, past a client-side row', () => {
    const switched = replay([
      ...UNTIL_VALIDATION,
      { event: 'model_update', model: 'fallback-model', previousModel: 'primary', reason: 'primary_unavailable' },
    ]);
    const card = replay(
      [{ event: 'step', phase: 'validate', message: 'Fix attempt 1: fixing 2 blockers', elapsedSeconds: 500 }],
      switched,
    );
    expect(card.step?.message).toBe('Fix attempt 1: fixing 2 blockers');
  });
});
