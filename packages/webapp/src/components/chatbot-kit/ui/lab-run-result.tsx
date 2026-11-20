import React, { Suspense, useState } from "react"
import type { TFunction } from "i18next"
import {
  CheckCircle2,
  FileDiff,
  GitBranch,
  Github,
  GitPullRequest,
  Hammer,
  HelpCircle,
  Loader2,
  MinusCircle,
  Play,
  Upload,
  XCircle,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/chatbot-kit/ui/markdown-renderer"
import { useAppSelector } from "@/main/app/store/hooks"
import { selectHasLiveSpecDrivenRun } from "@/main/features/spec-driven/state/specDrivenSlice"
import type { SpecDrivenLabView } from "@/main/features/spec-driven/types"
import { ApiError } from "@/main/shared/api/api-client"
import type { LabBuildReport, LabChangeCost, LabDone, LabNoteProposal, LabPullRequest } from "@/main/shared/api/lab"
import type { LabViewRequest } from "@/main/shared/services/labSession"
import { signInWithGitHub } from "@/main/shared/services/github/githubAuth"
import { describeNetworkError } from "@/main/shared/utils/describeNetworkError"

// Lab modules load on demand: only the lab build shows lab cards, and the public main chunk stays without them.
const LabNoteProposals = React.lazy(() =>
  import("@/main/features/lab/LabNoteProposals").then((module) => ({ default: module.LabNoteProposals })),
)

let labSession: Promise<typeof import("@/main/shared/services/labSession")> | null = null

/** Asks the change view to show `request` (the Changes tab, the pull-request dialog, Try it). */
export function showLabView(request: LabViewRequest): void {
  labSession ??= import("@/main/shared/services/labSession")
  void labSession.then(({ requestLabView }) => requestLabView(request))
}

/**
 * What a run's card shows beyond the run itself, from its `LabDone`: the build report, the change's cost and pull
 * requests so far, the team notes the agent proposed, and which plan of the change this is (1 for the first).
 */
export interface LabRunDetails {
  report: LabBuildReport | null
  cost: LabChangeCost
  pullRequests: LabPullRequest[]
  noteProposals: LabNoteProposal[]
  planVersion: number | null
}

/** A run's details from its `LabDone`; `planVersion` numbers the change's plans (null for a build). */
export function labRunDetails(lab: LabDone, planVersion: number | null): LabRunDetails {
  return {
    report: lab.report,
    cost: lab.cost,
    pullRequests: lab.pullRequests,
    noteProposals: lab.noteProposals,
    planVersion,
  }
}

/** Files listed per repository before "Show all", so a large change does not swamp the card. */
const FILES_PREVIEW = 8

const REPO_NAMES: Record<string, string> = {
  besser: "BESSER",
  frontend: "Web editor",
  modeling_agent: "Modeling agent",
}

const FILE_STATUS_TONES: Record<string, string> = {
  added: "text-emerald-700 dark:text-emerald-400",
  modified: "text-amber-700 dark:text-amber-400",
  deleted: "text-red-700 dark:text-red-400",
  renamed: "text-sky-700 dark:text-sky-400",
}

const SECTION = "space-y-1.5 border-t border-border/60 px-3 py-2 text-[11px]"

/** Why a run stopped before finishing its step (`LabChangeView.stopReason`). */
const STOP_REASONS: Record<string, string> = {
  cost_cap: "It reached its cost cap. What it did so far is in the working copy.",
  timeout: "It reached its time limit. What it did so far is in the working copy.",
  max_turns: "It reached its turn limit. What it did so far is in the working copy.",
  api_error: "The model provider failed during the run. What it did so far is in the working copy.",
  cancelled: "It was stopped. What it did so far is in the working copy.",
}

/** A card handler that acts on the card's change. A "Push to the pull requests" handler rejects with the failure for the card to show it. */
export type LabChangeAction = (changeId: string) => void | Promise<void>

const isStopped = (lab: SpecDrivenLabView): boolean => lab.stopReason !== "" && lab.stopReason !== "completed"

/** A plan step that ended without a plan and without a stop: the model asked the user something. */
const isQuestion = (lab: SpecDrivenLabView): boolean => lab.step === "plan" && !lab.plan && !isStopped(lab)
/** A plan that touches no repository: the request needs no change, so none was started and there is nothing to build. */
const changesNothing = (lab: SpecDrivenLabView): boolean =>
  lab.step === "plan" && lab.plan !== null && lab.plan.repos.length === 0 && !isStopped(lab)

const fileCount = (lab: SpecDrivenLabView): number =>
  lab.repoChanges.reduce((sum, repo) => sum + repo.files.length, 0)

/** The change's lab branch, when its repositories share one (the lab names them alike); else "". */
export function labChangeBranch(repoChanges: { branch: string }[]): string {
  const branches = new Set(repoChanges.map((change) => change.branch).filter(Boolean))
  return branches.size === 1 ? [...branches][0] : ""
}

/** A check's run time in seconds, when the API sends one (`durationSeconds`, absent from older backends). */
function checkSeconds(check: object): number | null {
  const value = (check as { durationSeconds?: unknown }).durationSeconds
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

/** "0.2s", "53s", "1m 50s": short checks keep a decimal. */
function formatCheckDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  if (minutes === 0) return `${whole}s`
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/** The finished card's title for a lab run: what the step delivered, worst state first. */
export function labRunTitle(t: TFunction, lab: SpecDrivenLabView): string {
  const stopped = isStopped(lab)
  if (lab.step === "plan") {
    if (isQuestion(lab)) return t("lab.runCard.titleQuestion", { defaultValue: "The lab agent has a question" })
    if (changesNothing(lab)) return t("lab.runCard.titleNoChangeNeeded", { defaultValue: "No change needed" })
    return stopped || !lab.plan
      ? t("lab.runCard.titlePlanStopped", { defaultValue: "Planning stopped early" })
      : t("lab.runCard.titlePlan", { defaultValue: "Plan ready" })
  }
  if (stopped) return t("lab.runCard.titleBuildStopped", { defaultValue: "Build stopped early" })
  if (fileCount(lab) === 0) {
    return t("lab.runCard.titleNoChanges", { defaultValue: "Build finished without changes" })
  }
  if (lab.checks.some((check) => !check.passed && !check.skipped)) {
    return t("lab.runCard.titleChecksFailing", { defaultValue: "Change built, checks failing" })
  }
  return t("lab.runCard.titleBuilt", { defaultValue: "Change built" })
}

/** A repository key (`besser`, `frontend`, `modeling_agent`) in words. */
export function labRepoName(t: TFunction, repo: string): string {
  return repo in REPO_NAMES ? t(`lab.repos.${repo}`, { defaultValue: REPO_NAMES[repo] }) : repo
}

/** Pending until `action` settles, so a second click cannot start it twice. */
function usePending(action?: () => void | Promise<void>): [boolean, () => Promise<void>] {
  const [pending, setPending] = useState(false)
  const run = async () => {
    if (!action || pending) return
    setPending(true)
    try {
      await action()
    } finally {
      setPending(false)
    }
  }
  return [pending, run]
}

/** "Build this plan", disabled while any run is in flight: the lab runs one at a time. */
function BuildPlanButton({ changeId, onBuildPlan }: { changeId: string; onBuildPlan: LabChangeAction }) {
  const { t } = useTranslation()
  const [building, buildPlan] = usePending(() => onBuildPlan(changeId))
  const runInFlight = useAppSelector((s) => s.specDriven.runStatus !== "idle" || selectHasLiveSpecDrivenRun(s))
  return (
    <div className="flex justify-end">
      <Button type="button" size="xs" onClick={() => void buildPlan()} disabled={building || runInFlight}>
        {building ? <Loader2 className="animate-spin" /> : <Hammer />}
        {t("lab.runCard.buildPlan", { defaultValue: "Build this plan" })}
      </Button>
    </div>
  )
}

/** The change the card belongs to: its title, kind and branch, and which plan of the change a revised plan is. */
function ChangeRow({ lab, planVersion }: { lab: SpecDrivenLabView; planVersion: number | null }) {
  const { t } = useTranslation()
  const branch = labChangeBranch(lab.repoChanges)
  const revised = lab.step === "plan" && planVersion !== null && planVersion > 1
  if (!lab.title && !branch && !revised) return null
  return (
    <p className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-1.5 text-xs text-foreground">
      {lab.title ? <span className="font-medium">{lab.title}</span> : null}
      {lab.title && lab.kind ? (
        <span className="rounded border border-border/60 px-1.5 text-[11px] text-muted-foreground">
          {t(`lab.kinds.${lab.kind}`, { defaultValue: lab.kind.replace("_", " ") })}
        </span>
      ) : null}
      {revised ? (
        <span className="rounded border border-primary/40 px-1.5 text-[11px] font-medium text-primary">
          {t("lab.runCard.planVersion", { defaultValue: "Plan v{{version}}", version: planVersion })}
        </span>
      ) : null}
      {branch ? (
        <span
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground"
          title={t("lab.runCard.onBranch", { defaultValue: "On branch {{branch}}", branch })}
        >
          <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{branch}</span>
        </span>
      ) : null}
    </p>
  )
}

function PlanView({ lab, onBuildPlan }: { lab: SpecDrivenLabView; onBuildPlan?: LabChangeAction }) {
  const { t } = useTranslation()
  const title = t("lab.runCard.planRegion", { defaultValue: "Plan" })
  const plan = lab.plan
  return (
    <section aria-label={title} className={SECTION}>
      {plan?.summary || lab.summary ? (
        <div className="text-xs text-foreground">
          <MarkdownRenderer>{plan?.summary || lab.summary}</MarkdownRenderer>
        </div>
      ) : null}
      {plan && plan.steps.length > 0 ? (
        <div>
          <p className="font-medium text-foreground">{t("lab.runCard.steps", { defaultValue: "Steps" })}</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">
            {plan.steps.map((step, i) => (
              <li key={i}>
                <MarkdownRenderer>{step}</MarkdownRenderer>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {plan && plan.questions.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-medium">{t("lab.runCard.questions", { defaultValue: "Open questions" })}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {plan.questions.map((question, i) => (
              <li key={i}>
                <MarkdownRenderer>{question}</MarkdownRenderer>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {changesNothing(lab) ? (
        // With a change open (`changeId`), the answer went into its notes and the change is as it was.
        lab.changeId ? null : (
          <p className="text-muted-foreground">
            {t("lab.runCard.noChangeHint", {
              defaultValue: "No change was started and no branch was created. Reply if something still needs to change.",
            })}
          </p>
        )
      ) : plan ? (
        <p className="text-muted-foreground">
          {t("lab.runCard.replyHint", {
            defaultValue: "Reply with what to change and the lab agent revises the plan, or build it as it is.",
          })}
        </p>
      ) : isQuestion(lab) ? (
        <p className="text-muted-foreground">
          {t("lab.runCard.answerHint", { defaultValue: "Reply to answer it; the lab agent then plans the change." })}
        </p>
      ) : null}
      {plan && onBuildPlan && !changesNothing(lab) ? <BuildPlanButton changeId={lab.changeId} onBuildPlan={onBuildPlan} /> : null}
    </section>
  )
}

function RepoFiles({ change }: { change: SpecDrivenLabView["repoChanges"][number] }) {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? change.files : change.files.slice(0, FILES_PREVIEW)
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-foreground">
        {labRepoName(t, change.repo)}
        {change.branch ? (
          <span className="inline-flex min-w-0 items-center gap-1 font-mono font-normal text-muted-foreground">
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {change.branch}
              {change.base ? ` → ${change.base}` : ""}
            </span>
          </span>
        ) : null}
      </p>
      <ul className="mt-0.5 space-y-0.5">
        {shown.map((file) => (
          <li key={file.path} className="flex min-w-0 gap-2">
            <span className={cn("w-14 shrink-0", FILE_STATUS_TONES[file.status] ?? "text-muted-foreground")}>
              {file.status
                ? t(`lab.fileStatus.${file.status}`, { defaultValue: file.status })
                : ""}
            </span>
            <span className="truncate font-mono text-muted-foreground" title={file.path}>
              {file.path}
            </span>
          </li>
        ))}
      </ul>
      {shown.length < change.files.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-0.5 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t("lab.runCard.showAll", { defaultValue: "Show all {{count}}", count: change.files.length })}
        </button>
      ) : null}
    </div>
  )
}

const VERDICTS = {
  good: { Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  bad: { Icon: XCircle, tone: "text-red-600 dark:text-red-400" },
  none: { Icon: MinusCircle, tone: "text-muted-foreground" },
  unknown: { Icon: HelpCircle, tone: "text-muted-foreground" },
}

function CheckRow({ check }: { check: SpecDrivenLabView["checks"][number] }) {
  const { t } = useTranslation()
  const { Icon, tone } = VERDICTS[check.skipped ? "none" : check.passed ? "good" : "bad"]
  const verdict = check.skipped
    ? t("lab.runCard.checkSkipped", { defaultValue: "Skipped" })
    : check.passed
      ? t("lab.runCard.checkPassed", { defaultValue: "Passed" })
      : t("lab.runCard.checkFailed", { defaultValue: "Failed" })
  const seconds = check.skipped ? null : checkSeconds(check)
  return (
    <li className="flex gap-2">
      <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", tone)} aria-label={verdict} role="img" />
      <div className="min-w-0">
        <span className="text-foreground">{check.title}</span>
        {check.repo ? <span className="text-muted-foreground"> · {labRepoName(t, check.repo)}</span> : null}
        {seconds !== null ? (
          <span
            className="font-mono tabular-nums text-muted-foreground"
            title={t("lab.runCard.checkDuration", { defaultValue: "Took {{seconds}} s", seconds: seconds.toFixed(1) })}
          >
            {" "}
            · {formatCheckDuration(seconds)}
          </span>
        ) : null}
        {check.summary ? (
          <p className={cn("whitespace-pre-line break-words", check.passed || check.skipped ? "text-muted-foreground" : tone)}>
            {check.summary}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function ChecklistRow({ item }: { item: SpecDrivenLabView["checklist"][number] }) {
  const { t } = useTranslation()
  const { Icon, tone } = VERDICTS[item.done === null ? "unknown" : item.done ? "good" : "bad"]
  const verdict =
    item.done === null
      ? t("lab.runCard.checklistNotJudged", { defaultValue: "Could not be judged from the files" })
      : item.done
        ? t("lab.runCard.checklistDone", { defaultValue: "Done" })
        : t("lab.runCard.checklistMissing", { defaultValue: "Missing" })
  return (
    <li className="flex gap-2">
      <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", tone)} aria-label={verdict} role="img" />
      <span className={item.done === false ? "text-foreground" : "text-muted-foreground"}>{item.text}</span>
    </li>
  )
}

/**
 * Why "Open pull request" failed, in the server's own sentence, kept until the next attempt. A 401 means the
 * GitHub session or its token was refused, so it offers "Sign in again".
 */
export function LabPullRequestFailure({ error, className }: { error: unknown; className?: string }) {
  const { t } = useTranslation()
  const signInAgain = error instanceof ApiError && error.status === 401
  return (
    <div role="alert" className={cn("space-y-1.5 text-red-700 dark:text-red-400", className)}>
      <p className="break-words">
        <span className="font-medium">
          {t("lab.pullRequest.failed", { defaultValue: "The pull request was not opened." })}
        </span>{" "}
        {describeNetworkError(error)}
      </p>
      {signInAgain ? (
        <Button type="button" size="xs" variant="outline" onClick={() => signInWithGitHub("lab_pull_request")}>
          <Github />
          {t("lab.pullRequest.signInAgain", { defaultValue: "Sign in again" })}
        </Button>
      ) : null}
    </div>
  )
}

function BuildView({
  lab,
  details,
  onOpenPullRequest,
}: {
  lab: SpecDrivenLabView
  details?: LabRunDetails
  onOpenPullRequest?: LabChangeAction
}) {
  const { t } = useTranslation()
  // A failure stays on the card until the next attempt; a surface that rejects puts it here.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  // Pending until the handler settles, so a second click cannot push twice.
  const [opening, openPullRequest] = usePending(
    onOpenPullRequest &&
      (async () => {
        setFailure(null)
        try {
          await onOpenPullRequest(lab.changeId)
        } catch (error) {
          setFailure({ error })
        }
      }),
  )
  const filesTitle = t("lab.runCard.filesRegion", { defaultValue: "Changed files" })
  const checksTitle = t("lab.runCard.checksRegion", { defaultValue: "Checks" })
  const checklistTitle = t("lab.runCard.checklistRegion", { defaultValue: "Checklist" })
  const accountTitle = t("lab.runCard.agentAccount", { defaultValue: "In the lab agent's words" })
  const changed = lab.repoChanges.filter((change) => change.files.length > 0)
  // Once the change has pull requests, a later build is pushed to them; the first ones open from the dialog.
  const pushed = (details?.pullRequests.length ?? 0) > 0

  return (
    <>
      {details?.report ? (
        <BuildReport report={details.report} />
      ) : lab.finalText?.trim() ? (
        <section aria-label={accountTitle} className={SECTION}>
          <p className="font-medium text-foreground">{accountTitle}</p>
          <div className="break-words text-xs text-foreground">
            <MarkdownRenderer>{lab.finalText.trim()}</MarkdownRenderer>
          </div>
        </section>
      ) : null}
      <section aria-label={filesTitle} className={SECTION}>
        <p className="font-medium text-foreground">{filesTitle}</p>
        {changed.length > 0 ? (
          changed.map((change) => <RepoFiles key={change.repo} change={change} />)
        ) : (
          <p className="text-muted-foreground">
            {t("lab.runCard.noChanges", { defaultValue: "No files changed." })}
          </p>
        )}
      </section>
      {lab.checks.length > 0 ? (
        <section aria-label={checksTitle} className={SECTION}>
          <p className="font-medium text-foreground">{checksTitle}</p>
          <ul className="space-y-1">
            {lab.checks.map((check, i) => (
              <CheckRow key={check.id || i} check={check} />
            ))}
          </ul>
        </section>
      ) : null}
      {lab.checklist.length > 0 ? (
        <section aria-label={checklistTitle} className={SECTION}>
          <p className="font-medium text-foreground">{checklistTitle}</p>
          <ul className="space-y-0.5">
            {lab.checklist.map((item, i) => (
              <ChecklistRow key={item.id || i} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
      {details && details.noteProposals.length > 0 ? (
        <Suspense fallback={null}>
          <LabNoteProposals changeId={lab.changeId} proposals={details.noteProposals} />
        </Suspense>
      ) : null}
      {changed.length > 0 ? (
        <div className="space-y-2 border-t border-border/60 px-3 py-2 text-[11px]">
          {failure ? <LabPullRequestFailure error={failure.error} /> : null}
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => showLabView({ kind: "changes", changeId: lab.changeId })}
            >
              <FileDiff />
              {t("lab.runCard.viewChanges", { defaultValue: "View changes" })}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => showLabView({ kind: "tryIt", changeId: lab.changeId })}
            >
              <Play />
              {t("lab.runCard.tryIt", { defaultValue: "Try it" })}
            </Button>
            {onOpenPullRequest && pushed ? (
              <Button type="button" size="xs" onClick={() => void openPullRequest()} disabled={opening}>
                {opening ? <Loader2 className="animate-spin" /> : <Upload />}
                {t("lab.runCard.pushPullRequests", { defaultValue: "Push to the pull requests" })}
              </Button>
            ) : onOpenPullRequest ? (
              <Button
                type="button"
                size="xs"
                onClick={() => showLabView({ kind: "pullRequest", changeId: lab.changeId })}
              >
                <GitPullRequest />
                {t("lab.runCard.openPullRequest", { defaultValue: "Open pull request" })}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

/** The agent's account of a build (`submit_build_report`): what changed, how it departed from the plan, what is left. */
function BuildReport({ report }: { report: LabBuildReport }) {
  const { t } = useTranslation()
  const title = t("lab.runCard.agentAccount", { defaultValue: "In the lab agent's words" })
  const list = (heading: string, items: string[]) =>
    items.length > 0 ? (
      <div>
        <p className="font-medium text-foreground">{heading}</p>
        <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-foreground">
          {items.map((item, i) => (
            <li key={i}>
              <MarkdownRenderer>{item}</MarkdownRenderer>
            </li>
          ))}
        </ul>
      </div>
    ) : null
  return (
    <section aria-label={title} className={SECTION}>
      <p className="font-medium text-foreground">{title}</p>
      {report.summary.trim() ? (
        <div className="break-words text-xs text-foreground">
          <MarkdownRenderer>{report.summary.trim()}</MarkdownRenderer>
        </div>
      ) : null}
      {list(t("lab.runCard.deviations", { defaultValue: "Departures from the plan" }), report.deviations)}
      {list(t("lab.runCard.notDone", { defaultValue: "Not done" }), report.notDone)}
    </section>
  )
}

/** "$1.82": an amount in US dollars, in the UI's number format. */
function formatUsd(usd: number, language: string): string {
  return new Intl.NumberFormat(language, { style: "currency", currency: "USD" }).format(usd)
}

/** What the change has cost so far, over how many runs. */
function ChangeCost({ cost }: { cost: LabChangeCost }) {
  const { t, i18n } = useTranslation()
  if (cost.runs === 0) return null
  return (
    <p className="border-t border-border/60 px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground">
      {t("lab.runCard.changeCost", {
        defaultValue: "This change so far: {{usd}} over {{count}} runs",
        defaultValue_one: "This change so far: {{usd}} over 1 run",
        usd: formatUsd(cost.usd, i18n.language),
        count: cost.runs,
      })}
    </p>
  )
}

/**
 * What a finished BESSER Lab run produced: the plan (with its version once revised), or the change with the
 * agent's account, its files per repository, the repositories' checks and the change kind's checklist, the team
 * notes it proposes, and why the run stopped early; then the change's cost. "Build this plan" shows on a plan when
 * the surface supplies `onBuildPlan`. A build with changed files offers "View changes" and "Try it", and, when the
 * surface supplies `onOpenPullRequest`, "Open pull request" (the change view's dialog) or, once the change has pull
 * requests, "Push to the pull requests" (the handler). Cards reach the change view only through `requestLabView`.
 */
export function LabRunResult({
  lab,
  details,
  onOpenPullRequest,
  onBuildPlan,
}: {
  lab: SpecDrivenLabView
  /** Absent on a card saved before the server sent them. */
  details?: LabRunDetails
  onOpenPullRequest?: LabChangeAction
  onBuildPlan?: LabChangeAction
}) {
  const { t } = useTranslation()
  return (
    <>
      <ChangeRow lab={lab} planVersion={details?.planVersion ?? null} />
      {isStopped(lab) ? (
        <p role="status" className="border-t border-border/60 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          {t(`lab.stopReasons.${lab.stopReason}`, { defaultValue: STOP_REASONS[lab.stopReason] ?? lab.stopReason })}
        </p>
      ) : null}
      {lab.step === "plan" ? (
        <PlanView lab={lab} onBuildPlan={onBuildPlan} />
      ) : (
        <BuildView lab={lab} details={details} onOpenPullRequest={onOpenPullRequest} />
      )}
      {details ? <ChangeCost cost={details.cost} /> : null}
    </>
  )
}
