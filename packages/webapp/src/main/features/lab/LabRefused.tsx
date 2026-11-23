import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BACKEND_URL } from '../../shared/constants/constant';
import { LabEntryColumn } from './LabSignIn';

/** The public editor, for someone the lab does not let in. */
const PUBLIC_EDITOR_URL = 'https://editor.besser-pearl.org';

/** The sign-in callback's refusal: `?error=not_allowed#login=<login>` (BESSER `github_oauth.py`). */
const REFUSAL_ERROR = 'not_allowed';

const isGitHubLogin = (value: string) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(value);

/**
 * The sign-in refusal in the address bar, read once and then removed from it (the login is in the
 * fragment so no server logs it; it should not stay in the history either). Null when the address
 * is not a refusal. `login` is null when the fragment holds no valid GitHub login.
 */
export function takeLabRefusal(): { login: string | null } | null {
  const query = new URLSearchParams(window.location.search);
  if (query.get('error') !== REFUSAL_ERROR) return null;
  const login = new URLSearchParams(window.location.hash.slice(1)).get('login');
  window.history.replaceState(window.history.state, document.title, window.location.pathname);
  return { login: login && isGitHubLogin(login) ? login : null };
}

/**
 * GitHub's sign-in with its account chooser (`prompt=select_account`, passed on by the backend).
 * `signInWithGitHub` takes no prompt, so the lab builds the same URL with it.
 */
function signInWithAnotherAccount(): void {
  window.location.href = `${BACKEND_URL}/github/auth/login?prompt=select_account`;
}

/** A login the lab does not allow: who the lab is for, another sign-in, or the public editor. */
export const LabRefused: React.FC<{ login: string | null }> = ({ login }) => {
  const { t } = useTranslation();
  return (
    <LabEntryColumn testId="lab-refused">
      <p className="lab-rise lab-d1 ui-kicker text-brand">{t('lab.app.signIn.kicker', { defaultValue: 'BESSER FORGE' })}</p>
      <h1 className="lab-rise lab-d2 mt-3 font-display text-4xl leading-[1.05] tracking-tight text-foreground">
        {t('lab.app.refused.heading', { defaultValue: 'This lab is for the BESSER team' })}
      </h1>
      <p className="lab-rise lab-d3 mt-4 text-muted-foreground">
        {login
          ? t('lab.app.refused.body', {
              defaultValue:
                "@{{login}} is not on this lab's list of GitHub logins. Ask a lab administrator to add you, or sign in with another account.",
              login,
            })
          : t('lab.app.refused.bodyNoLogin', {
              defaultValue:
                "Your GitHub login is not on this lab's list. Ask a lab administrator to add you, or sign in with another account.",
            })}
      </p>
      <div className="lab-rise lab-d4 mt-7 flex flex-wrap gap-3">
        <Button onClick={signInWithAnotherAccount}>
          <Github className="size-4" aria-hidden />
          {t('lab.app.refused.anotherAccount', { defaultValue: 'Sign in with another account' })}
        </Button>
        <Button variant="outline" asChild>
          <a href={PUBLIC_EDITOR_URL}>
            {t('lab.app.refused.publicEditor', { defaultValue: 'Open the public editor' })}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        {t('lab.app.refused.note', {
          defaultValue: 'GitHub offers the accounts signed in on this browser: to use another one, sign in to it on github.com first.',
        })}
      </p>
    </LabEntryColumn>
  );
};
