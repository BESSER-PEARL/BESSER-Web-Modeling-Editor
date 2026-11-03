import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { applyAnalyticsConsent } from '../../services/analytics/lazy-analytics';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '../../constants/z-index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type StoredAnalyticsConsent,
} from '../../services/storage/preferencesStorage';

const CONSENT_VERSION = '1.2';

export type ConsentStatus = StoredAnalyticsConsent['status'];

export const getConsentStatus = (): StoredAnalyticsConsent | null => {
  const data = readAnalyticsConsent();
  return data?.version === CONSENT_VERSION ? data : null;
};

export const setConsentStatus = (status: ConsentStatus): boolean =>
  writeAnalyticsConsent({ status, timestamp: new Date().toISOString(), version: CONSENT_VERSION });

export const hasUserConsented = (): boolean => {
  return getConsentStatus()?.status === 'accepted';
};

const Toggle: React.FC<{ enabled: boolean; disabled?: boolean; onToggle?: () => void }> = ({
  enabled,
  disabled = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={enabled ? t('shared.cookie.toggleDisable') : t('shared.cookie.toggleEnable')}
      aria-pressed={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 rounded-full border transition-colors',
        enabled ? 'border-success bg-success' : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
};

const PrivacyPolicyContent: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-h-[60vh] flex flex-col gap-5 overflow-y-auto pr-1 text-sm leading-6 text-muted-foreground">
      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">{t('shared.cookie.privacy.aboutTitle')}</h4>
        <p>{t('shared.cookie.privacy.aboutBody')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">{t('shared.cookie.privacy.collectTitle')}</h4>
        <ul className="list-disc flex flex-col gap-1 pl-5">
          <li>{t('shared.cookie.privacy.collect.usage')}</li>
          <li>{t('shared.cookie.privacy.collect.metrics')}</li>
          <li>{t('shared.cookie.privacy.collect.assistant')}</li>
          <li>{t('shared.cookie.privacy.collect.session')}</li>
          <li>{t('shared.cookie.privacy.collect.visits')}</li>
          <li>{t('shared.cookie.privacy.collect.errors')}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">{t('shared.cookie.privacy.noCollectTitle')}</h4>
        <ul className="list-disc flex flex-col gap-1 pl-5">
          <li>{t('shared.cookie.privacy.noCollect.identity')}</li>
          <li>{t('shared.cookie.privacy.noCollect.content')}</li>
          <li>{t('shared.cookie.privacy.noCollect.recordings')}</li>
          <li>{t('shared.cookie.privacy.noCollect.names')}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">{t('shared.cookie.privacy.useTitle')}</h4>
        <p>{t('shared.cookie.privacy.useBody')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">{t('shared.cookie.privacy.providerTitle')}</h4>
        <p>
          {t('shared.cookie.privacy.providerIntro')}{' '}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('shared.cookie.privacy.providerLinkText')}
          </a>
          .
        </p>
        <p>
          {t('shared.cookie.privacy.errorProviderIntro')}{' '}
          <a
            href="https://sentry.io/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('shared.cookie.privacy.errorProviderLinkText')}
          </a>
          .
        </p>
        <p>
          {t('shared.cookie.privacy.visitProviderIntro')}{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('shared.cookie.privacy.visitProviderLinkText')}
          </a>
          .
        </p>
      </section>
    </div>
  );
};

const CookieSettingsContent: React.FC<{
  analyticsEnabled: boolean;
  onToggleAnalytics: () => void;
  onCancel: () => void;
  onSave: () => void;
}> = ({ analyticsEnabled, onToggleAnalytics, onCancel, onSave }) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{t('shared.cookie.settings.essentialTitle')}</p>
              <Badge variant="secondary" size="sm" className="uppercase tracking-wide">
                {t('shared.cookie.settings.requiredBadge')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t('shared.cookie.settings.essentialDesc')}</p>
          </div>
          <Toggle enabled disabled />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">{t('shared.cookie.settings.analyticsTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('shared.cookie.settings.analyticsDesc')}
            </p>
          </div>
          <Toggle enabled={analyticsEnabled} onToggle={onToggleAnalytics} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onSave}>{t('shared.cookie.settings.savePreferences')}</Button>
      </DialogFooter>
    </>
  );
};

export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  // Wait until no dialog is open (e.g. the first-run landing), so the banner never covers it.
  // Analytics stay declined while consent is pending, so deferring the banner is safe.
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const check = () => setDialogOpen(Boolean(document.querySelector('[role="dialog"][data-state="open"]')));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    const forceBanner = new URLSearchParams(window.location.search).get('force_cookies') === '1';
    if (forceBanner) {
      setAnalyticsEnabled(false);
      setIsVisible(true);
      applyAnalyticsConsent('declined');
      return;
    }

    const consent = getConsentStatus();
    if (!consent) {
      setConsentStatus('pending');
      setAnalyticsEnabled(false);
      setIsVisible(true);
      applyAnalyticsConsent('declined');
      return;
    }

    setAnalyticsEnabled(consent.status === 'accepted');
    setIsVisible(consent.status === 'pending');
    applyAnalyticsConsent(consent.status);
  }, []);

  const detailRows = useMemo(
    () => [
      t('shared.cookie.banner.rows.generators'),
      t('shared.cookie.banner.rows.diagramComplexity'),
      t('shared.cookie.banner.rows.assistantUsage'),
      t('shared.cookie.banner.rows.errorReports'),
      t('shared.cookie.banner.rows.visitStats'),
      t('shared.cookie.banner.rows.noContent'),
    ],
    [t],
  );

  const handleAccept = () => {
    setConsentStatus('accepted');
    applyAnalyticsConsent('accepted');
    setAnalyticsEnabled(true);
    setIsVisible(false);
  };

  const handleDecline = () => {
    setConsentStatus('declined');
    applyAnalyticsConsent('declined');
    setAnalyticsEnabled(false);
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    const nextStatus: ConsentStatus = analyticsEnabled ? 'accepted' : 'declined';
    setConsentStatus(nextStatus);
    applyAnalyticsConsent(nextStatus);
    setIsVisible(false);
    setShowSettings(false);
  };

  const handleSettingsCancel = () => {
    setShowSettings(false);
    if (getConsentStatus()?.status === 'pending') {
      setIsVisible(true);
    }
  };

  return (
    <>
      {isMounted &&
        isVisible &&
        !dialogOpen &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-3 flex justify-center px-3" style={{ zIndex: Z_INDEX.OVERLAY }}>
            <Card className="pointer-events-auto w-full max-w-[470px] border-border/80 bg-background/95 shadow-elevation-3 backdrop-blur">
              <div className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Shield className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{t('shared.cookie.banner.title')}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t('shared.cookie.banner.subtitle')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
                    onClick={() => setShowDetails((previous) => !previous)}
                  >
                    {showDetails ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    {showDetails ? t('shared.cookie.banner.hideDetails') : t('shared.cookie.banner.details')}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="px-3" onClick={handleDecline}>
                      {t('shared.cookie.banner.decline')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-3"
                      onClick={() => {
                        setIsVisible(false);
                        setShowSettings(true);
                      }}
                    >
                      {t('shared.cookie.banner.settings')}
                    </Button>
                    <Button size="sm" className="px-3" onClick={handleAccept}>
                      {t('shared.cookie.banner.accept')}
                    </Button>
                  </div>
                </div>

                {showDetails && (
                  <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground">
                    <ul className="flex flex-col gap-1.5">
                      {detailRows.map((row) => (
                        <li key={row} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 size-3 text-success" />
                          <span>{row}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1.5 h-auto p-0 text-xs"
                      onClick={() => setShowPrivacy(true)}
                    >
                      {t('shared.cookie.banner.privacyPolicy')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>,
          document.body,
        )}

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('shared.cookie.settingsTitle')}</DialogTitle>
            <DialogDescription>{t('shared.cookie.settingsDesc')}</DialogDescription>
          </DialogHeader>
          <CookieSettingsContent
            analyticsEnabled={analyticsEnabled}
            onToggleAnalytics={() => setAnalyticsEnabled((previous) => !previous)}
            onCancel={handleSettingsCancel}
            onSave={handleSaveSettings}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('shared.cookie.policyTitle')}</DialogTitle>
            <DialogDescription>{t('shared.cookie.policyDesc')}</DialogDescription>
          </DialogHeader>
          <PrivacyPolicyContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrivacy(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const PrivacySettingsButton: React.FC = () => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(hasUserConsented());

  useEffect(() => {
    if (!showSettings) {
      return;
    }
    setAnalyticsEnabled(hasUserConsented());
  }, [showSettings]);

  const handleSave = () => {
    const nextStatus: ConsentStatus = analyticsEnabled ? 'accepted' : 'declined';
    setConsentStatus(nextStatus);
    applyAnalyticsConsent(nextStatus);
    setShowSettings(false);
  };

  return (
    <>
      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShowSettings(true)}>
        <Shield className="size-3.5" />
        {t('shared.cookie.settingsButton')}
      </Button>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('shared.cookie.settingsTitle')}</DialogTitle>
            <DialogDescription>{t('shared.cookie.settingsDesc')}</DialogDescription>
          </DialogHeader>
          <CookieSettingsContent
            analyticsEnabled={analyticsEnabled}
            onToggleAnalytics={() => setAnalyticsEnabled((previous) => !previous)}
            onCancel={() => setShowSettings(false)}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsentBanner;
