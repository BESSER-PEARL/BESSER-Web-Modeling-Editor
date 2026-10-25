import { ENABLE_STUDY_DEPLOY } from '../../constants/constant';

export type ConsentStatus = 'accepted' | 'declined';

const CONSENT_VERSION = '2.0';
const consentKey = () => ENABLE_STUDY_DEPLOY ? 'besser_analytics_consent_study' : 'besser_analytics_consent';

export const getConsentStatus = (): ConsentStatus | null => {
  try {
    const stored = localStorage.getItem(consentKey());
    if (!stored) return null;
    const data = JSON.parse(stored) as { status?: unknown; version?: unknown };
    return data.version === CONSENT_VERSION && (data.status === 'accepted' || data.status === 'declined')
      ? data.status : null;
  } catch {
    return null;
  }
};

export const setConsentStatus = (status: ConsentStatus): boolean => {
  try {
    localStorage.setItem(consentKey(), JSON.stringify({ status, version: CONSENT_VERSION, timestamp: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
};

export const hasUserConsented = (): boolean => getConsentStatus() === 'accepted';
