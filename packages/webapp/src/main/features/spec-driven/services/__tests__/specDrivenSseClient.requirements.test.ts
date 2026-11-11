/**
 * The assistant's requirements on the wire: the run judges these instead of extracting its own, so
 * they travel only when there are some (an empty list would claim the request states nothing).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSpecDrivenRun } from '../specDrivenSseClient';
import type { RequirementInput } from '../specDrivenSseClient';
import * as sse from '../../../../shared/api/sseClient';

async function bodyOf(requirements: RequirementInput[] | undefined) {
  const spy = vi.spyOn(sse, 'streamSse');
  spy.mockImplementation(() => (async function* () {
    yield { event: 'done', sequence: 1 };
  })() as ReturnType<typeof sse.streamSse>);
  const handle = startSpecDrivenRun({
    project: { id: 'p1' }, instructions: 'Build a hotel app', provider: 'anthropic', apiKey: 'sk-test', requirements,
  });
  // Drain the run; the body is read from the spy.
  while (!(await handle.events.next()).done);
  return spy.mock.calls[0][1] as Record<string, unknown>;
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
