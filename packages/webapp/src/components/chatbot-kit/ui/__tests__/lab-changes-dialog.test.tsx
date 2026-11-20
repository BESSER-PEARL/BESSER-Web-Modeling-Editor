import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LabChangesDialog from '../lab-changes-dialog';
import { formatLineComments } from '@/main/features/lab/reviewMessage';
import type { LabDiffResponse, LabFileDiff } from '@/main/shared/api/lab';

// A hunk whose added lines are 10-14 of the changed file.
const PATCH = [
  'diff --git a/besser/x.py b/besser/x.py',
  'index 1111111..2222222 100644',
  '--- a/besser/x.py',
  '+++ b/besser/x.py',
  '@@ -8,3 +8,8 @@ def f():',
  ' line8',
  ' line9',
  '+new10',
  '+new11',
  '+new12',
  '+new13',
  '+new14',
  ' line10',
  '',
].join('\n');

const LOCK_PATCH = [
  'diff --git a/package-lock.json b/package-lock.json',
  'index 3333333..4444444 100644',
  '--- a/package-lock.json',
  '+++ b/package-lock.json',
  '@@ -1,1 +1,1 @@',
  '-"lockfileVersion": 2',
  '+"lockfileVersion": 3',
  '',
].join('\n');

const fileDiff = (overrides: Partial<LabFileDiff> = {}): LabFileDiff => ({
  path: 'besser/x.py',
  oldPath: null,
  status: 'modified',
  additions: 5,
  deletions: 0,
  binary: false,
  patch: PATCH,
  omitted: null,
  redactions: 0,
  ...overrides,
});

const response = (files: LabFileDiff[]): LabDiffResponse => ({
  changeId: 'abcdef012345',
  repos: [{ repo: 'besser', branch: 'lab/abcdef012345', base: 'development', files }],
});

afterEach(cleanup);

function renderDialog(load: (file?: { repo: string; path: string }) => Promise<LabDiffResponse>, onSend = vi.fn()) {
  render(<LabChangesDialog open onOpenChange={vi.fn()} load={load} onSend={onSend} />);
  return onSend;
}

describe('LabChangesDialog', () => {
  it('renders the patch of the first file', async () => {
    const load = vi.fn(() => Promise.resolve(response([fileDiff()])));
    renderDialog(load);
    expect(await screen.findByText('new12')).toBeTruthy();
    expect(screen.getByText('line9')).toBeTruthy();
    expect(load).toHaveBeenCalledWith();
  });

  it('sends a comment on new lines 10-14 as the formatted review message', async () => {
    const onSend = renderDialog(() => Promise.resolve(response([fileDiff()])));
    fireEvent.click(await screen.findByRole('button', { name: 'Select line 10 (current file)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select line 14 (current file)' }), { shiftKey: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment for the lab agent' }), {
      target: { value: 'Use a loop here.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    fireEvent.click(screen.getByRole('button', { name: /Send to the lab agent/ }));

    expect(onSend).toHaveBeenCalledWith(
      formatLineComments([
        {
          repo: 'besser',
          path: 'besser/x.py',
          side: 'new',
          startLine: 10,
          endLine: 14,
          quoted: 'new10\nnew11\nnew12\nnew13\nnew14',
          text: 'Use a loop here.',
        },
      ]),
    );
  });

  it('collects a whole-file comment and a line comment in one message', async () => {
    const onSend = renderDialog(() => Promise.resolve(response([fileDiff()])));
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on the file' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment for the lab agent' }), {
      target: { value: 'Add a docstring.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select line 9 (current file)' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment for the lab agent' }), {
      target: { value: 'Why keep this?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    fireEvent.click(screen.getByRole('button', { name: /Send to the lab agent/ }));

    expect(onSend).toHaveBeenCalledWith(
      formatLineComments([
        { repo: 'besser', path: 'besser/x.py', side: 'new', startLine: null, endLine: null, quoted: '', text: 'Add a docstring.' },
        { repo: 'besser', path: 'besser/x.py', side: 'new', startLine: 9, endLine: 9, quoted: 'line9', text: 'Why keep this?' },
      ]),
    );
  });

  it('reads a file the full diff left out alone when it is selected', async () => {
    const lock = fileDiff({ path: 'package-lock.json', patch: null, omitted: 'too_large', additions: 1, deletions: 1 });
    const load = vi.fn((file?: { repo: string; path: string }) =>
      Promise.resolve(file ? response([fileDiff({ ...lock, patch: LOCK_PATCH, omitted: null })]) : response([fileDiff(), lock])),
    );
    renderDialog(load);
    await screen.findByText('new12');
    fireEvent.click(screen.getByRole('button', { name: /package-lock\.json/ }));

    expect(await screen.findByText('"lockfileVersion": 3')).toBeTruthy();
    expect(load).toHaveBeenCalledWith({ repo: 'besser', path: 'package-lock.json' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('says how many values were hidden in a file', async () => {
    renderDialog(() => Promise.resolve(response([fileDiff({ redactions: 2 })])));
    expect(await screen.findByText('2 values hidden')).toBeTruthy();
  });

  it("shows the server's refusal when the diff cannot be read", async () => {
    renderDialog(() => Promise.reject(new Error('Its branches were deleted when it closed; the diff is on the pull request.')));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Its branches were deleted when it closed; the diff is on the pull request.',
      ),
    );
  });
});
