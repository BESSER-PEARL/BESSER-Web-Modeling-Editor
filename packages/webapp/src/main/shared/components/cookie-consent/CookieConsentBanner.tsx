import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { applyConsentToPostHog } from '../../services/analytics/lazy-analytics';
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

const CONSENT_KEY = 'besser_analytics_consent';
const CONSENT_VERSION = '1.2';

export type ConsentStatus = 'pending' | 'accepted' | 'declined';

interface ConsentData {
  status: ConsentStatus;
  timestamp: string;
  version: string;
}

export const getConsentStatus = (): ConsentData | null => {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as ConsentData;
    if (data.version !== CONSENT_VERSION) {
      return null;
    }

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

export const hasUserConsented = (): boolean => {
  return getConsentStatus()?.status === 'accepted';
};

export const initializePostHogWithConsent = (): void => {
  applyConsentToPostHog(hasUserConsented() ? 'accepted' : 'declined');
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
        enabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700',
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
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const forceBanner = new URLSearchParams(window.location.search).get('force_cookies') === '1';
    if (forceBanner) {
      setAnalyticsEnabled(false);
      setIsVisible(true);
      applyConsentToPostHog('declined');
      return;
    }

    const consent = getConsentStatus();
    if (!consent) {
      setConsentStatus('pending');
      setAnalyticsEnabled(false);
      setIsVisible(true);
      applyConsentToPostHog('declined');
      return;
    }

    setAnalyticsEnabled(consent.status === 'accepted');
    setIsVisible(consent.status === 'pending');
    applyConsentToPostHog(consent.status);
  }, []);

  const detailRows = useMemo(
    () => [
      t('shared.cookie.banner.rows.generators'),
      t('shared.cookie.banner.rows.diagramComplexity'),
      t('shared.cookie.banner.rows.assistantUsage'),
      t('shared.cookie.banner.rows.noContent'),
    ],
    [t],
  );

  const handleAccept = () => {
    setConsentStatus('accepted');
    applyConsentToPostHog('accepted');
    setAnalyticsEnabled(true);
    setIsVisible(false);
  };

  const handleDecline = () => {
    setConsentStatus('declined');
    applyConsentToPostHog('declined');
    setAnalyticsEnabled(false);
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    const nextStatus: ConsentStatus = analyticsEnabled ? 'accepted' : 'declined';
    setConsentStatus(nextStatus);
    applyConsentToPostHog(nextStatus);
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
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-3 flex justify-center px-3" style={{ zIndex: Z_INDEX.OVERLAY }}>
            <Card className="pointer-events-auto w-full max-w-[470px] border-border/80 bg-background/95 shadow-2xl backdrop-blur">
              <div className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Shield className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{t('shared.cookie.banner.title')}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {t('shared.cookie.banner.subtitle')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-[11px] text-primary hover:bg-transparent hover:text-primary/80"
                    onClick={() => setShowDetails((previous) => !previous)}
                  >
                    {showDetails ? (
                      <ChevronDown className="mr-1 size-3.5" />
                    ) : (
                      <ChevronRight className="mr-1 size-3.5" />
                    )}
                    {showDetails ? t('shared.cookie.banner.hideDetails') : t('shared.cookie.banner.details')}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={handleDecline}>
                      {t('shared.cookie.banner.decline')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => {
                        setIsVisible(false);
                        setShowSettings(true);
                      }}
                    >
                      {t('shared.cookie.banner.settings')}
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={handleAccept}>
                      {t('shared.cookie.banner.accept')}
                    </Button>
                  </div>
                </div>

                {showDetails && (
                  <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                    <ul className="flex flex-col gap-1.5">
                      {detailRows.map((row) => (
                        <li key={row} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 size-3 text-emerald-500" />
                          <span>{row}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1.5 h-auto p-0 text-[11px]"
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
    applyConsentToPostHog(nextStatus);
    setShowSettings(false);
  };

  return (
    <>
      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShowSettings(true)}>
        <Shield className="mr-1 size-3.5" />
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
