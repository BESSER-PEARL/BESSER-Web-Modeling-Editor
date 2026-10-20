/**
 * One-time "star us on GitHub" prompt.
 *
 * Shown after the user's first successful code generation, the moment they
 * have just gotten value out of BESSER. Once per browser: a `localStorage`
 * flag records that it was shown, or that the user is already known to have
 * starred. When storage is unavailable the prompt is skipped rather than
 * risking it on every generation.
 */
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { localStorageGitHubStarPrompted } from '../constants/constant';
import i18n from '../i18n';

const BESSER_REPO_URL = 'https://github.com/BESSER-PEARL/BESSER';

/** Twice the default toast lifetime, so it is not missed. */
const STAR_PROMPT_AUTO_CLOSE_MS = 10000;

/** Record that the prompt must not appear (already shown, or already starred). */
export const markGitHubStarPromptDone = (): void => {
  try {
    window.localStorage.setItem(localStorageGitHubStarPrompted, 'true');
  } catch {
    // Storage unavailable: nothing to remember.
  }
};

/**
 * Show the star prompt unless this browser has already had it. The flag is
 * written before the toast, so a storage that rejects the write skips the
 * prompt instead of repeating it.
 */
export const promptForGitHubStarOnce = (): void => {
  try {
    if (window.localStorage.getItem(localStorageGitHubStarPrompted)) return;
    window.localStorage.setItem(localStorageGitHubStarPrompted, 'true');
  } catch {
    return;
  }

  toast.info(
    <div className="flex flex-col items-start gap-2">
      <p>{i18n.t('github.toasts.starPrompt')}</p>
      <Button asChild size="xs" variant="outline">
        <a href={BESSER_REPO_URL} target="_blank" rel="noopener noreferrer">
          {i18n.t('github.toasts.starPromptAction')}
        </a>
      </Button>
    </div>,
    { autoClose: STAR_PROMPT_AUTO_CLOSE_MS },
  );
};
