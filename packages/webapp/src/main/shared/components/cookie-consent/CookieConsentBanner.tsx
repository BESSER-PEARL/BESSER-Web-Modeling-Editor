import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { applyConsentToPostHog } from '../../services/analytics/lazy-analytics';
import { getConsentStatus, setConsentStatus } from '../../services/analytics/analytics-consent';
import { Z_INDEX } from '../../constants/z-index';
import { ENABLE_STUDY_DEPLOY, POSTHOG_KEY } from '../../constants/constant';

/** Study participants acknowledge collection in the welcome dialog. */
export const acceptStudyConsent = (): boolean => {
  if (!setConsentStatus('accepted')) return false;
  applyConsentToPostHog('accepted');
  return true;
};

/** Ordinary deployments offer a real choice before analytics starts. */
export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(() => getConsentStatus());
  const [showChoices, setShowChoices] = useState(() => getConsentStatus() === null);
  const [error, setError] = useState(false);

  if (ENABLE_STUDY_DEPLOY || !POSTHOG_KEY) return null;

  const choose = (choice: 'accepted' | 'declined') => {
    if (!setConsentStatus(choice)) {
      setError(true);
      return;
    }
    applyConsentToPostHog(choice);
    setStatus(choice);
    setShowChoices(false);
  };

  if (!showChoices && status !== null) {
    return createPortal(
      <button type="button" onClick={() => { setError(false); setShowChoices(true); }}
        className="fixed bottom-3 left-3 rounded border border-border bg-background/95 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground"
        style={{ zIndex: Z_INDEX.OVERLAY }}>
        {t('shared.cookie.settingsButton')}
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-3 flex justify-center px-3" style={{ zIndex: Z_INDEX.OVERLAY }}>
      <div role="dialog" aria-label={t('shared.cookie.banner.title')} className="pointer-events-auto w-full max-w-lg rounded-lg border border-border/80 bg-background/95 p-4 shadow-md backdrop-blur">
        <h2 className="text-sm font-semibold">{t('shared.cookie.banner.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('shared.cookie.banner.limitedDescription')}</p>
        <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline">
          {t('shared.cookie.banner.posthogPrivacy')}
        </a>
        {error && <p role="alert" className="mt-2 text-xs text-destructive">{t('shared.cookie.banner.saveError')}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => choose('declined')} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted">
            {t('shared.cookie.banner.decline')}
          </button>
          <button type="button" onClick={() => choose('accepted')} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">
            {t('shared.cookie.banner.accept')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CookieConsentBanner;
