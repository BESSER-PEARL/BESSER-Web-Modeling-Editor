/**
 * One global confirm at a time. A second request used to replace the first
 * one's resolver, so the first caller (e.g. a run waiting on "update or start
 * fresh?") waited forever.
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GlobalConfirmProvider } from '../GlobalConfirmProvider';
import { globalAlert, globalConfirm } from '../globalConfirm';

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

  // globalAlert replaced window.alert(): one button, and it resolves when closed.
  it('globalAlert shows the message with a single OK button', async () => {
    render(<GlobalConfirmProvider />);
    let closed: Promise<void> | undefined;
    act(() => { closed = globalAlert({ title: 'Route updated to: /home' }); });
    expect(screen.getByText('Route updated to: /home')).toBeTruthy();
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent?.trim());
    expect(buttons.map((b) => b.textContent)).toEqual(['OK']);
    act(() => buttons[0].click());
    await expect(closed).resolves.toBeUndefined();
    expect(screen.queryByText('Route updated to: /home')).toBeNull();
  });

  it('globalConfirm keeps its Cancel button', () => {
    render(<GlobalConfirmProvider />);
    act(() => { void globalConfirm({ title: 'Delete?', description: 'x' }); });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
