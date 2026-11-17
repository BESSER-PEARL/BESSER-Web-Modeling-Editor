/**
 * The running card offers "Notify me when it is done": the browser's
 * permission is asked only on that click, and the control stays out of the
 * way where notifications are unsupported or refused.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import type { SpecDrivenMessageState } from '@/main/features/spec-driven/types';

const running: SpecDrivenMessageState = {
  runId: 'f'.repeat(32),
  phases: [],
  warnings: [],
  text: '',
  status: 'running',
};

function installNotification(permission: NotificationPermission, answer: NotificationPermission) {
  const Fake = vi.fn() as unknown as typeof Notification & { requestPermission: ReturnType<typeof vi.fn> };
  Object.defineProperty(Fake, 'permission', { get: () => permission, configurable: true });
  Fake.requestPermission = vi.fn(async () => {
    permission = answer;
    return answer;
  });
  vi.stubGlobal('Notification', Fake);
  return Fake;
}

const renderRunning = () =>
  render(<ChatMessage id="m1" role="assistant" content="" specDriven={running} isStreaming />);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Notify me when it is done', () => {
  it('asks for permission on click and then says it is on', async () => {
    const api = installNotification('default', 'granted');
    renderRunning();
    expect(api.requestPermission).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notify me when it is done' }));
    });

    expect(api.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByText('You will be notified when it is done')).toBeTruthy();
  });

  it('disappears quietly when the user refuses', async () => {
    installNotification('default', 'denied');
    renderRunning();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notify me when it is done' }));
    });
    expect(screen.queryByRole('button', { name: 'Notify me when it is done' })).toBeNull();
    expect(screen.queryByText('You will be notified when it is done')).toBeNull();
  });

  it('is not offered where the browser has no notifications', () => {
    vi.stubGlobal('Notification', undefined);
    renderRunning();
    expect(screen.queryByRole('button', { name: 'Notify me when it is done' })).toBeNull();
  });
});
