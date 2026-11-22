/** The GitHub settings of a linked project (autosave, push generated code), and the line that says how autosave stands. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useProject } from '../../../app/hooks/useProject';
import { track } from '../../../shared/services/analytics/events';
import { setProjectGitHubAutoSave, setProjectGitHubPushRuns } from '../../../shared/services/storage/projectGitHubLink';
import { useAutosaveStatus } from '../autosave/autosaveStatus';
import { useRepoSync } from '../hooks/useRepoSync';

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Turns "Autosave to GitHub" on or off for a linked project: from the project settings or the GitHub menu. */
export function setGitHubAutosave(projectId: string, enabled: boolean): void {
  setProjectGitHubAutoSave(projectId, enabled);
  track('settings_changed', { area: 'github', setting: 'autosave', value: enabled });
}

/** Turns "Push generated code to GitHub" on or off for a linked project: from the project settings or the GitHub menu. */
export function setGitHubPushRuns(projectId: string, enabled: boolean): void {
  setProjectGitHubPushRuns(projectId, enabled);
  track('settings_changed', { area: 'github', setting: 'push_runs', value: enabled });
}

/** One quiet line on how autosave stands for the project, or null when it is off. */
export function useAutosaveStatusText(projectId: string | null | undefined): string | null {
  const { t } = useTranslation();
  const status = useAutosaveStatus(projectId);
  switch (status.phase) {
    case 'off':
      return null;
    case 'saving':
      return t('github.autosave.status.saving', { defaultValue: 'Autosaving to GitHub…' });
    case 'paused':
      switch (status.pause) {
        case 'remote':
          return t('github.autosave.status.pausedRemote', {
            defaultValue: 'Autosave paused: there are new commits on GitHub. Get latest or Save and merge to resume.',
          });
        case 'conflict':
          return t('github.autosave.status.pausedConflict', {
            defaultValue: 'Autosave paused: a save could not be merged. Resolve its pull request, or stop tracking it, to resume.',
          });
        case 'auth':
          return t('github.autosave.status.pausedAuth', { defaultValue: 'Autosave paused: reconnect GitHub to resume.' });
        default:
          return t('github.autosave.status.pausedMissing', {
            defaultValue: 'Autosave paused: the repository or branch was not found on GitHub.',
          });
      }
    case 'error':
      return t('github.autosave.status.error', {
        defaultValue: 'Autosave could not reach GitHub. It tries again at {{time}}.',
        time: clock(status.retryAt ?? Date.now()),
      });
    default:
      return status.lastSavedAt
        ? t('github.autosave.status.saved', { defaultValue: 'Autosaved to GitHub at {{time}}', time: clock(status.lastSavedAt) })
        : t('github.autosave.status.on', { defaultValue: 'Autosave to GitHub is on' });
  }
}

/** Shown in the project settings once the project is linked to a repository. */
export const GitHubAutosaveSetting: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const { link, githubSession } = useRepoSync({ checkRemote: false });
  // Signed in in this tab: autosave commits with this tab's session.
  const isAuthenticated = !!githubSession;
  const statusText = useAutosaveStatusText(currentProject?.id);
  if (!currentProject || !link) return null;

  const checked = !!link.autoSave;
  const onChange = (next: boolean) => setGitHubAutosave(currentProject.id, next);

  return (
    <Card data-testid="github-autosave-setting">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <CloudUpload className="size-4 text-brand" />
          <CardTitle className="text-base">{t('github.autosave.title', { defaultValue: 'GitHub' })}</CardTitle>
        </div>
        <CardDescription>
          {t('github.autosave.description', {
            defaultValue: 'This project is linked to {{repo}} on {{branch}}.',
            repo: `${link.owner}/${link.repo}`,
            branch: link.branch,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <label
          htmlFor="github-autosave-toggle"
          className={`flex items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors ${
            isAuthenticated ? 'cursor-pointer hover:bg-muted/30' : 'cursor-not-allowed opacity-70'
          }`}
        >
          <div>
            <p className="text-sm font-medium">{t('github.autosave.label', { defaultValue: 'Autosave to GitHub' })}</p>
            <p className="text-xs text-muted-foreground">
              {isAuthenticated
                ? t('github.autosave.hint', {
                    defaultValue:
                      'Commits your model a few seconds after you stop editing, at most once a minute. It pauses when someone else pushed, so their work is never overwritten.',
                  })
                : t('github.autosave.signInHint', { defaultValue: 'Connect GitHub in this tab to autosave to the repository.' })}
            </p>
          </div>
          <Checkbox
            id="github-autosave-toggle"
            checked={checked && isAuthenticated}
            disabled={!isAuthenticated}
            data-testid="github-autosave-toggle"
            onCheckedChange={onChange}
          />
        </label>
        {checked && isAuthenticated && statusText && (
          <p role="status" className="px-1 text-xs text-muted-foreground" data-testid="github-autosave-status">
            {statusText}
          </p>
        )}
        <label
          htmlFor="github-push-runs-toggle"
          className={`flex items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors ${
            isAuthenticated ? 'cursor-pointer hover:bg-muted/30' : 'cursor-not-allowed opacity-70'
          }`}
        >
          <div>
            <p className="text-sm font-medium">{t('github.pushRuns.label', { defaultValue: 'Push generated code to GitHub' })}</p>
            <p className="text-xs text-muted-foreground">
              {isAuthenticated
                ? t('github.pushRuns.hint', {
                    defaultValue:
                      'When a Spec-Driven Agent run finishes, its code is committed to this repository and branch, merged with newer commits, so it is kept after the download expires.',
                  })
                : t('github.pushRuns.signInHint', { defaultValue: 'Connect GitHub in this tab to push generated code to the repository.' })}
            </p>
          </div>
          <Checkbox
            id="github-push-runs-toggle"
            checked={!!link.pushRuns && isAuthenticated}
            disabled={!isAuthenticated}
            data-testid="github-push-runs-toggle"
            onCheckedChange={(next) => setGitHubPushRuns(currentProject.id, next === true)}
          />
        </label>
      </CardContent>
    </Card>
  );
};
