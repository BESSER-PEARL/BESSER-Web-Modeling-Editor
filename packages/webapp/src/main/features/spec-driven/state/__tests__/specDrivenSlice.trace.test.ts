/**
 * The run card's trace view (#649): what each phase took, and the validation
 * findings with the fix attempts between them.
 *
 * The timeline is run t3-bare (2026-11-17, claude-sonnet-5-5): one blocker on
 * the first check, fixed in one attempt of three tool calls, $0.1254 in 35.3 s.
 */
import { describe, expect, it } from 'vitest';

import { applySpecDrivenEvent, phaseStats } from '../specDrivenSlice';
import type { SpecDrivenEvent, SpecDrivenMessageState } from '../../types';

const CARD: SpecDrivenMessageState = { phases: [], warnings: [], text: '', status: 'running' };
const BLOCKER = 'import [backend/sql_alchemy.py]: name _sa_event is used before it is imported';

const EVENTS: SpecDrivenEvent[] = [
  { event: 'phase', phase: 'select', message: 'Selecting generator', usd: 0, turns: 0, elapsedSeconds: 0 },
  { event: 'phase', phase: 'generate', message: 'running generate_fastapi_backend', usd: 0, turns: 0, elapsedSeconds: 4.0 },
  { event: 'phase', phase: 'gap', message: 'Analysing gaps', usd: 0, turns: 0, elapsedSeconds: 6.0 },
  { event: 'phase', phase: 'customize', message: 'LLM customising generator output', usd: 0.0143, turns: 0, elapsedSeconds: 9.7 },
  { event: 'tool_call', turn: 1, tool: 'read_file', status: 'executing', detail: 'path=backend/sql_alchemy.py' },
  { event: 'phase', phase: 'validate', message: 'Validating', usd: 0.1105, turns: 7, elapsedSeconds: 26.0 },
  { event: 'phase_update', phase: 'validate', details: '', message: '1 blockers / 1 total' },
  { event: 'findings', attempt: 0, blockers: [BLOCKER], blockerCount: 1, issueCount: 1 },
  { event: 'tool_call', turn: 8, tool: 'read_file', status: 'executing', detail: 'path=backend/sql_alchemy.py' },
  { event: 'tool_call', turn: 9, tool: 'modify_file', status: 'executing', detail: 'path=backend/sql_alchemy.py' },
  { event: 'tool_call', turn: 9, tool: 'validate_app', status: 'executing', detail: 'batched=2' },
  { event: 'findings', attempt: 1, blockers: [], blockerCount: 0, issueCount: 0 },
  { event: 'cost', usd: 0.1254, turns: 10, elapsedSeconds: 35.33 },
];

const replay = (events: SpecDrivenEvent[]) => events.reduce(applySpecDrivenEvent, CARD);

describe('per-phase cost, turns and duration', () => {
  it('keeps each phase\'s start and measures it to the next phase', () => {
    const card = replay(EVENTS);
    expect(card.phases[3].startedAt).toEqual({ usd: 0.0143, turns: 0, elapsedSeconds: 9.7 });
    const customize = phaseStats(card.phases, 3, card)!;
    expect(customize.elapsedSeconds).toBeCloseTo(16.3);
    expect(customize.turns).toBe(7);
    expect(customize.usd).toBeCloseTo(0.0962);
  });

  it('measures the last phase to the run\'s latest totals', () => {
    const card = replay(EVENTS);
    expect(card.turns).toBe(10);
    const validate = phaseStats(card.phases, 4, card)!;
    expect(validate.elapsedSeconds).toBeCloseTo(9.33);
    expect(validate.turns).toBe(3);
    expect(validate.usd).toBeCloseTo(0.0149);
  });

  it('has nothing to say for an older backend that sends no stamps', () => {
    const card = replay([{ event: 'phase', phase: 'select', message: 'Selecting generator' }]);
    expect(card.phases[0].startedAt).toBeUndefined();
    expect(phaseStats(card.phases, 0, { elapsedSeconds: 3 })).toBeUndefined();
  });

  it('skips an unstamped client-side row when measuring', () => {
    const card = replay([
      EVENTS[0],
      { event: 'model_update', model: 'qwen3-coder:30b' },
      EVENTS[1],
    ]);
    expect(phaseStats(card.phases, 0, card)!.elapsedSeconds).toBe(4);
    expect(phaseStats(card.phases, 1, card)).toBeUndefined();
  });
});

describe('validation findings and the repairs that followed', () => {
  it('puts each round on the validate row, between its tool calls', () => {
    const validate = replay(EVENTS).phases[4];
    expect(validate.message).toBe('1 blockers / 1 total');
    expect(validate.findings).toEqual([
      { attempt: 0, blockers: [BLOCKER], blockerCount: 1, issueCount: 1, restored: false, afterToolCalls: 0 },
      { attempt: 1, blockers: [], blockerCount: 0, issueCount: 0, restored: false, afterToolCalls: 3 },
    ]);
    expect(validate.toolCalls.map((c) => c.tool)).toEqual(['read_file', 'modify_file', 'validate_app']);
  });

  it('never lets a capped list claim fewer blockers than it lists', () => {
    const card = replay([
      EVENTS[5],
      { event: 'findings', attempt: 0, blockers: ['a', 'b'], blockerCount: 1, issueCount: 0 },
    ]);
    expect(card.phases[0].findings![0]).toMatchObject({ blockerCount: 2, issueCount: 2 });
  });

  it('drops findings that arrive before any validate row', () => {
    const card = replay([EVENTS[0], { event: 'findings', attempt: 0, blockers: ['x'], blockerCount: 1, issueCount: 1 }]);
    expect(card.phases[0].findings).toBeUndefined();
  });
});
