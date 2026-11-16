/**
 * The request a project's latest run was started with is kept per project, in
 * the user's own words as the assistant framed them, so a later run (or the
 * assistant) still has the application's description after a vague
 * follow-up, a failed run or a reload.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
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
const FOLLOW_UP_SECTION =
  '## Subsequent user request, verbatim\n\n' +
  'This later request takes precedence where it changes earlier requirements.\n\n' +
  'Add a status to each order.';
const WITH_FOLLOW_UP = `${ORIGINAL}\n\n${FOLLOW_UP_SECTION}`;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('runRequestFromInstructions', () => {
  it("keeps the user's original request, without the notes or the framing sentence", () => {
    expect(runRequestFromInstructions(framed(ORIGINAL))).toBe(ORIGINAL);
  });

  it('keeps a later request the assistant appended verbatim', () => {
    expect(runRequestFromInstructions(framed(WITH_FOLLOW_UP))).toBe(WITH_FOLLOW_UP);
  });

  it('drops a section the assistant wrote itself', () => {
    const fixNote = '## Subsequent user request\n\nThe user asked to fix the issues of the previous result.';
    expect(runRequestFromInstructions(framed(`${ORIGINAL}\n\n${fixNote}\n\n${FOLLOW_UP_SECTION}`))).toBe(WITH_FOLLOW_UP);
  });

  it("keeps the user's own headings", () => {
    const described = `${ORIGINAL}\n\n## Screens\n\nA list of orders.`;
    expect(runRequestFromInstructions(framed(described))).toBe(described);
  });

  it('finds no user words in instructions the assistant did not frame', () => {
    expect(runRequestFromInstructions('Generate a backend with an orders table and token login.')).toBeNull();
  });
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

  it('keeps the previous request when a run is started with instructions the assistant did not frame', () => {
    recordProjectRunRequest('p1', framed(ORIGINAL));
    recordProjectRunRequest('p1', 'regenerate with fixes.');
    recordProjectRunRequest('p1', 'Generate a backend with an orders table and token login.');
    expect(readProjectRunRequest('p1')).toBe(ORIGINAL);
  });

  it('is kept per project', () => {
    recordProjectRunRequest('p1', framed(ORIGINAL));
    expect(readProjectRunRequest('p2')).toBeNull();
  });

  it('is cut to the record limit', () => {
    recordProjectRunRequest('p1', framed('x'.repeat(MAX_RUN_REQUEST_LENGTH + 50)));
    expect(readProjectRunRequest('p1')).toHaveLength(MAX_RUN_REQUEST_LENGTH);
  });

  it('never keeps an API key pasted into the request', () => {
    writeLlmKey('openai', 'sk-pasted-secret');
    recordProjectRunRequest('p1', framed('Build a book catalogue, use sk-pasted-secret for it.'));
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('sk-pasted-secret');
    expect(readProjectRunRequest('p1')).toBe('Build a book catalogue, use [API key removed] for it.');
  });

  it('removes a key before cutting, so no part of a key that crosses the limit is kept', () => {
    const key = 'sk-proj-KEYKEYKEYKEYKEYKEYKEYKEYKEY0123456789';
    writeLlmKey('openai', key);
    const filler = 'Build an app. '.repeat(300).slice(0, MAX_RUN_REQUEST_LENGTH - 20);
    recordProjectRunRequest('p1', framed(`${filler} ${key} tail`));
    expect(readProjectRunRequest('p1')).not.toContain(key.slice(0, 12));
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
