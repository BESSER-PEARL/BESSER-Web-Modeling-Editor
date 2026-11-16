/**
 * The per-project last-run record also keeps the request the run was started
 * with, so a later run (or the assistant) still has the user's own words after
 * the run's output expired.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_RUN_REQUEST_LENGTH,
  readProjectLastRun,
  runRequestFromInstructions,
  writeProjectLastRun,
} from '../specDrivenRunRecords';
import { localStorageSpecDrivenLastRunPrefix } from '../../../constants/constant';
import { writeLlmKey } from '../../llmKeyStorage';

const RUN = 'a'.repeat(32);

const FRAMED =
  "## Assistant's notes (may be inaccurate)\n\n" +
  'Use these only for choices the user confirmed.\n\n' +
  'Summary: an order tracker with customers.\n\n' +
  "## The user's original request, verbatim\n\n" +
  'This is the authority.\n\n' +
  'Build an order tracker where customers place orders.\n\n' +
  '## Subsequent user request, verbatim\n\n' +
  'This later request takes precedence.\n\n' +
  'Add a status to each order.';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('runRequestFromInstructions', () => {
  it("drops the assistant's notes and keeps both request sections", () => {
    const request = runRequestFromInstructions(FRAMED);
    expect(request.startsWith("## The user's original request, verbatim")).toBe(true);
    expect(request).toContain('Build an order tracker where customers place orders.');
    expect(request).toContain('## Subsequent user request, verbatim');
    expect(request).toContain('Add a status to each order.');
    expect(request).not.toContain('Summary: an order tracker');
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

describe('the last-run record', () => {
  it('keeps the request it was written with', () => {
    writeProjectLastRun('p1', RUN, 1000, 'Build a book catalogue with authors.');
    expect(readProjectLastRun('p1')).toEqual({ runId: RUN, at: 1000, request: 'Build a book catalogue with authors.' });
  });

  it('loads a record written before requests were kept', () => {
    window.localStorage.setItem(`${localStorageSpecDrivenLastRunPrefix}p1`, JSON.stringify({ runId: RUN, at: 1000 }));
    expect(readProjectLastRun('p1')).toEqual({ runId: RUN, at: 1000 });
  });

  it('never keeps an API key pasted into the request', () => {
    writeLlmKey('openai', 'sk-pasted-secret');
    writeProjectLastRun('p1', RUN, 1000, 'Use sk-pasted-secret for the build.');
    const raw = window.localStorage.getItem(`${localStorageSpecDrivenLastRunPrefix}p1`) ?? '';
    expect(raw).not.toContain('sk-pasted-secret');
    expect(readProjectLastRun('p1')?.request).toBe('Use [API key removed] for the build.');
  });
});
