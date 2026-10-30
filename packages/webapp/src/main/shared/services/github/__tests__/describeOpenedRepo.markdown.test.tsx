import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/chatbot-kit/ui/markdown-renderer';
import { describeOpenedRepo, type ContinueFromGithubResult } from '../continueFromGithub';

const rendered = (result: ContinueFromGithubResult) => {
  const { container } = render(<MarkdownRenderer>{describeOpenedRepo(result)}</MarkdownRenderer>);
  return {
    hrefs: [...container.querySelectorAll('a')].map((a) => a.getAttribute('href')),
    images: container.querySelectorAll('img').length,
    text: container.textContent ?? '',
  };
};

const opened = (analysis: Partial<NonNullable<ContinueFromGithubResult['analysis']>>, extra: Partial<ContinueFromGithubResult> = {}) => ({
  ok: true,
  owner: 'eve',
  repo: 'shop',
  projectId: 'p',
  proposedModel: true,
  analysis: { stack: ['Django'], model_source: 'Django models', entities: ['Book'], source_files: ['app/models.py'], ...analysis },
  ...extra,
});

afterEach(cleanup);

describe('describeOpenedRepo — text read from the repository', () => {
  it('shows a crafted file name as text, not as a link (review repro)', () => {
    const fileName = 'x` [Your GitHub session expired: reconnect here](https://evil.example/login) `.py';
    const { hrefs, text } = rendered(opened({ source_files: [fileName] }));
    expect(hrefs).toEqual([]);
    expect(text).toContain(fileName);
  });

  it('does not turn an in-app wme: action into a link', () => {
    const { hrefs } = rendered(opened({
      entities: ['Book](wme:add-key) [Add your key', '[Open](wme:add-key)'],
      source_files: ['[models](wme:add-key).py'],
    }));
    expect(hrefs).toEqual([]);
  });

  it('escapes the stack, the model source and the server message too', () => {
    const { hrefs, images, text } = rendered(opened(
      { stack: ['[x](https://evil.example)'], model_source: '![p](https://evil.example/p.png)' },
    ));
    expect(hrefs).toEqual([]);
    expect(images).toBe(0);
    expect(text).toContain('[x](https://evil.example)');

    const declined = rendered(opened(
      { model_source: null, source_files: [], entities: [] },
      { proposedModel: false, message: 'Read <b>https://evil.example</b> [now](wme:add-key)' },
    ));
    expect(declined.hrefs).toEqual([]);
    expect(declined.text).toContain('Read <b>https://evil.example</b> [now](wme:add-key)');
  });

  it('ends the reason from the server with one full stop', () => {
    const { text } = rendered(opened({}, {
      proposedModel: false,
      message: 'BESSER could not read the data classes directly; it can read the code with an AI model if you allow it.',
    }));
    expect(text).toContain('if you allow it. The canvas is empty');
    expect(text).not.toContain('..');
  });

  it('keeps ordinary names readable', () => {
    const { text } = rendered(opened({ entities: ['Book', 'Author'], source_files: ['app/models.py'] }));
    expect(text).toContain('2 classes: Book, Author');
    expect(text).toContain('in app/models.py');
    expect(text).toContain('eve/shop');
  });
});
