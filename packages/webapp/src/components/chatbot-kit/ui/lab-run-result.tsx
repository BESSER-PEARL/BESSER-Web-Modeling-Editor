import React, { useState } from "react"
import type { TFunction } from "i18next"
import {
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  Hammer,
  HelpCircle,
  Loader2,
  MinusCircle,
  Settings2,
  XCircle,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useInRouterContext, useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAppSelector } from "@/main/app/store/hooks"
import { selectHasLiveSpecDrivenRun } from "@/main/features/spec-driven/state/specDrivenSlice"
import type { SpecDrivenLabView } from "@/main/features/spec-driven/types"

/** The lab page (`app/application.tsx` route), where changes are parked, resumed and dropped. */
const LAB_PATH = "/lab"

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

/** A card handler that acts on the card's change: the server only acts on the active one. */
export type LabChangeAction = (changeId: string) => void | Promise<void>

const isStopped = (lab: SpecDrivenLabView): boolean => lab.stopReason !== "" && lab.stopReason !== "completed"

/** A plan step that ended without a plan and without a stop: the model asked the user something. */
const isQuestion = (lab: SpecDrivenLabView): boolean => lab.step === "plan" && !lab.plan && !isStopped(lab)

const fileCount = (lab: SpecDrivenLabView): number =>
  lab.repoChanges.reduce((sum, repo) => sum + repo.files.length, 0)

/** The finished card's title for a lab run: what the step delivered, worst state first. */
export function labRunTitle(t: TFunction, lab: SpecDrivenLabView): string {
  const stopped = isStopped(lab)
  if (lab.step === "plan") {
    if (isQuestion(lab)) return t("lab.runCard.titleQuestion", { defaultValue: "The lab agent has a question" })
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

function repoName(t: TFunction, repo: string): string {
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

/**
 * The change the card belongs to, and a link to the lab page to park, resume or drop it: a new request
 * may go into the open change. The link is left out on the lab page itself and outside a router.
 */
function ChangeRow({ lab, showLink }: { lab: SpecDrivenLabView; showLink: boolean }) {
  const { t } = useTranslation()
  if (!lab.title && !showLink) return null
  return (
    <p className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-1.5 text-xs text-foreground">
      {lab.title ? <span className="font-medium">{lab.title}</span> : null}
      {lab.title && lab.kind ? (
        <span className="rounded border border-border/60 px-1.5 text-[11px] text-muted-foreground">
          {t(`lab.kinds.${lab.kind}`, { defaultValue: lab.kind.replace("_", " ") })}
        </span>
      ) : null}
      {showLink ? (
        <Link
          to={LAB_PATH}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Settings2 className="h-3 w-3" aria-hidden />
          {t("lab.runCard.manageChanges", { defaultValue: "Manage changes" })}
        </Link>
      ) : null}
    </p>
  )
}

function RoutedChangeRow({ lab }: { lab: SpecDrivenLabView }) {
  const { pathname } = useLocation()
  return <ChangeRow lab={lab} showLink={pathname !== LAB_PATH} />
}

function PlanView({ lab, onBuildPlan }: { lab: SpecDrivenLabView; onBuildPlan?: LabChangeAction }) {
  const { t } = useTranslation()
  const title = t("lab.runCard.planRegion", { defaultValue: "Plan" })
  const plan = lab.plan
  return (
    <section aria-label={title} className={SECTION}>
      {plan?.summary || lab.summary ? (
        <p className="whitespace-pre-line text-xs text-foreground">{plan?.summary || lab.summary}</p>
      ) : null}
      {plan && plan.steps.length > 0 ? (
        <div>
          <p className="font-medium text-foreground">{t("lab.runCard.steps", { defaultValue: "Steps" })}</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">
            {plan.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {plan && plan.questions.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-medium">{t("lab.runCard.questions", { defaultValue: "Open questions" })}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {plan.questions.map((question, i) => (
              <li key={i}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan ? (
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
      {plan && onBuildPlan ? <BuildPlanButton changeId={lab.changeId} onBuildPlan={onBuildPlan} /> : null}
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
        {repoName(t, change.repo)}
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
  return (
    <li className="flex gap-2">
      <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", tone)} aria-label={verdict} role="img" />
      <div className="min-w-0">
        <span className="text-foreground">{check.title}</span>
        {check.repo ? <span className="text-muted-foreground"> · {repoName(t, check.repo)}</span> : null}
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

function BuildView({ lab, onOpenPullRequest }: { lab: SpecDrivenLabView; onOpenPullRequest?: LabChangeAction }) {
  const { t } = useTranslation()
  // Pending until the handler settles, so a second click cannot push and open the pull requests twice.
  const [opening, openPullRequest] = usePending(onOpenPullRequest && (() => onOpenPullRequest(lab.changeId)))
  const filesTitle = t("lab.runCard.filesRegion", { defaultValue: "Changed files" })
  const checksTitle = t("lab.runCard.checksRegion", { defaultValue: "Checks" })
  const checklistTitle = t("lab.runCard.checklistRegion", { defaultValue: "Checklist" })
  const accountTitle = t("lab.runCard.agentAccount", { defaultValue: "In the lab agent's words" })
  const changed = lab.repoChanges.filter((change) => change.files.length > 0)

  return (
    <>
      {lab.finalText?.trim() ? (
        <section aria-label={accountTitle} className={SECTION}>
          <p className="font-medium text-foreground">{accountTitle}</p>
          <p className="whitespace-pre-line break-words text-xs text-foreground">{lab.finalText.trim()}</p>
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
      {onOpenPullRequest && changed.length > 0 ? (
        <div className="flex justify-end border-t border-border/60 px-3 py-2">
          <Button type="button" size="xs" onClick={() => void openPullRequest()} disabled={opening}>
            {opening ? <Loader2 className="animate-spin" /> : <GitPullRequest />}
            {t("lab.runCard.openPullRequest", { defaultValue: "Open pull request" })}
          </Button>
        </div>
      ) : null}
    </>
  )
}

/**
 * What a finished BESSER Lab run produced: the plan, or the change with the
 * agent's own account, its files per repository, the repositories' checks and the change kind's
 * checklist, and why the run stopped early, under the change it belongs to and
 * a link to the lab page. "Build this plan" shows on a plan
 * when the surface supplies `onBuildPlan`; "Open pull request" only when the
 * build changed files and the surface supplies `onOpenPullRequest`.
 */
export function LabRunResult({
  lab,
  onOpenPullRequest,
  onBuildPlan,
}: {
  lab: SpecDrivenLabView
  onOpenPullRequest?: LabChangeAction
  onBuildPlan?: LabChangeAction
}) {
  const { t } = useTranslation()
  const inRouter = useInRouterContext()
  return (
    <>
      {inRouter ? <RoutedChangeRow lab={lab} /> : <ChangeRow lab={lab} showLink={false} />}
      {isStopped(lab) ? (
        <p role="status" className="border-t border-border/60 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          {t(`lab.stopReasons.${lab.stopReason}`, { defaultValue: STOP_REASONS[lab.stopReason] ?? lab.stopReason })}
        </p>
      ) : null}
      {lab.step === "plan" ? (
        <PlanView lab={lab} onBuildPlan={onBuildPlan} />
      ) : (
        <BuildView lab={lab} onOpenPullRequest={onOpenPullRequest} />
      )}
    </>
  )
}
