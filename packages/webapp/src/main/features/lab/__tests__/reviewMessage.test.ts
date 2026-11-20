import { describe, expect, it } from 'vitest';

import { formatLineComments, type LabLineComment } from '../reviewMessage';

const comment = (overrides: Partial<LabLineComment> = {}): LabLineComment => ({
  repo: 'besser',
  path: 'besser/x.py',
  side: 'new',
  startLine: 10,
  endLine: 14,
  quoted: 'a = 1\nb = 2',
  text: 'Use a constant.',
  ...overrides,
});

describe('formatLineComments', () => {
  it('quotes a range of the current file under its repository and path', () => {
    expect(formatLineComments([comment()])).toBe(
      'Review comments on the change:\n\n' +
        '1. besser `besser/x.py`, lines 10-14 (current file):\n```\na = 1\nb = 2\n```\nUse a constant.',
    );
  });

  it('names a whole-file comment without quoting the file', () => {
    expect(
      formatLineComments([comment({ startLine: null, endLine: null, quoted: '', text: 'Split this file.' })]),
    ).toBe('Review comments on the change:\n\n1. besser `besser/x.py`, whole file:\nSplit this file.');
  });

  it('marks a range of deleted lines as the previous version', () => {
    expect(
      formatLineComments([
        comment({ repo: 'frontend', path: 'src/a.ts', side: 'old', startLine: 3, endLine: 4, quoted: 'x()\ny()' }),
      ]),
    ).toBe(
      'Review comments on the change:\n\n' +
        '1. frontend `src/a.ts`, lines 3-4 (previous version):\n```\nx()\ny()\n```\nUse a constant.',
    );
  });

  it('numbers several comments and names a single line as one line', () => {
    const text = formatLineComments([
      comment({ startLine: 7, endLine: 7, quoted: 'c = 3', text: 'First.' }),
      comment({ repo: 'modeling_agent', path: 'b.py', startLine: null, endLine: null, quoted: '', text: 'Second.' }),
    ]);
    expect(text).toBe(
      'Review comments on the change:\n\n' +
        '1. besser `besser/x.py`, line 7 (current file):\n```\nc = 3\n```\nFirst.\n\n' +
        '2. modeling_agent `b.py`, whole file:\nSecond.',
    );
  });

  it('fences quoted lines that contain a code fence with a longer fence', () => {
    const text = formatLineComments([comment({ startLine: 1, endLine: 1, quoted: '```py' })]);
    expect(text).toContain('\n````\n```py\n````\n');
  });
});
