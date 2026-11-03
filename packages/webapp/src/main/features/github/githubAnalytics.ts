import {
  errorProperties,
  track,
  type AnalyticsEvents,
  type GitHubAction,
} from '../../shared/services/analytics/events';

export type GitHubActionDetails = Omit<AnalyticsEvents['github_action_completed'], 'action'>;

/**
 * Run one GitHub action and report its outcome. A failure is reported, then
 * rethrown so the caller still shows it to the user.
 */
export async function trackGitHubAction<T>(
  action: GitHubAction,
  run: () => Promise<T> | T,
  describe?: (result: T) => GitHubActionDetails,
): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (error) {
    track('github_action_failed', { action, ...errorProperties(error) });
    throw error;
  }
  track('github_action_completed', { action, ...describe?.(result) });
  return result;
}
