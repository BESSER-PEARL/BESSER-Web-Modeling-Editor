/**
 * The assistant's requirements on the wire: the run judges these instead of extracting its own, so
 * they travel only when there are some (an empty list would claim the request states nothing).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSpecDrivenRun } from '../specDrivenSseClient';
import type { RequirementInput } from '../specDrivenSseClient';
import * as sse from '../../../../shared/api/sseClient';

async function bodyOf(requirements: RequirementInput[] | undefined, actorName?: string) {
  const spy = vi.spyOn(sse, 'streamSse');
  spy.mockImplementation(() => (async function* () {
    yield { event: 'done', sequence: 1 };
  })() as ReturnType<typeof sse.streamSse>);
  const handle = startSpecDrivenRun({
    project: { id: 'p1' }, instructions: 'Build a hotel app', provider: 'anthropic', apiKey: 'sk-test', requirements, actorName,
  });
  // Drain the run; the body is read from the spy.
  while (!(await handle.events.next()).done);
  const body = spy.mock.calls[0][1] as Record<string, unknown>;
  spy.mockRestore();
  return body;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a run with the assistant’s requirements', () => {
  it('sends them as the backend’s requirements', async () => {
    const requirements: RequirementInput[] = [{ id: 'call-1:R1', text: 'A room is identified by its number', kind: 'uniqueness' }];
    expect((await bodyOf(requirements)).requirements).toEqual(requirements);
  });

  it('leaves them out when there are none, so the run extracts its own', async () => {
    expect('requirements' in (await bodyOf([]))).toBe(false);
    expect('requirements' in (await bodyOf(undefined))).toBe(false);
  });
});

describe('the actor of a traced run', () => {
  it('sends the actor name, capped at the backend’s 200 characters', async () => {
    expect((await bodyOf(undefined, '  Ada  ')).actorName).toBe('Ada');
    expect(((await bodyOf(undefined, 'x'.repeat(300))).actorName as string).length).toBe(200);
  });

  it('leaves it out when there is none (recording is off)', async () => {
    expect('actorName' in (await bodyOf(undefined))).toBe(false);
    expect('actorName' in (await bodyOf(undefined, '  '))).toBe(false);
  });
});
