/**
 * One global confirm at a time. A second request used to replace the first
 * one's resolver, so the first caller (e.g. a run waiting on "update or start
 * fresh?") waited forever.
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GlobalConfirmProvider } from '../GlobalConfirmProvider';
import { globalConfirm } from '../globalConfirm';

afterEach(() => cleanup());

describe('GlobalConfirmProvider', () => {
  it('a newer request cancels the open one instead of leaving it pending', async () => {
    render(<GlobalConfirmProvider />);
    let first: Promise<boolean> | undefined;
    act(() => { first = globalConfirm({ title: 'First?', description: 'a' }); });
    act(() => { void globalConfirm({ title: 'Second?', description: 'b' }); });
    await expect(first).resolves.toBe(false);
    expect(screen.getByText('Second?')).toBeTruthy();
  });

  it('aborting the signal closes the dialog as a cancel', async () => {
    render(<GlobalConfirmProvider />);
    const stop = new AbortController();
    let pending: Promise<boolean> | undefined;
    act(() => { pending = globalConfirm({ title: 'Run?', description: 'x', signal: stop.signal }); });
    expect(screen.getByText('Run?')).toBeTruthy();
    act(() => stop.abort());
    await expect(pending).resolves.toBe(false);
    expect(screen.queryByText('Run?')).toBeNull();
  });
});
