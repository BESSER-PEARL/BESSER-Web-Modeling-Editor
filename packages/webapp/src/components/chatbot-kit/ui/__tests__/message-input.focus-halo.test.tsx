/**
 * The composer's focus halo (a 3px box-shadow) sat flush against a wrapper with
 * overflow: hidden, so it was clipped on the left, right and top and showed only
 * along the bottom. The clipping wrapper must leave 3px of room around the box.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageInput } from '../message-input';

afterEach(cleanup);

describe('MessageInput focus halo', () => {
  it('is not clipped by the wrapper that hides overflow', () => {
    render(<MessageInput value="" onChange={vi.fn()} isGenerating={false} />);
    const textarea = screen.getByRole('textbox');
    const halo = textarea.className.match(/focus-visible:shadow-\[0_0_0_(\d+)px/);
    expect(halo).not.toBeNull();

    const clipper = textarea.parentElement?.closest('.overflow-hidden') as HTMLElement;
    expect(clipper).not.toBeNull();
    expect(clipper.className).toContain(`p-[${halo![1]}px]`);
  });
});
