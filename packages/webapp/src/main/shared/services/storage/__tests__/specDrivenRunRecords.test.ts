/**
 * The request a project's latest run was started with is kept per project, in
 * the user's own words, so a later run (or the assistant) still has the
 * application's description after a vague follow-up, a failed run or a reload.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  isContentFreeRequest,
  MAX_RUN_REQUEST_LENGTH,
  readProjectLastRun,
  readProjectRunRequest,
  recordProjectRunRequest,
  runRequestFromInstructions,
  writeProjectLastRun,
} from '../specDrivenRunRecords';
import { localStorageSpecDrivenLastRunPrefix } from '../../../constants/constant';
import { writeLlmKey } from '../../llmKeyStorage';

const RUN = 'a'.repeat(32);

/** Instructions as the assistant frames them. */
const framed = (original: string) =>
  "## Assistant's notes (may be inaccurate)\n\n" +
  'Use these only for choices the user confirmed.\n\n' +
  'Summary: an order tracker with customers.\n\n' +
  "## The user's original request, verbatim\n\n" +
  'This is the authority. Where the summary above is shorter or differs, this text wins.\n\n' +
  original;

const ORIGINAL = 'Build an order tracker where customers place orders.';
const WITH_FOLLOW_UP =
  `${ORIGINAL}\n\n## Subsequent user request, verbatim\n\n` +
  'This later request takes precedence where it changes earlier requirements.\n\n' +
  'Add a status to each order.';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('runRequestFromInstructions', () => {
  it("keeps the user's original request, without the notes or the framing sentence", () => {
    expect(runRequestFromInstructions(framed(ORIGINAL))).toBe(ORIGINAL);
  });

  it('keeps a later request the assistant appended', () => {
    expect(runRequestFromInstructions(framed(WITH_FOLLOW_UP))).toBe(WITH_FOLLOW_UP);
  });

  it('keeps plain instructions whole', () => {
    expect(runRequestFromInstructions('Build a book catalogue with authors.')).toBe(
      'Build a book catalogue with authors.',
    );
  });

  it('cuts the request to the record limit', () => {
    expect(runRequestFromInstructions('x'.repeat(MAX_RUN_REQUEST_LENGTH + 50))).toHaveLength(4000);
  });
});

describe('isContentFreeRequest', () => {
  it.each(['regenerate with fixes.', 'Try again', 'fix it', 'continue with the generation', 'generate anyway with my current model'])(
    'finds nothing to build in "%s"',
    (request) => expect(isContentFreeRequest(request)).toBe(true),
  );

  it.each([ORIGINAL, 'Add a status to each order.', WITH_FOLLOW_UP, 'fix the login page'])(
    'finds a description in "%s"',
    (request) => expect(isContentFreeRequest(request)).toBe(false),
  );
});

describe('the recorded run request', () => {
  it('records the first description', () => {
    recordProjectRunRequest('p1', framed(ORIGINAL));
    expect(readProjectRunRequest('p1')).toBe(ORIGINAL);
  });

  it('replaces it with a request that adds to it', () => {
    recordProjectRunRequest('p1', framed(ORIGINAL));
    recordProjectRunRequest('p1', framed(WITH_FOLLOW_UP));
    expect(readProjectRunRequest('p1')).toBe(WITH_FOLLOW_UP);
  });

  it('keeps the previous request when a run is started with words that describe nothing', () => {
    recordProjectRunRequest('p1', framed(ORIGINAL));
    recordProjectRunRequest('p1', 'regenerate with fixes.');
    recordProjectRunRequest('p1', framed('try again'));
    expect(readProjectRunRequest('p1')).toBe(ORIGINAL);
  });

  it('is kept per project', () => {
    recordProjectRunRequest('p1', ORIGINAL);
    expect(readProjectRunRequest('p2')).toBeNull();
  });

  it('never keeps an API key pasted into the request', () => {
    writeLlmKey('openai', 'sk-pasted-secret');
    recordProjectRunRequest('p1', 'Build a book catalogue, use sk-pasted-secret for it.');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('sk-pasted-secret');
    expect(readProjectRunRequest('p1')).toBe('Build a book catalogue, use [API key removed] for it.');
  });
});

describe('the last-run record', () => {
  it('round-trips', () => {
    writeProjectLastRun('p1', RUN, 1000);
    expect(readProjectLastRun('p1')).toEqual({ runId: RUN, at: 1000 });
  });

  it('ignores a request field an earlier build may have written', () => {
    window.localStorage.setItem(
      `${localStorageSpecDrivenLastRunPrefix}p1`,
      JSON.stringify({ runId: RUN, at: 1000, request: 'Build a task board.' }),
    );
    expect(readProjectLastRun('p1')).toEqual({ runId: RUN, at: 1000 });
  });
});
