import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { applyConsentToPostHog } from '../../services/analytics/lazy-analytics';
import { Z_INDEX } from '../../constants/z-index';
import { ENABLE_STUDY_DEPLOY, POSTHOG_KEY } from '../../constants/constant';

const CONSENT_KEY = 'besser_analytics_consent';
const CONSENT_VERSION = '1.2';
const NOTICE_DISMISSED_KEY = 'besser_analytics_notice_dismissed';

export type ConsentStatus = 'pending' | 'accepted' | 'declined';

interface ConsentData {
  status: ConsentStatus;
  timestamp: string;
  version: string;
}

export const getConsentStatus = (): ConsentData | null => {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored) as ConsentData;
    if (data.version !== CONSENT_VERSION) return null;
    return data;
  } catch {
    return null;
  }
};

export const setConsentStatus = (status: ConsentStatus): boolean => {
  try {
    const data: ConsentData = {
      status,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

// Analytics are always active when PostHog is configured — no opt-out flow.
export const hasUserConsented = (): boolean => true;

export const initializePostHogWithConsent = (): void => {
  applyConsentToPostHog('accepted');
};

/**
 * Called by the study welcome dialog "I understand" button.
 * Records the participant's explicit acknowledgment and activates PostHog.
 */
export const acceptStudyConsent = (): void => {
  setConsentStatus('accepted');
  applyConsentToPostHog('accepted');
};

/**
 * Small passive info notice shown on non-study deployments when PostHog is
 * configured. Informs users that anonymous interaction data is collected.
 * No accept/decline — dismissing stores the choice in localStorage.
 *
 * In study mode (ENABLE_STUDY_DEPLOY=true) this renders nothing; the study
 * welcome dialog's "I understand" button handles consent via acceptStudyConsent().
 */
export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(NOTICE_DISMISSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    setIsMounted(true);
    applyConsentToPostHog('accepted');
  }, []);

  // Study mode: welcome dialog handles consent — render nothing here.
  // Also skip when PostHog is not configured or notice was already dismissed.
  if (ENABLE_STUDY_DEPLOY || !POSTHOG_KEY || dismissed || !isMounted) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(NOTICE_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 flex justify-center px-3"
      style={{ zIndex: Z_INDEX.OVERLAY }}
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-lg border border-border/80 bg-background/95 px-4 py-2.5 shadow-md backdrop-blur">
        <p className="flex-1 text-xs text-muted-foreground">
          {t('shared.cookie.notice.text')}{' '}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('shared.cookie.notice.policy')}
          </a>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default CookieConsentBanner;
