/**
 * Save a deterministic generator's output to GitHub.
 *
 * The push dialog pushes a run the server stores, and a deterministic
 * generator (e.g. SQL) leaves none: its output goes straight to the browser.
 * This stores that output as a run first, so the result card can open the same
 * "Save to GitHub" dialog a Spec-Driven run gets (BESSER-PEARL/BESSER#748).
 */
import { toast } from 'react-toastify';
import { ApiError } from '../../api/api-client';
import { importGeneratedCode } from '../../api/github';
import i18n from '../../i18n';
import { errorProperties, track } from '../analytics/events';
import { reportError } from '../errors/reportError';
import { getGitHubSession } from './githubAuth';

/**
 * Store `file` as a run to push; resolves to its run id, or null when it could not be stored (the user is told why).
 * Signing in reloads the page, which loses the file, so without a session this asks to connect first.
 */
export async function storeGeneratedCodeForPush(file: Blob, fileName: string): Promise<string | null> {
  const session = getGitHubSession();
  if (!session) {
    track('github_push_failed', { code: 'no_session' });
    toast.info(
      i18n.t('github.push.toasts.connectFirstGenerated', {
        defaultValue: 'Connect GitHub in the GitHub menu, then generate the code again to save it there.',
      }),
    );
    return null;
  }
  try {
    return await importGeneratedCode(session, file, fileName);
  } catch (error) {
    const expired = error instanceof ApiError && error.status === 401;
    track('github_push_failed', { code: expired ? 'auth' : 'upload_failed', ...errorProperties(error) });
    reportError(
      expired
        ? i18n.t('github.push.errors.auth', { defaultValue: 'Your GitHub session expired. Reconnect and try again.' })
        : i18n.t('github.push.toasts.uploadFailed', {
            defaultValue: 'Could not prepare the generated code for GitHub: {{detail}}',
            detail: error instanceof Error ? error.message : String(error),
          }),
      { error },
    );
    return null;
  }
}
