/**
 * A user who leaves the tab during a long run learns that it ended: the tab
 * title carries a marker until they return, and a browser notification fires
 * when they turned it on. Permission is asked only from the user's click.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  announceRunFinished,
  canOfferRunNotification,
  isRunNotificationOn,
  turnOnRunNotification,
} from '../runFinishNotice';
import { readNotifyOnFinish, writeNotifyOnFinish } from '../storage';

type Shown = { title: string; options?: NotificationOptions; instance: { onclick: (() => void) | null; close: () => void } };
const shown: Shown[] = [];

function installNotification(permission: NotificationPermission, answer: NotificationPermission = permission) {
  const Fake = vi.fn(function (this: Shown['instance'], title: string, options?: NotificationOptions) {
    this.onclick = null;
    this.close = vi.fn();
    shown.push({ title, options, instance: this });
  }) as unknown as typeof Notification & { requestPermission: ReturnType<typeof vi.fn> };
  Object.defineProperty(Fake, 'permission', { get: () => permission, configurable: true });
  Fake.requestPermission = vi.fn(async () => {
    permission = answer;
    return answer;
  });
  vi.stubGlobal('Notification', Fake);
  return Fake;
}

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  shown.length = 0;
  window.localStorage.clear();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  document.title = 'BESSER';
});

afterEach(() => {
  setVisibility('visible');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('turning notifications on', () => {
  it('asks the browser only when called, and remembers a yes', async () => {
    const api = installNotification('default', 'granted');
    expect(api.requestPermission).not.toHaveBeenCalled();
    expect(canOfferRunNotification()).toBe(true);

    await expect(turnOnRunNotification()).resolves.toBe(true);

    expect(api.requestPermission).toHaveBeenCalledTimes(1);
    expect(readNotifyOnFinish()).toBe(true);
    expect(isRunNotificationOn()).toBe(true);
    expect(canOfferRunNotification()).toBe(false);
  });

  it('is not offered where the browser refused or has no notifications', async () => {
    installNotification('default', 'denied');
    await expect(turnOnRunNotification()).resolves.toBe(false);
    expect(canOfferRunNotification()).toBe(false);

    vi.stubGlobal('Notification', undefined);
    expect(canOfferRunNotification()).toBe(false);
    await expect(turnOnRunNotification()).resolves.toBe(false);
  });
});

describe('announceRunFinished', () => {
  it('does nothing while the tab is visible', () => {
    installNotification('granted');
    writeNotifyOnFinish(true);
    announceRunFinished('Order tracker', 'success');
    expect(document.title).toBe('BESSER');
    expect(shown).toHaveLength(0);
  });

  it('marks the title of a hidden tab until the user comes back', () => {
    installNotification('default');
    setVisibility('hidden');
    announceRunFinished('Order tracker', 'failed');
    expect(document.title).toBe('(Failed) BESSER');
    expect(shown).toHaveLength(0);

    setVisibility('visible');
    expect(document.title).toBe('BESSER');
  });

  it('notifies with the project and the outcome, and focuses the tab on click', () => {
    installNotification('granted');
    writeNotifyOnFinish(true);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    setVisibility('hidden');

    announceRunFinished('Order tracker', 'incomplete');

    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('Generation incomplete');
    expect(shown[0].options?.body).toBe('Order tracker: the run stopped early. Its output is ready to inspect.');
    shown[0].instance.onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(shown[0].instance.close).toHaveBeenCalled();
  });

  it('sends no notification the user did not ask for', () => {
    installNotification('granted');
    setVisibility('hidden');
    announceRunFinished('Order tracker', 'success');
    expect(shown).toHaveLength(0);
    expect(document.title).toBe('(Done) BESSER');
  });
});
