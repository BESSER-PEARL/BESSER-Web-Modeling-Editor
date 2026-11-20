import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, FileDiff } from 'lucide-react';
import type { LabReviewActionHandler } from '@/components/chatbot-kit/ui/chat-message';
import type { LabDiffFileRef } from '@/components/chatbot-kit/ui/lab-changes-dialog';
import { LabReviewCard } from '@/components/chatbot-kit/ui/lab-review-card';
import { LabRunResult, type LabChangeAction } from '@/components/chatbot-kit/ui/lab-run-result';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  getLabDiff,
  getLabReview,
  labRefusal,
  type LabChangeDetail,
  type LabRepoKey,
  type LabReviewResponse,
} from '../../shared/api/lab';
import type { SpecDrivenMessageState } from '../spec-driven';

type SpecDrivenLabView = NonNullable<SpecDrivenMessageState['lab']>;

// Lazy: react-diff-view and its stylesheet load only when the dialog first opens.
const LabChangesDialog = React.lazy(() => import('@/components/chatbot-kit/ui/lab-changes-dialog'));

const REPO_KEYS: readonly string[] = ['besser', 'frontend', 'modeling_agent'];

/** The run card's view of the change's last build (`LabChangeDetail.view`), which the Changes tab shows in full. */
function buildView(change: LabChangeDetail): SpecDrivenLabView | null {
  const view = change.view;
  if (!view || view.step !== 'build') return null;
  const { step, changeId, title, kind, repoChanges, checks, checklist, summary, stopReason } = view;
  return { step, changeId, title, kind, plan: null, repoChanges, checks, checklist, summary, stopReason, finalText: '' };
}

export interface LabChangesTabProps {
  change: LabChangeDetail;
  githubSession: string;
  /** The tab is shown: only then is the review status read. */
  visible: boolean;
  /** The diff dialog, opened by "View changes" here or by a card's view request. */
  diff: { open: boolean; file?: LabDiffFileRef };
  onDiffChange: (diff: { open: boolean; file?: LabDiffFileRef }) => void;
  /** Sends the dialog's line comments to the lab agent as a chat message. */
  onSendComments: (text: string) => void;
  /** "Push to the pull requests" of the build's card (the chat's handler); its "Open pull request" asks for the dialog. */
  onOpenPullRequest?: LabChangeAction;
  onReviewAction: LabReviewActionHandler;
}

/**
 * The Changes tab of a change: its pull requests as GitHub reports them (`GET /lab/review`), and its last build in
 * full (the agent's account, the files per repository, the checks with their durations and the checklist), with
 * "View changes" opening the diff, whose line comments go to the lab agent as the next message.
 */
export const LabChangesTab: React.FC<LabChangesTabProps> = ({
  change,
  githubSession,
  visible,
  diff,
  onDiffChange,
  onSendComments,
  onOpenPullRequest,
  onReviewAction,
}) => {
  const { t } = useTranslation();
  const [review, setReview] = useState<LabReviewResponse | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const hasPullRequests = change.pullRequests.length > 0;
  const view = buildView(change);
  // Mounted from the first opening on, so the dialog keeps its draft comments when closed.
  const [dialogMounted, setDialogMounted] = useState(diff.open);
  if (diff.open && !dialogMounted) setDialogMounted(true);

  // Read again when the tab is shown and whenever the change moved (a push, a build, a close).
  useEffect(() => {
    if (!visible || !hasPullRequests) return undefined;
    let alive = true;
    getLabReview(githubSession, change.changeId).then(
      (next) => {
        if (!alive) return;
        setReview(next);
        setReviewError(null);
      },
      (error: unknown) => {
        if (!alive) return;
        console.warn(`[lab] the review of change ${change.changeId} could not be read`, error);
        setReviewError(labRefusal(error).message);
      },
    );
    return () => {
      alive = false;
    };
  }, [visible, hasPullRequests, githubSession, change.changeId, change.updatedAt]);

  const load = useCallback(
    (file?: LabDiffFileRef) => {
      if (file && !REPO_KEYS.includes(file.repo)) {
        return Promise.reject(new Error(t('lab.change.unknownRepo', { defaultValue: 'Unknown repository: {{repo}}', repo: file.repo })));
      }
      // Narrowed above: the diff names its repositories by key (`LabRepoDiff.repo` is a plain string in the model).
      return getLabDiff(githubSession, change.changeId, file && { repo: file.repo as LabRepoKey, path: file.path });
    },
    [githubSession, change.changeId, t],
  );

  const act = (action: Parameters<LabReviewActionHandler>[1]) => onReviewAction(change.changeId, action);

  return (
    <div data-testid="lab-changes-tab" className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5 sm:px-6">
      <section aria-labelledby="lab-changes-review" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lab-changes-review" className="text-sm font-semibold text-foreground">
            {t('lab.change.pullRequests', { defaultValue: 'Pull requests' })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={!view}
            onClick={() => onDiffChange({ open: true })}
          >
            <FileDiff aria-hidden />
            {t('lab.change.viewChanges', { defaultValue: 'View changes' })}
          </Button>
        </div>
        {!hasPullRequests ? (
          <p className="text-sm text-muted-foreground">
            {t('lab.change.noPullRequests', { defaultValue: 'No pull request is open for this change yet.' })}
          </p>
        ) : reviewError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {t('lab.change.reviewFailed', {
                defaultValue: 'The pull requests could not be read: {{reason}}',
                reason: reviewError,
              })}
            </AlertDescription>
          </Alert>
        ) : review ? (
          <LabReviewCard
            review={review}
            onFixCi={(repo) => act({ kind: 'fixCi', repo })}
            onAddressComments={(repo, commentIds) => act({ kind: 'addressComments', repo, commentIds })}
            onResolveConflicts={(repo) => act({ kind: 'resolveConflicts', repo })}
            onUpdateBranch={(repo) => act({ kind: 'updateFromBase', repo })}
            onClose={() => act({ kind: 'close' })}
            onViewChanges={() => onDiffChange({ open: true })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('lab.change.reviewLoading', { defaultValue: 'Reading the pull requests...' })}
          </p>
        )}
      </section>

      <section aria-labelledby="lab-changes-build" className="space-y-2">
        <h2 id="lab-changes-build" className="text-sm font-semibold text-foreground">
          {t('lab.change.lastBuild', { defaultValue: 'Last build' })}
        </h2>
        {view ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card text-sm">
            <LabRunResult
              lab={view}
              details={{
                report: change.view?.report ?? null,
                cost: change.cost,
                pullRequests: change.pullRequests,
                noteProposals: [],
                planVersion: null,
              }}
              onOpenPullRequest={onOpenPullRequest}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t('lab.change.notBuilt', {
              defaultValue: 'Nothing is built yet. The files, checks and checklist of the change show here after its first build.',
            })}
          </p>
        )}
      </section>

      {dialogMounted && (
        <Suspense fallback={null}>
          <LabChangesDialog
            open={diff.open}
            onOpenChange={(open) => onDiffChange({ open })}
            load={load}
            onSend={onSendComments}
            initialFile={diff.file}
          />
        </Suspense>
      )}
    </div>
  );
};
