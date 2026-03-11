import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  return (
    <button
      type="button"
      aria-label={enabled ? 'Disable analytics' : 'Enable analytics'}
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
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
};

const PrivacyPolicyContent: React.FC = () => {
  return (
    <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 text-sm leading-6 text-muted-foreground">
      <section className="space-y-2">
        <h4 className="font-semibold text-foreground">About BESSER</h4>
        <p>
          BESSER (Better Smart Software Faster) is an open-source low-code platform developed by the Software Engineering
          Research Group at LIST (Luxembourg Institute of Science and Technology).
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-foreground">Data We Collect</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Feature usage (generators and diagram workflows)</li>
          <li>Model metrics (size and structure counts)</li>
          <li>AI assistant usage counts (not content)</li>
          <li>Anonymous session metadata</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-foreground">Data We Do Not Collect</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Personal identity data (name, email)</li>
          <li>Diagram/model content</li>
          <li>Screen recordings or session replay</li>
          <li>Project names and diagram titles</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-foreground">How We Use Data</h4>
        <p>
          Analytics is used only to improve product quality and prioritize feature development. It is not used for marketing or
          resale.
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-foreground">Provider</h4>
        <p>
          We use PostHog (EU-hosted). See{' '}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            PostHog Privacy Policy
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
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Essential Cookies</p>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Required for editor functionality and local preferences.</p>
          </div>
          <Toggle enabled disabled />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Analytics</p>
            <p className="text-xs text-muted-foreground">
              Anonymous usage metrics to improve generators, workflows, and UX quality.
            </p>
          </div>
          <Toggle enabled={analyticsEnabled} onToggle={onToggleAnalytics} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>Save Preferences</Button>
      </DialogFooter>
    </>
  );
};

export const CookieConsentBanner: React.FC = () => {
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
      'Code generators used',
      'Diagram type and model complexity',
      'AI assistant usage count',
      'No model content or personal data',
    ],
    [],
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
              <div className="space-y-2.5 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Shield className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">Analytics Cookies</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Anonymous analytics to improve BESSER.
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
                      <ChevronDown className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="mr-1 h-3.5 w-3.5" />
                    )}
                    {showDetails ? 'Hide details' : 'Details'}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={handleDecline}>
                      Decline
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
                      Settings
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={handleAccept}>
                      Accept
                    </Button>
                  </div>
                </div>

                {showDetails && (
                  <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                    <ul className="space-y-1.5">
                      {detailRows.map((row) => (
                        <li key={row} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 text-emerald-500" />
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
                      Privacy Policy
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
            <DialogTitle>Privacy Settings</DialogTitle>
            <DialogDescription>Manage analytics preferences for this browser.</DialogDescription>
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
            <DialogTitle>Privacy Policy</DialogTitle>
            <DialogDescription>Summary of analytics data handling in BESSER.</DialogDescription>
          </DialogHeader>
          <PrivacyPolicyContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrivacy(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const PrivacySettingsButton: React.FC = () => {
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
        <Shield className="mr-1 h-3.5 w-3.5" />
        Privacy Settings
      </Button>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Privacy Settings</DialogTitle>
            <DialogDescription>Manage analytics preferences for this browser.</DialogDescription>
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
