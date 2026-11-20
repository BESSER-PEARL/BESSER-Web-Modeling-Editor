import React, { useEffect, useMemo, useState } from "react"
import {
  Decoration,
  Diff,
  Hunk,
  getChangeKey,
  isDelete,
  isInsert,
  isNormal,
  parseDiff,
  type ChangeData,
  type HunkData,
  type RenderGutter,
} from "react-diff-view"
import "react-diff-view/style/index.css"
import { FileDiff, Loader2, MessageSquarePlus, Send, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FileTree, buildTree } from "@/components/chatbot-kit/ui/generated-files-dialog"
import { labRefusal, type LabDiffResponse, type LabFileDiff } from "@/main/shared/api/lab"
import { formatLineComments, type LabLineComment } from "@/main/features/lab/reviewMessage"
import "./code-surface.css"

/** A file of the diff, by repository key and path. */
export interface LabDiffFileRef {
  repo: string
  path: string
}

export interface LabChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The change's diff; with `file`, that one file alone (for a file the full diff left out). */
  load: (file?: LabDiffFileRef) => Promise<LabDiffResponse>
  /** Sends the review comments as the next chat message to the lab agent. */
  onSend: (text: string) => void
  /** The file to show first. */
  initialFile?: LabDiffFileRef
}

type Loaded<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; value: T }

/** Lines picked on one file: a range between two changes of one hunk, or the whole file. */
type Selection =
  | { repo: string; path: string; whole: true }
  | { repo: string; path: string; whole: false; anchor: string; focus: string }

const NO_AI_FILES = new Set<string>()

/** The diff on the dark code surface of "View files", in both themes. */
const DIFF_THEME = cn(
  "[--diff-background-color:transparent] [--diff-text-color:#d5dce2]",
  "[--diff-font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]",
  "[--diff-gutter-insert-background-color:#1d3a27] [--diff-code-insert-background-color:#15291c]",
  "[--diff-gutter-delete-background-color:#46242b] [--diff-code-delete-background-color:#2e1a1e]",
  "[--diff-gutter-selected-background-color:#4a4520] [--diff-code-selected-background-color:#2f2c16]",
  "[--diff-selection-background-color:#264f78] [--diff-omit-gutter-line-color:#7d8892]",
)

const fileKey = (repo: string, path: string) => `${repo}\n${path}`

const repoName = (t: TFunction, repo: string) => t(`lab.repos.${repo}`, { defaultValue: repo })

/** The side a change's line number belongs to: deleted lines are the base version's. */
const sideOf = (change: ChangeData): "old" | "new" => (isDelete(change) ? "old" : "new")

function lineOn(change: ChangeData, side: "old" | "new"): number {
  if (isNormal(change)) return side === "old" ? change.oldLineNumber : change.newLineNumber
  return change.lineNumber
}

/** The comment a line selection makes: one side, its line range and the lines as they read there. */
function lineComment(hunks: HunkData[], selection: Selection, text: string): LabLineComment | null {
  const { repo, path } = selection
  if (selection.whole) return { repo, path, side: "new", startLine: null, endLine: null, quoted: "", text }
  const picked = pickedChanges(hunks, selection)
  if (picked.length === 0) return null
  // Only deleted lines: the base version's. Anything else is read on the changed file (its deleted lines drop out).
  const side = picked.some(isDelete) && !picked.some(isInsert) ? "old" : "new"
  const onSide = picked.filter((change) => (side === "old" ? !isInsert(change) : !isDelete(change)))
  const lines = onSide.map((change) => lineOn(change, side))
  return {
    repo,
    path,
    side,
    startLine: Math.min(...lines),
    endLine: Math.max(...lines),
    quoted: onSide.map((change) => change.content).join("\n"),
    text,
  }
}

/** The changes between the selection's two ends, both in one hunk; [] when they are not. */
function pickedChanges(hunks: HunkData[], selection: Selection): ChangeData[] {
  if (selection.whole) return []
  for (const hunk of hunks) {
    const keys = hunk.changes.map(getChangeKey)
    const a = keys.indexOf(selection.anchor)
    const b = keys.indexOf(selection.focus)
    if (a >= 0 && b >= 0) return hunk.changes.slice(Math.min(a, b), Math.max(a, b) + 1)
  }
  return []
}

function describeComment(t: TFunction, comment: LabLineComment): string {
  if (comment.startLine === null || comment.endLine === null) {
    return t("lab.diff.wholeFile", { defaultValue: "whole file" })
  }
  return comment.startLine === comment.endLine
    ? t("lab.diff.oneLine", { defaultValue: "line {{line}}", line: comment.startLine })
    : t("lab.diff.lineRange", { defaultValue: "lines {{start}}-{{end}}", start: comment.startLine, end: comment.endLine })
}

function CommentBox({
  label,
  text,
  onText,
  onAdd,
  onCancel,
}: {
  label: string
  text: string
  onText: (text: string) => void
  onAdd: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5 bg-background p-2 font-sans text-xs text-foreground">
      <p className="text-muted-foreground">{label}</p>
      <Textarea
        autoFocus
        value={text}
        onChange={(event) => onText(event.target.value)}
        aria-label={t("lab.diff.commentLabel", { defaultValue: "Comment for the lab agent" })}
        placeholder={t("lab.diff.commentPlaceholder", { defaultValue: "What should the lab agent change here?" })}
        className="min-h-[64px] text-xs"
      />
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          {t("lab.diff.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button type="button" size="xs" onClick={onAdd} disabled={!text.trim()}>
          {t("lab.diff.addComment", { defaultValue: "Add comment" })}
        </Button>
      </div>
    </div>
  )
}

function FilePatch({
  file,
  repo,
  selection,
  onSelect,
  commentBox,
}: {
  file: LabFileDiff
  repo: string
  selection: Selection | null
  onSelect: (change: ChangeData, extend: boolean) => void
  commentBox: (hunks: HunkData[]) => React.ReactNode
}) {
  const { t } = useTranslation()
  const parsed = useMemo(() => (file.patch ? parseDiff(file.patch)[0] : undefined), [file.patch])
  const hunks = parsed?.hunks ?? []
  const mine = selection && selection.repo === repo && selection.path === file.path ? selection : null
  const picked = mine ? pickedChanges(hunks, mine) : []
  // A range stays inside one hunk: the lines between two hunks are not shown, so they cannot be quoted.
  const canExtend = (change: ChangeData) =>
    !!mine &&
    !mine.whole &&
    hunks.some((hunk) => {
      const keys = hunk.changes.map(getChangeKey)
      return keys.includes(mine.anchor) && keys.includes(getChangeKey(change))
    })

  const renderGutter: RenderGutter = ({ change, side, renderDefault }) => {
    if (side !== sideOf(change)) return renderDefault()
    const line = lineOn(change, side)
    return (
      <button
        type="button"
        onClick={(event) => onSelect(change, event.shiftKey && canExtend(change))}
        aria-label={
          side === "old"
            ? t("lab.diff.selectOldLine", { defaultValue: "Select line {{line}} (previous version)", line })
            : t("lab.diff.selectNewLine", { defaultValue: "Select line {{line}} (current file)", line })
        }
        title={t("lab.diff.selectHint", { defaultValue: "Click to comment; Shift-click to select a range" })}
        className="w-full text-right hover:text-white hover:underline"
      >
        {line}
      </button>
    )
  }

  if (!parsed || hunks.length === 0) {
    return (
      <p className="code-surface-muted p-6 text-center text-sm">
        {t("lab.diff.noLineChanges", { defaultValue: "No line changes: the file was renamed or its mode changed." })}
      </p>
    )
  }
  const widgets: Record<string, React.ReactNode> =
    picked.length > 0 ? { [getChangeKey(picked[picked.length - 1])]: commentBox(hunks) } : {}
  return (
    <Diff
      viewType="unified"
      diffType={parsed.type}
      hunks={hunks}
      selectedChanges={picked.map(getChangeKey)}
      widgets={widgets}
      renderGutter={renderGutter}
      className="font-mono text-xs leading-5"
    >
      {(shown) =>
        shown.flatMap((hunk) => [
          <Decoration key={`d-${hunk.content}`} className="code-surface-muted bg-white/5">
            <span className="px-2 font-mono text-[11px]">{hunk.content}</span>
          </Decoration>,
          <Hunk key={hunk.content} hunk={hunk} />,
        ])
      }
    </Diff>
  )
}

/**
 * "View changes" of a lab change: its working trees against their bases, one tab per repository, a file tree
 * and a unified diff per file. Clicking a line number (Shift-click for a range) or "Comment on the file" opens a
 * comment box; the comments collect in a draft and go to the lab agent as one chat message. A file the full
 * diff left out (too large, or past the response cap) is fetched alone when selected.
 */
export default function LabChangesDialog({ open, onOpenChange, load, onSend, initialFile }: LabChangesDialogProps) {
  const { t } = useTranslation()
  const [diff, setDiff] = useState<Loaded<LabDiffResponse>>({ kind: "loading" })
  const [alone, setAlone] = useState<Record<string, Loaded<LabFileDiff>>>({})
  const [repo, setRepo] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Selection | null>(null)
  const [text, setText] = useState("")
  const [drafts, setDrafts] = useState<LabLineComment[]>([])

  // A change's diff moves with every build: read it again at each open. Drafts are kept.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDiff({ kind: "loading" })
    setAlone({})
    setSelection(null)
    load()
      .then((response) => {
        if (cancelled) return
        setDiff({ kind: "ready", value: response })
        const start =
          response.repos.find((r) => r.repo === initialFile?.repo) ??
          response.repos.find((r) => r.files.length > 0) ??
          response.repos[0]
        setRepo(start?.repo ?? null)
        const wanted = start?.files.find((f) => f.path === initialFile?.path)
        setSelected((wanted ?? start?.files[0])?.path ?? null)
        setClosed(new Set())
      })
      .catch((error: unknown) => {
        if (!cancelled) setDiff({ kind: "error", message: labRefusal(error).message })
      })
    return () => {
      cancelled = true
    }
    // Read once per open; `load` and `initialFile` are taken as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const repoDiff = diff.kind === "ready" ? diff.value.repos.find((r) => r.repo === repo) : undefined
  const listed = repoDiff?.files.find((f) => f.path === selected)
  const key = repo && selected ? fileKey(repo, selected) : ""
  const needsAlone = !!listed && listed.patch === null && listed.omitted !== null && listed.omitted !== "binary"
  const aloneState = key ? alone[key] : undefined

  // A file the full diff left out is read alone, once, when it is shown.
  useEffect(() => {
    if (!needsAlone || !repo || !selected || aloneState) return
    const file = { repo, path: selected }
    setAlone((previous) => ({ ...previous, [key]: { kind: "loading" } }))
    load(file)
      .then((response) => {
        const found = response.repos.find((r) => r.repo === repo)?.files.find((f) => f.path === selected)
        setAlone((previous) => ({
          ...previous,
          [key]: found
            ? { kind: "ready", value: found }
            : { kind: "error", message: t("lab.diff.fileGone", { defaultValue: "This file is no longer changed." }) },
        }))
      })
      .catch((error: unknown) => {
        setAlone((previous) => ({ ...previous, [key]: { kind: "error", message: labRefusal(error).message } }))
      })
  }, [needsAlone, repo, selected, key, aloneState, load, t])

  const file = needsAlone && aloneState?.kind === "ready" ? aloneState.value : listed
  const tree = useMemo(() => (repoDiff ? buildTree(repoDiff.files) : null), [repoDiff])
  const fileCount = diff.kind === "ready" ? diff.value.repos.reduce((sum, r) => sum + r.files.length, 0) : 0

  const toggle = (dir: string) =>
    setClosed((previous) => {
      const next = new Set(previous)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })

  const showRepo = (next: string) => {
    const first = diff.kind === "ready" ? diff.value.repos.find((r) => r.repo === next)?.files[0] : undefined
    setRepo(next)
    setSelected(first?.path ?? null)
    setClosed(new Set())
  }

  const selectLine = (change: ChangeData, extend: boolean) => {
    if (!repo || !selected) return
    const changeKey = getChangeKey(change)
    setSelection((previous) =>
      extend && previous && !previous.whole && previous.repo === repo && previous.path === selected
        ? { ...previous, focus: changeKey }
        : { repo, path: selected, whole: false, anchor: changeKey, focus: changeKey },
    )
  }

  const addComment = (hunks: HunkData[]) => {
    if (!selection || !text.trim()) return
    const comment = lineComment(hunks, selection, text.trim())
    if (comment) setDrafts((previous) => [...previous, comment])
    setSelection(null)
    setText("")
  }

  const cancelComment = () => {
    setSelection(null)
    setText("")
  }

  const commentBox = (hunks: HunkData[]) => {
    const preview = selection ? lineComment(hunks, selection, "") : null
    return (
      <CommentBox
        label={
          preview
            ? t("lab.diff.commentOn", {
                defaultValue: "Comment on {{where}} of {{path}}",
                where: describeComment(t, preview),
                path: preview.path,
              })
            : ""
        }
        text={text}
        onText={setText}
        onAdd={() => addComment(hunks)}
        onCancel={cancelComment}
      />
    )
  }

  const send = () => {
    if (drafts.length === 0) return
    onSend(formatLineComments(drafts))
    setDrafts([])
    onOpenChange(false)
  }

  const wholeFileSelected = !!selection?.whole && selection.repo === repo && selection.path === selected

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,900px)] max-w-[min(1280px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 py-2.5 pl-4 pr-14">
          <FileDiff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <DialogTitle className="text-[13px] font-medium tracking-normal">
            {t("lab.diff.title", { defaultValue: "Changes" })}
          </DialogTitle>
          <DialogDescription className="min-w-0 truncate text-xs">
            {diff.kind === "ready"
              ? [
                  t("lab.diff.fileCount", { defaultValue: "{{count}} files changed", defaultValue_one: "{{count}} file changed", count: fileCount }),
                  repoDiff ? `${repoDiff.branch} → ${repoDiff.base}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("lab.diff.description", { defaultValue: "The change against its base branches" })}
          </DialogDescription>
        </div>

        {diff.kind === "loading" ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              {t("lab.diff.loading", { defaultValue: "Reading the changes" })}
            </span>
          </div>
        ) : diff.kind === "error" ? (
          <div role="alert" className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
            <p className="max-w-md">{diff.message}</p>
          </div>
        ) : fileCount === 0 ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
            {t("lab.diff.empty", { defaultValue: "The change has no file changes yet." })}
          </div>
        ) : (
          <>
            <div role="tablist" className="flex shrink-0 gap-1 border-b border-border/60 px-3 pt-1.5">
              {diff.value.repos.map((r) => (
                <button
                  key={r.repo}
                  type="button"
                  role="tab"
                  aria-selected={r.repo === repo}
                  onClick={() => showRepo(r.repo)}
                  className={cn(
                    "-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-xs",
                    r.repo === repo
                      ? "border-border/60 border-b-background bg-background font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {repoName(t, r.repo)} <span className="text-muted-foreground">{r.files.length}</span>
                </button>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[264px_minmax(0,1fr)] sm:grid-rows-1">
              <nav
                aria-label={t("lab.diff.treeLabel", { defaultValue: "Changed files" })}
                className="min-h-0 overflow-auto border-b border-border/60 bg-muted/30 px-1.5 py-2.5 text-[13px] sm:border-b-0 sm:border-r"
              >
                {tree ? (
                  <FileTree
                    node={tree}
                    prefix=""
                    depth={0}
                    selected={selected}
                    closed={closed}
                    aiFiles={NO_AI_FILES}
                    onToggle={toggle}
                    onSelect={setSelected}
                  />
                ) : null}
              </nav>
              <div className="code-surface flex min-h-0 min-w-0 flex-col">
                {file && repo ? (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-3.5 py-2 text-xs">
                      <span className="min-w-0 truncate font-mono">
                        {file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path}
                      </span>
                      <span className="code-surface-muted shrink-0">
                        {t(`lab.fileStatus.${file.status}`, { defaultValue: file.status })}
                      </span>
                      {file.additions !== null && file.deletions !== null ? (
                        <span className="shrink-0 font-mono text-[11px]">
                          <span className="text-emerald-400">+{file.additions}</span>{" "}
                          <span className="text-red-400">−{file.deletions}</span>
                        </span>
                      ) : null}
                      {file.redactions > 0 ? (
                        <span
                          className="shrink-0 rounded border border-amber-500/40 px-1.5 text-[11px] text-amber-300"
                          title={t("lab.diff.redactionsTitle", {
                            defaultValue: "Values that look like secrets were replaced before the diff left the server.",
                          })}
                        >
                          {t("lab.diff.redactions", {
                            count: file.redactions,
                            defaultValue_one: "{{count}} value hidden",
                            defaultValue: "{{count}} values hidden",
                          })}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="ml-auto text-[#d5dce2] hover:bg-white/10 hover:text-white"
                        onClick={() => setSelection({ repo, path: file.path, whole: true })}
                      >
                        <MessageSquarePlus />
                        {t("lab.diff.commentOnFile", { defaultValue: "Comment on the file" })}
                      </Button>
                    </div>
                    {wholeFileSelected ? <div className="border-b border-white/10">{commentBox([])}</div> : null}
                    <div className={cn("min-h-0 flex-1 overflow-auto", DIFF_THEME)}>
                      {needsAlone && aloneState?.kind !== "ready" ? (
                        aloneState?.kind === "error" ? (
                          <p role="alert" className="p-6 text-center text-sm text-red-300">
                            {aloneState.message}
                          </p>
                        ) : (
                          <p className="code-surface-muted inline-flex w-full items-center justify-center gap-2 p-6 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("lab.diff.loadingFile", { defaultValue: "Reading this file's diff" })}
                          </p>
                        )
                      ) : file.binary || file.omitted === "binary" ? (
                        <p className="code-surface-muted p-6 text-center text-sm">
                          {t("lab.diff.binary", { defaultValue: "Binary file: no diff to show." })}
                        </p>
                      ) : file.patch === null ? (
                        <p className="code-surface-muted p-6 text-center text-sm">
                          {t("lab.diff.tooLarge", { defaultValue: "This file's diff is too large to show." })}
                        </p>
                      ) : (
                        <FilePatch
                          file={file}
                          repo={repo}
                          selection={selection}
                          onSelect={selectLine}
                          commentBox={commentBox}
                        />
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}

        <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 px-4 py-2.5 text-xs sm:flex-row sm:items-end">
          {drafts.length > 0 ? (
            <ol
              aria-label={t("lab.diff.draftLabel", { defaultValue: "Comments to send" })}
              className="max-h-28 min-w-0 flex-1 list-decimal space-y-0.5 overflow-auto pl-5"
            >
              {drafts.map((comment, i) => (
                <li key={i} className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {repoName(t, comment.repo)} {comment.path}, {describeComment(t, comment)}
                    </span>
                    <span className="min-w-0 truncate text-foreground">{comment.text}</span>
                    <button
                      type="button"
                      onClick={() => setDrafts((previous) => previous.filter((_, j) => j !== i))}
                      aria-label={t("lab.diff.removeComment", { defaultValue: "Remove comment {{number}}", number: i + 1 })}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex-1 text-muted-foreground">
              {t("lab.diff.hint", {
                defaultValue: "Click a line number to comment on it, Shift-click another to select a range.",
              })}
            </p>
          )}
          <Button type="button" size="xs" onClick={send} disabled={drafts.length === 0} className="self-end">
            <Send />
            {t("lab.diff.send", { defaultValue: "Send to the lab agent" })}
            {drafts.length > 0 ? ` (${drafts.length})` : null}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
