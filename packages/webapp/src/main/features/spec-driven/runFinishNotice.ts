/**
 * Telling a user who left the tab that a Spec-Driven run ended: a marker in
 * the tab title until they come back and, when they turned it on from the run
 * card, a browser notification. Permission is only ever asked on that click.
 */

import i18n from '../../shared/i18n';
import { readNotifyOnFinish, writeNotifyOnFinish } from './storage';

export type RunFinishOutcome = 'success' | 'incomplete' | 'failed';

function notificationApi(): typeof Notification | null {
  return typeof window !== 'undefined' && typeof window.Notification === 'function' ? window.Notification : null;
}

/** The user turned notifications on in this browser and the browser still allows them. */
export function isRunNotificationOn(): boolean {
  return notificationApi()?.permission === 'granted' && readNotifyOnFinish();
}

/** Offer "Notify me when it is done" only where it can work and is not on yet. */
export function canOfferRunNotification(): boolean {
  const api = notificationApi();
  return !!api && api.permission !== 'denied' && !isRunNotificationOn();
}

/** Ask the browser's permission (from a click) and remember the answer. */
export async function turnOnRunNotification(): Promise<boolean> {
  const api = notificationApi();
  if (!api) return false;
  try {
    const granted = (await api.requestPermission()) === 'granted';
    writeNotifyOnFinish(granted);
    return granted;
  } catch {
    return false;
  }
}

let restoreTitle: (() => void) | null = null;

function markTitle(outcome: RunFinishOutcome): void {
  restoreTitle?.();
  const original = document.title;
  const onVisibility = () => {
    if (document.visibilityState === 'visible') restore();
  };
  const restore = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    document.title = original;
    restoreTitle = null;
  };
  restoreTitle = restore;
  document.title = `${i18n.t(`assistant.runFinished.titleMarker.${outcome}`)} ${original}`;
  document.addEventListener('visibilitychange', onVisibility);
}

/** Nothing happens while the tab is visible: the run card and its toast already say it. */
export function announceRunFinished(projectName: string | undefined, outcome: RunFinishOutcome): void {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
  markTitle(outcome);
  const api = notificationApi();
  if (!api || !isRunNotificationOn()) return;
  const project = projectName || i18n.t('assistant.runFinished.untitledProject');
  try {
    const notification = new api(i18n.t(`assistant.runFinished.notificationTitle.${outcome}`), {
      body: i18n.t(`assistant.runFinished.notificationBody.${outcome}`, { project }),
      tag: 'besser-spec-driven-run',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers allow notifications only from a service worker.
  }
}
