import React, { useState } from "react"
import type { TFunction } from "i18next"
import {
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileDiff,
  GitMerge,
  Loader2,
  MinusCircle,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  labRefusal,
  type LabCheckRun,
  type LabPullRequestStatus,
  type LabReview,
  type LabReviewComment,
  type LabReviewResponse,
} from "@/main/shared/api/lab"

const SECTION = "space-y-1.5 border-t border-border/60 px-3 py-2 text-[11px]"

/** A card action; a rejection is shown on the card. */
type Action = () => void | Promise<void>

export interface LabReviewCardProps {
  review: LabReviewResponse
  /** A build step that fixes the failing checks of the pull request of `repo`. */
  onFixCi?: (repo: string) => void | Promise<void>
  /** A build step that addresses the ticked comments of the pull request of `repo`. */
  onAddressComments?: (repo: string, commentIds: string[]) => void | Promise<void>
  /** Bring `repo` up to its base branch (offered when the pull request is behind or conflicts). */
  onUpdateBranch?: (repo: string) => void | Promise<void>
  /** A build step that resolves the merge conflicts in `repo` (offered when the pull request conflicts). */
  onResolveConflicts?: (repo: string) => void | Promise<void>
  /** Close the change; offered only when its pull requests were closed without merging. */
  onClose?: () => void | Promise<void>
  onViewChanges?: () => void
}

const repoName = (t: TFunction, repo: string) => t(`lab.repos.${repo}`, { defaultValue: repo })

/** The agent acts on these by default; anyone else's comment needs the user's tick (prompt injection). */
const ticksByDefault = (comment: LabReviewComment) => comment.trusted && !comment.resolved && !comment.outdated

const CHECK_ICONS: Record<LabCheckRun["state"], { Icon: typeof CheckCircle2; tone: string }> = {
  success: { Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  failure: { Icon: XCircle, tone: "text-red-600 dark:text-red-400" },
  pending: { Icon: CircleDot, tone: "text-amber-600 dark:text-amber-400" },
  neutral: { Icon: MinusCircle, tone: "text-muted-foreground" },
  skipped: { Icon: MinusCircle, tone: "text-muted-foreground" },
}

function checkStateLabel(t: TFunction, state: LabCheckRun["state"]): string {
  const labels: Record<LabCheckRun["state"], string> = {
    success: t("lab.review.checkSuccess", { defaultValue: "Passed" }),
    failure: t("lab.review.checkFailure", { defaultValue: "Failed" }),
    pending: t("lab.review.checkPending", { defaultValue: "Running" }),
    neutral: t("lab.review.checkNeutral", { defaultValue: "Neutral" }),
    skipped: t("lab.review.checkSkipped", { defaultValue: "Skipped" }),
  }
  return labels[state]
}

function pullRequestStateLabel(t: TFunction, pullRequest: LabPullRequestStatus): string {
  if (pullRequest.state === "merged") return t("lab.review.stateMerged", { defaultValue: "Merged" })
  if (pullRequest.state === "closed") return t("lab.review.stateClosed", { defaultValue: "Closed" })
  return pullRequest.draft
    ? t("lab.review.stateDraft", { defaultValue: "Draft" })
    : t("lab.review.stateOpen", { defaultValue: "Open" })
}

function reviewDecisionLabel(t: TFunction, decision: LabPullRequestStatus["reviewDecision"]): string | null {
  if (decision === "APPROVED") return t("lab.review.decisionApproved", { defaultValue: "Approved" })
  if (decision === "CHANGES_REQUESTED") {
    return t("lab.review.decisionChangesRequested", { defaultValue: "Changes requested" })
  }
  if (decision === "REVIEW_REQUIRED") return t("lab.review.decisionRequired", { defaultValue: "Review required" })
  return null
}

function reviewStateLabel(t: TFunction, state: LabReview["state"]): string {
  const labels: Record<LabReview["state"], string> = {
    APPROVED: t("lab.review.reviewApproved", { defaultValue: "approved" }),
    CHANGES_REQUESTED: t("lab.review.reviewChangesRequested", { defaultValue: "requested changes" }),
    COMMENTED: t("lab.review.reviewCommented", { defaultValue: "commented" }),
    DISMISSED: t("lab.review.reviewDismissed", { defaultValue: "review dismissed" }),
    PENDING: t("lab.review.reviewPending", { defaultValue: "review pending" }),
  }
  return labels[state]
}

function lifecycleLabel(t: TFunction, review: LabReviewResponse): string {
  switch (review.lifecycle) {
    case "merged":
      return t("lab.review.lifecycleMerged", { defaultValue: "Every pull request is merged." })
    case "partly_merged":
      return t("lab.review.lifecyclePartlyMerged", { defaultValue: "Some pull requests are merged." })
    case "closed":
      return t("lab.review.lifecycleClosed", { defaultValue: "The pull requests were closed without merging." })
    default:
      return t("lab.review.lifecycleOpen", { defaultValue: "Pull requests open for review." })
  }
}

function CheckRow({ check }: { check: LabCheckRun }) {
  const { t } = useTranslation()
  const { Icon, tone } = CHECK_ICONS[check.state]
  return (
    <li className="flex gap-2">
      <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", tone)} aria-label={checkStateLabel(t, check.state)} role="img" />
      <div className="min-w-0 flex-1">
        <span className="text-foreground">{check.name}</span>
        {check.url ? (
          <a
            href={check.url}
            target="_blank"
            rel="noreferrer"
            className="ml-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("lab.review.checkDetails", { defaultValue: "Details" })}
          </a>
        ) : null}
        {check.logNote ? <p className="text-muted-foreground">{check.logNote}</p> : null}
        {check.logTail ? (
          <details className="mt-0.5">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              {t("lab.review.logTail", { defaultValue: "End of the log" })}
            </summary>
            <pre className="code-surface mt-1 max-h-64 overflow-auto rounded p-2 font-mono text-[10.5px] leading-4">
              {check.logTail}
            </pre>
          </details>
        ) : null}
      </div>
    </li>
  )
}

function CommentRow({
  comment,
  ticked,
  onTick,
}: {
  comment: LabReviewComment
  ticked: boolean
  onTick: (ticked: boolean) => void
}) {
  const { t } = useTranslation()
  const location = comment.path
    ? comment.line !== null
      ? `${comment.path}:${comment.startLine !== null && comment.startLine !== comment.line ? `${comment.startLine}-` : ""}${comment.line}`
      : comment.path
    : null
  return (
    <li className="flex gap-2">
      <Checkbox
        checked={ticked}
        onCheckedChange={onTick}
        aria-label={t("lab.review.tickComment", { defaultValue: "Send the comment by {{author}} to the lab agent", author: comment.author })}
        className="mt-px size-3.5"
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5">
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {comment.author}
          </a>
          {comment.trusted ? null : (
            <span
              className="rounded border border-amber-300 px-1 text-amber-800 dark:border-amber-700/60 dark:text-amber-300"
              title={t("lab.review.outsideTitle", {
                defaultValue: "Not a member or collaborator of the repository. The lab agent acts on it only when you tick it.",
              })}
            >
              {t("lab.review.outside", { defaultValue: "Outside contributor" })}
            </span>
          )}
          {location ? <span className="truncate font-mono text-muted-foreground">{location}</span> : null}
          {comment.resolved ? (
            <span className="text-muted-foreground">{t("lab.review.resolved", { defaultValue: "Resolved" })}</span>
          ) : null}
          {comment.outdated ? (
            <span className="text-muted-foreground">{t("lab.review.outdated", { defaultValue: "Outdated" })}</span>
          ) : null}
        </p>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{comment.body}</p>
      </div>
    </li>
  )
}

function PullRequestSection({
  pullRequest,
  busy,
  run,
  ticked,
  onTick,
  props,
}: {
  pullRequest: LabPullRequestStatus
  busy: boolean
  run: (action: Action) => void
  ticked: (comment: LabReviewComment) => boolean
  onTick: (id: string, ticked: boolean) => void
  props: LabReviewCardProps
}) {
  const { t } = useTranslation()
  const { repo } = pullRequest
  const open = pullRequest.state === "open"
  const failing = pullRequest.checks.some((check) => check.state === "failure")
  const conflicting = pullRequest.mergeable === "conflicting"
  const behind = pullRequest.mergeState === "behind"
  const decision = reviewDecisionLabel(t, pullRequest.reviewDecision)
  const reviews = pullRequest.reviews.filter((review) => review.body.trim() || review.state !== "COMMENTED")
  const tickedIds = pullRequest.comments.filter(ticked).map((comment) => comment.id)
  const othersPushed = pullRequest.pushedSha !== null && pullRequest.pushedSha !== pullRequest.headSha
  const checksTitle = t("lab.review.checks", { defaultValue: "Checks" })
  const reviewsTitle = t("lab.review.reviews", { defaultValue: "Reviews" })
  const commentsTitle = t("lab.review.comments", { defaultValue: "Comments" })

  return (
    <section
      aria-label={t("lab.review.pullRequestRegion", {
        defaultValue: "{{repo}} pull request #{{number}}",
        repo: repoName(t, repo),
        number: pullRequest.number,
      })}
      className={SECTION}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium text-foreground">{repoName(t, repo)}</span>
        <a
          href={pullRequest.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          #{pullRequest.number}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <span className="rounded border border-border/60 px-1.5 text-muted-foreground">
          {pullRequestStateLabel(t, pullRequest)}
        </span>
        {decision ? <span className="text-muted-foreground">{decision}</span> : null}
      </p>
      {othersPushed ? (
        <p className="text-muted-foreground">
          {t("lab.review.othersPushed", {
            defaultValue: "Someone else pushed to this branch. The lab merges their commits at its next push.",
          })}
        </p>
      ) : null}

      {open && (conflicting || behind) ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className={conflicting ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}>
            {conflicting
              ? t("lab.review.conflicting", { defaultValue: "Conflicts with the base branch." })
              : t("lab.review.behind", { defaultValue: "Behind the base branch." })}
          </p>
          <span className="ml-auto flex gap-1.5">
            {props.onUpdateBranch ? (
              <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => run(() => props.onUpdateBranch!(repo))}>
                <RefreshCw />
                {t("lab.review.updateFromBase", { defaultValue: "Update from base" })}
              </Button>
            ) : null}
            {conflicting && props.onResolveConflicts ? (
              <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => run(() => props.onResolveConflicts!(repo))}>
                <GitMerge />
                {t("lab.review.resolveConflicts", { defaultValue: "Resolve conflicts" })}
              </Button>
            ) : null}
          </span>
        </div>
      ) : null}

      {pullRequest.checks.length > 0 ? (
        <div aria-label={checksTitle} role="group">
          <p className="font-medium text-foreground">{checksTitle}</p>
          <ul className="mt-0.5 space-y-1">
            {pullRequest.checks.map((check, i) => (
              <CheckRow key={`${check.name}-${i}`} check={check} />
            ))}
          </ul>
          {open && failing && props.onFixCi ? (
            <div className="mt-1 flex justify-end">
              <Button type="button" size="xs" disabled={busy} onClick={() => run(() => props.onFixCi!(repo))}>
                <Wrench />
                {t("lab.review.fixCi", { defaultValue: "Fix CI" })}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div aria-label={reviewsTitle} role="group">
          <p className="font-medium text-foreground">{reviewsTitle}</p>
          <ul className="mt-0.5 space-y-1">
            {reviews.map((review, i) => (
              <li key={`${review.url}-${i}`}>
                <a
                  href={review.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {review.author}
                </a>{" "}
                <span className="text-muted-foreground">{reviewStateLabel(t, review.state)}</span>
                {review.body.trim() ? (
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">{review.body.trim()}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pullRequest.comments.length > 0 ? (
        <div aria-label={commentsTitle} role="group">
          <p className="font-medium text-foreground">{commentsTitle}</p>
          <ul className="mt-0.5 space-y-1.5">
            {pullRequest.comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                ticked={ticked(comment)}
                onTick={(value) => onTick(comment.id, value)}
              />
            ))}
          </ul>
          {open && props.onAddressComments ? (
            <div className="mt-1 flex justify-end">
              <Button
                type="button"
                size="xs"
                disabled={busy || tickedIds.length === 0}
                onClick={() => run(() => props.onAddressComments!(repo, tickedIds))}
              >
                <Wrench />
                {t("lab.review.addressComments", {
                  defaultValue: "Address comments ({{count}})",
                  count: tickedIds.length,
                })}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The change's pull requests as GitHub reports them: per pull request its state, checks (a failing one with the
 * end of its log, collapsed), reviews, comments (ticked for the agent only when from a member or collaborator and
 * still open) and mergeability, with the build steps that act on them. Each action shows only when its handler
 * is given; "Close" only when the pull requests were closed without merging (a merged change closes itself).
 */
export function LabReviewCard(props: LabReviewCardProps) {
  const { review, onClose, onViewChanges } = props
  const { t } = useTranslation()
  // One action at a time: each starts a run or changes the working copy.
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // The user's ticks; a comment not ticked or unticked by the user follows `ticksByDefault`.
  const [ticks, setTicks] = useState<Record<string, boolean>>({})

  const run = (action: Action) => {
    if (busy) return
    setBusy(true)
    setFailure(null)
    void (async () => {
      try {
        await action()
      } catch (error) {
        setFailure(labRefusal(error).message)
      } finally {
        setBusy(false)
      }
    })()
  }
  const ticked = (comment: LabReviewComment) => ticks[comment.id] ?? ticksByDefault(comment)
  const onTick = (id: string, value: boolean) => setTicks((previous) => ({ ...previous, [id]: value }))
  const canClose = review.lifecycle === "closed" && onClose

  return (
    <>
      <p className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-1.5 text-xs text-foreground">
        {lifecycleLabel(t, review)}
        {onViewChanges ? (
          <Button type="button" size="xs" variant="ghost" className="ml-auto" onClick={onViewChanges}>
            <FileDiff />
            {t("lab.review.viewChanges", { defaultValue: "View changes" })}
          </Button>
        ) : null}
      </p>
      {review.pullRequests.map((pullRequest) => (
        <PullRequestSection
          key={`${pullRequest.repo}#${pullRequest.number}`}
          pullRequest={pullRequest}
          busy={busy}
          run={run}
          ticked={ticked}
          onTick={onTick}
          props={props}
        />
      ))}
      {failure || canClose || (review.closableNote && review.lifecycle !== "open") ? (
        <div className={SECTION}>
          {failure ? (
            <p role="alert" className="break-words text-red-700 dark:text-red-400">
              {failure}
            </p>
          ) : null}
          {review.closableNote && review.lifecycle !== "open" ? (
            <p className="text-muted-foreground">{review.closableNote}</p>
          ) : null}
          {canClose ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy || !review.closable}
                onClick={() => run(canClose)}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {t("lab.review.close", { defaultValue: "Close the change" })}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
