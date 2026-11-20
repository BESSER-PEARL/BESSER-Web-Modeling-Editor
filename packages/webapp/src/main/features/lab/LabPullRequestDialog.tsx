import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitPullRequest, Loader2 } from 'lucide-react';
import { LabPullRequestFailure, labRepoName } from '@/components/chatbot-kit/ui/lab-run-result';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  openLabPullRequests,
  type LabIssue,
  type LabIssueRef,
  type LabPullRequestsResponse,
  type LabRepoKey,
} from '../../shared/api/lab';

const REPO_KEYS: readonly LabRepoKey[] = ['besser', 'frontend', 'modeling_agent'];

/** `LabIssue.repo` is a plain string in the API model; the request takes the repository key. */
const repoKey = (repo: string): LabRepoKey | null => (REPO_KEYS as readonly string[]).includes(repo) ? (repo as LabRepoKey) : null;

const issueKey = (issue: { repo: string; number: number }) => `${issue.repo}#${issue.number}`;

export interface LabPullRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  githubSession: string;
  changeId: string;
  /** The default title: the plan's. */
  title: string;
  /** The issues the change records; ticked ones go in `closesIssues`. */
  issues: LabIssue[];
  /** Called with the server's answer once the pull requests are open. */
  onOpened: (response: LabPullRequestsResponse) => void;
}

/**
 * Opens the change's draft pull requests: one per repository it touches, with a title (the plan's by default)
 * and the change's issues as "Closes" checkboxes. GitHub closes a ticked issue when the change reaches master or
 * main at release, which the dialog says; an unticked one is listed as related. A failure stays in the dialog.
 */
export const LabPullRequestDialog: React.FC<LabPullRequestDialogProps> = ({
  open,
  onOpenChange,
  githubSession,
  changeId,
  title,
  issues,
  onOpened,
}) => {
  const { t } = useTranslation();
  const [draftTitle, setDraftTitle] = useState(title);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  // Each opening starts from the change as it is now: the plan's title and the ticks it stores.
  useEffect(() => {
    if (!open) return;
    setDraftTitle(title);
    setTicked(new Set(issues.filter((issue) => issue.closes).map(issueKey)));
    setFailure(null);
    // Only on opening: a re-read of the change while the dialog is open must not overwrite the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const closesIssues: LabIssueRef[] = [];
    for (const issue of issues) {
      if (!ticked.has(issueKey(issue))) continue;
      const repo = repoKey(issue.repo);
      if (repo) closesIssues.push({ repo, number: issue.number });
      else console.warn(`[lab] issue ${issueKey(issue)} names an unknown repository; it is not sent as closed`);
    }
    setBusy(true);
    setFailure(null);
    try {
      const response = await openLabPullRequests(githubSession, changeId, {
        title: draftTitle.trim() || null,
        closesIssues,
      });
      onOpened(response);
      onOpenChange(false);
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('lab.pullRequest.title', { defaultValue: 'Open pull request' })}</DialogTitle>
            <DialogDescription>
              {t('lab.pullRequest.description', {
                defaultValue:
                  'The lab pushes the change and opens one draft pull request per repository it touches. Nothing is merged without a person.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="lab-pull-request-title">{t('lab.pullRequest.titleLabel', { defaultValue: 'Title' })}</Label>
            <Input
              id="lab-pull-request-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              disabled={busy}
            />
          </div>

          {issues.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                {t('lab.pullRequest.issues', { defaultValue: 'Issues' })}
              </legend>
              <ul className="space-y-1.5">
                {issues.map((issue) => {
                  const key = issueKey(issue);
                  const id = `lab-pull-request-closes-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
                  return (
                    <li key={key} className="flex items-start gap-2.5">
                      <Checkbox
                        id={id}
                        checked={ticked.has(key)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setTicked((previous) => {
                            const next = new Set(previous);
                            if (checked === true) next.add(key);
                            else next.delete(key);
                            return next;
                          })
                        }
                        className="mt-0.5"
                      />
                      <Label htmlFor={id} className="min-w-0 font-normal leading-snug">
                        {t('lab.pullRequest.closes', {
                          defaultValue: 'Closes {{repo}} #{{number}}: {{title}}',
                          repo: labRepoName(t, issue.repo),
                          number: issue.number,
                          title: issue.title,
                        })}
                      </Label>
                    </li>
                  );
                })}
              </ul>
              <p data-testid="lab-pull-request-release-note" className="text-xs text-muted-foreground">
                {t('lab.pullRequest.releaseNote', {
                  defaultValue:
                    'GitHub closes the issue when this reaches master/main (at release), not when it merges into development.',
                })}
              </p>
            </fieldset>
          )}

          {failure && <LabPullRequestFailure error={failure.error} className="text-sm" />}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              {t('lab.pullRequest.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <GitPullRequest aria-hidden />}
              {busy
                ? t('lab.pullRequest.opening', { defaultValue: 'Opening...' })
                : t('lab.pullRequest.submit', { defaultValue: 'Open draft pull requests' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
