import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '../../shared/api/api-client';
import { getLabHome, type LabHomeResponse, type LabUserView } from '../../shared/api/lab';
import { useGitHubAuth } from '../../shared/hooks/useGitHubAuth';
import { resolveLabEnabled } from '../../shared/services/labConfig';
import { isNetworkError } from '../../shared/utils/describeNetworkError';
import { LabRefused, takeLabRefusal } from './LabRefused';
import { LabSignIn } from './LabSignIn';

/** HTTP statuses of the lab routes that change the whole screen (`dependencies.py`, `lab_router.py`). */
const STATUS_LAB_OFF = 404;
const STATUS_NOT_ALLOWED = 403;
const STATUS_NOT_READY = 503;

/** What every signed-in lab screen shares: the session, the user, the home's data and the breadcrumb. */
export interface LabShell {
  /** The `X-GitHub-Session` of the signed-in, allowed login. */
  session: string;
  user: LabUserView;
  /** The last `GET /lab/home`: bases, runs in progress, this month's meters. */
  home: LabHomeResponse;
  /** Reads `GET /lab/home` again; rejects with the request's error (the shown data stays). */
  reloadHome: () => Promise<void>;
  /** The title the header shows after "Changes" (the open change's), or null. */
  breadcrumb: string | null;
  setBreadcrumb: (title: string | null) => void;
  signOut: () => void;
}

const LabShellContext = createContext<LabShell | null>(null);

/** The lab shell of the signed-in user; only inside {@link LabAuthGate}. */
export function useLabShell(): LabShell {
  const shell = useContext(LabShellContext);
  if (!shell) throw new Error('useLabShell is used outside LabAuthGate');
  return shell;
}

type ConfigState = 'loading' | 'unreachable' | 'off' | 'on';
type HomeState =
  | { status: 'loading' }
  | { status: 'ready'; home: LabHomeResponse }
  | { status: 'failed'; error: unknown };

/** A whole-screen message, centred. */
export const LabScreenNote: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <div
    data-testid={testId}
    className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center text-sm text-muted-foreground"
  >
    {children}
  </div>
);

/**
 * Lets a user into the lab: the server must run the lab (`/spec-driven/config`), the tab must hold a
 * GitHub session, and `GET /lab/home` must accept its login. Shows the whole-screen state for each
 * step (loading, unreachable, lab off, working copies not ready, sign in, not allowed) and provides
 * {@link LabShell} to its children.
 */
export const LabAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  // Read before the GitHub sign-in starts: it would report the `?error=` as a failed sign-in.
  const [refused] = useState(takeLabRefusal);
  const { status, username, githubSession, logout } = useGitHubAuth();
  const [config, setConfig] = useState<ConfigState>('loading');
  const [home, setHome] = useState<HomeState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConfig('loading');
    void resolveLabEnabled().then((enabled) => {
      if (!cancelled) setConfig(enabled === null ? 'unreachable' : enabled ? 'on' : 'off');
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (config !== 'on' || !githubSession) return;
    let cancelled = false;
    setHome({ status: 'loading' });
    getLabHome(githubSession).then(
      (value) => !cancelled && setHome({ status: 'ready', home: value }),
      (error: unknown) => !cancelled && setHome({ status: 'failed', error }),
    );
    return () => {
      cancelled = true;
    };
  }, [config, githubSession, attempt]);

  const reloadHome = useCallback(async () => {
    if (!githubSession) return;
    const value = await getLabHome(githubSession);
    setHome({ status: 'ready', home: value });
  }, [githubSession]);

  const signOut = useCallback(() => {
    void logout();
  }, [logout]);

  const retry = () => setAttempt((n) => n + 1);

  const shell = useMemo<LabShell | null>(
    () =>
      home.status === 'ready' && githubSession
        ? { session: githubSession, user: home.home.user, home: home.home, reloadHome, breadcrumb, setBreadcrumb, signOut }
        : null,
    [home, githubSession, reloadHome, breadcrumb, signOut],
  );

  if (refused) return <LabRefused login={refused.login} />;

  const loading = (
    <LabScreenNote testId="lab-loading">
      <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
      <span role="status">{t('lab.app.gate.loading', { defaultValue: 'Opening BESSER Forge…' })}</span>
    </LabScreenNote>
  );
  const unreachable = (
    <LabScreenNote testId="lab-unreachable">
      <p>{t('lab.app.gate.unreachable', { defaultValue: 'The lab server could not be reached.' })}</p>
      <Button variant="outline" onClick={retry}>
        {t('lab.app.gate.retry', { defaultValue: 'Try again' })}
      </Button>
    </LabScreenNote>
  );
  const off = (
    <LabScreenNote testId="lab-off">
      <p>{t('lab.app.gate.off', { defaultValue: 'This server does not run BESSER Forge.' })}</p>
    </LabScreenNote>
  );

  if (config === 'loading') return loading;
  if (config === 'unreachable') return unreachable;
  if (config === 'off') return off;
  if (status === 'checking') return loading;
  if (!githubSession) return <LabSignIn />;

  if (home.status === 'loading') return loading;
  if (home.status === 'failed') {
    const { error } = home;
    if (error instanceof ApiError && error.status === STATUS_NOT_READY) {
      return (
        <LabScreenNote testId="lab-not-ready">
          <p className="max-w-lg">
            {t('lab.app.gate.notReady', {
              defaultValue: "The lab's working copies are not ready: {{detail}}. An administrator needs to run the lab setup.",
              detail: error.detail ?? error.message,
            })}
          </p>
          <Button variant="outline" onClick={retry}>
            {t('lab.app.gate.retry', { defaultValue: 'Try again' })}
          </Button>
        </LabScreenNote>
      );
    }
    if (error instanceof ApiError && error.status === STATUS_LAB_OFF) return off;
    if (error instanceof ApiError && error.status === STATUS_NOT_ALLOWED) return <LabRefused login={username} />;
    if (isNetworkError(error)) return unreachable;
    return (
      <LabScreenNote testId="lab-failed">
        <p className="max-w-lg">
          {t('lab.app.gate.failed', {
            defaultValue: 'The lab could not be opened: {{error}}',
            error: error instanceof Error ? error.message : String(error),
          })}
        </p>
        <Button variant="outline" onClick={retry}>
          {t('lab.app.gate.retry', { defaultValue: 'Try again' })}
        </Button>
      </LabScreenNote>
    );
  }

  return <LabShellContext.Provider value={shell}>{children}</LabShellContext.Provider>;
};
