import { describe, expect, it } from 'vitest';

import { parseRepoReference } from '../StartFromRepoDialog';

describe('parseRepoReference', () => {
  it.each([
    ['https://github.com/me/shop', { owner: 'me', repo: 'shop' }],
    ['github.com/me/shop.git', { owner: 'me', repo: 'shop' }],
    ['https://www.github.com/me/shop/', { owner: 'me', repo: 'shop' }],
    ['https://github.com/me/shop/tree/dev', { owner: 'me', repo: 'shop', branch: 'dev' }],
    ['  me/my.repo-1  ', { owner: 'me', repo: 'my.repo-1' }],
  ])('reads %s', (text, expected) => {
    expect(parseRepoReference(text)).toEqual(expected);
  });

  it.each(['', 'shop', 'https://gitlab.com/me/shop', 'me/shop/extra'])('rejects %s', (text) => {
    expect(parseRepoReference(text)).toBeNull();
  });
});
