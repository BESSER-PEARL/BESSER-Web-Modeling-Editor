import React, { useEffect, useMemo, useState } from "react"
import JSZip from "jszip"
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import css from "highlight.js/lib/languages/css"
import dart from "highlight.js/lib/languages/dart"
import dockerfile from "highlight.js/lib/languages/dockerfile"
import go from "highlight.js/lib/languages/go"
import ini from "highlight.js/lib/languages/ini"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import kotlin from "highlight.js/lib/languages/kotlin"
import python from "highlight.js/lib/languages/python"
import rust from "highlight.js/lib/languages/rust"
import sql from "highlight.js/lib/languages/sql"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"
import { ChevronDown, Download, FileText, Folder, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDownloadTtlMinutes } from "@/components/chatbot-kit/hooks/use-download-ttl-minutes"
import {
  isAgentTracePath,
  readRunAttribution,
  type FileAttribution,
  type LineAuthor,
  type RunAttribution,
} from "@/components/chatbot-kit/ui/agent-trace"
import "./code-surface.css"
import "./generated-files-dialog.css"

const LANGUAGES = {
  bash, css, dart, dockerfile, go, ini, java, javascript, json, kotlin,
  python, rust, sql, typescript, xml, yaml,
}
for (const [name, lang] of Object.entries(LANGUAGES)) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, lang)
}

// "markdown" is coloured by highlightMarkdown, not hljs.
const EXT_LANG: Record<string, keyof typeof LANGUAGES | "markdown"> = {
  sh: "bash", css: "css", scss: "css", dart: "dart", go: "go",
  ini: "ini", toml: "ini", cfg: "ini", env: "ini", java: "java",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", kt: "kotlin", md: "markdown", py: "python", rs: "rust",
  sql: "sql", ts: "typescript", tsx: "typescript",
  html: "xml", htm: "xml", xml: "xml", svg: "xml", yml: "yaml", yaml: "yaml",
}

// Past these sizes a file is not shown / not highlighted (hljs is synchronous).
const MAX_PREVIEW_BYTES = 512 * 1024
const MAX_HIGHLIGHT_BYTES = 200 * 1024
// The Agent Trace record is read whole, past the preview cap: a large app's record outgrows it.
const MAX_TRACE_BYTES = 16 * 1024 * 1024

export interface GeneratedFile {
  path: string
  size: number
  /** null when the file is binary or too large to preview. */
  text: string | null
}

export const langOf = (path: string): string | null => {
  const name = path.split("/").pop() ?? path
  if (name === "Dockerfile" || name.startsWith("Dockerfile.")) return "dockerfile"
  if (name.startsWith(".env")) return "ini"
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : ""
  return EXT_LANG[ext] ?? null
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Line-based markdown colouring. hljs's markdown grammar lets an intra-word
 * `_` (`Class_Diagram`) open emphasis that runs across the rest of a README.
 */
function highlightMarkdown(src: string): string {
  let fenced = false
  return src
    .split("\n")
    .map((line) => {
      const safe = escapeHtml(line)
      if (/^\s*```/.test(line)) {
        fenced = !fenced
        return `<span class="hljs-code">${safe}</span>`
      }
      if (fenced) return `<span class="hljs-code">${safe}</span>`
      if (/^#{1,6}\s/.test(line)) return `<span class="hljs-section">${safe}</span>`
      if (/^\s*\|/.test(line)) return `<span class="hljs-comment">${safe}</span>`
      return safe
        .replace(/`[^`]+`/g, (m) => `<span class="hljs-code">${m}</span>`)
        .replace(/\*\*[^*]+\*\*/g, (m) => `<span class="hljs-strong">${m}</span>`)
        .replace(/\[[^\]]+\]\([^)]+\)/g, (m) => `<span class="hljs-link">${m}</span>`)
    })
    .join("\n")
}

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

/**
 * Unpack the generated artifact. A zip yields its files with a shared top
 * folder lifted into `root`; anything else is shown as the one file it is.
 */
export async function readGeneratedFiles(
  blob: Blob,
  fileName: string,
): Promise<{ root: string; files: GeneratedFile[] }> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(blob)
  } catch {
    const tooBig = blob.size > MAX_PREVIEW_BYTES
    return {
      root: "",
      files: [{ path: fileName, size: blob.size, text: tooBig ? null : await blob.text() }],
    }
  }
  const decoder = new TextDecoder()
  const files: GeneratedFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const bytes = await entry.async("uint8array")
    const binary = bytes.subarray(0, 8000).includes(0)
    // The record sits at the zip root, or under the one shared top folder lifted below.
    const isTrace = isAgentTracePath(entry.name) || isAgentTracePath(entry.name.slice(entry.name.indexOf("/") + 1))
    const limit = isTrace ? MAX_TRACE_BYTES : MAX_PREVIEW_BYTES
    files.push({
      path: entry.name,
      size: bytes.length,
      text: binary || bytes.length > limit ? null : decoder.decode(bytes),
    })
  }
  const first = files[0]?.path.split("/")[0]
  const shared =
    files.length > 0 && files.every((f) => f.path.includes("/") && f.path.split("/")[0] === first)
  if (shared) files.forEach((f) => (f.path = f.path.slice(first.length + 1)))
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { root: shared ? first : "", files }
}

interface TreeNode {
  dirs: Map<string, TreeNode>
  files: { path: string }[]
}

export function buildTree(files: { path: string }[]): TreeNode {
  const root: TreeNode = { dirs: new Map(), files: [] }
  for (const f of files) {
    let node = root
    for (const seg of f.path.split("/").slice(0, -1)) {
      if (!node.dirs.has(seg)) node.dirs.set(seg, { dirs: new Map(), files: [] })
      node = node.dirs.get(seg)!
    }
    node.files.push(f)
  }
  return root
}

export function FileTree({
  node,
  prefix,
  depth,
  selected,
  closed,
  aiFiles,
  onToggle,
  onSelect,
}: {
  node: TreeNode
  prefix: string
  depth: number
  selected: string | null
  closed: Set<string>
  /** Files with lines the AI wrote. */
  aiFiles: Set<string>
  onToggle: (dir: string) => void
  onSelect: (path: string) => void
}) {
  const { t } = useTranslation()
  const dirs = [...node.dirs.keys()].sort()
  return (
    <>
      {dirs.map((name) => {
        const dir = prefix + name
        const isClosed = closed.has(dir)
        return (
          <div key={dir}>
            <button
              type="button"
              onClick={() => onToggle(dir)}
              aria-expanded={!isClosed}
              style={{ paddingLeft: 8 + depth * 14 }}
              className="flex w-full items-center gap-1.5 rounded-md py-[3px] pr-2 text-left font-medium text-foreground hover:bg-muted"
            >
              <ChevronDown
                className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", isClosed && "-rotate-90")}
              />
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
            </button>
            {isClosed ? null : (
              <FileTree
                node={node.dirs.get(name)!}
                prefix={dir + "/"}
                depth={depth + 1}
                selected={selected}
                closed={closed}
                aiFiles={aiFiles}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          </div>
        )
      })}
      {node.files.map((f) => {
        const name = f.path.split("/").pop()!
        const ext = name.includes(".") ? name.split(".").pop() : ""
        const active = f.path === selected
        return (
          <button
            key={f.path}
            type="button"
            onClick={() => onSelect(f.path)}
            aria-current={active ? "true" : undefined}
            style={{ paddingLeft: 22 + depth * 14 }}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md py-[3px] pr-2 text-left hover:bg-muted",
              active ? "bg-brand/10 font-medium text-brand-dark dark:text-brand-light" : "text-foreground/85",
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-brand" : "bg-border")} />
            <span className="truncate">{name}</span>
            {aiFiles.has(f.path) ? (
              <span
                title={t("assistant.generatedFiles.aiTagTitle")}
                className="gfd-ai-tag shrink-0 rounded px-1 font-mono text-[9px] font-semibold leading-[14px]"
              >
                {t("assistant.generatedFiles.aiTag")}
              </span>
            ) : null}
            {ext ? (
              <span className="ml-auto pl-2 font-mono text-[10px] text-muted-foreground/70">{ext}</span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

const AUTHORS: LineAuthor[] = ["ai", "generator", "human", "unknown"]

/** Consecutive lines with the same author, for the gutter bar. */
function authorRuns(authors: LineAuthor[]): { author: LineAuthor; count: number }[] {
  const runs: { author: LineAuthor; count: number }[] = []
  for (const author of authors) {
    const last = runs[runs.length - 1]
    if (last && last.author === author) last.count++
    else runs.push({ author, count: 1 })
  }
  return runs
}

/** Who wrote this file's lines, as a legend with counts. */
function AuthorshipLegend({ attribution }: { attribution: FileAttribution }) {
  const { t } = useTranslation()
  return (
    <span
      role="list"
      aria-label={t("assistant.generatedFiles.authorship")}
      className="code-surface-muted flex shrink-0 items-center gap-2.5 font-mono text-[11px]"
    >
      {AUTHORS.filter((a) => attribution.counts[a] > 0).map((author) => (
        <span key={author} role="listitem" className="inline-flex items-center gap-1">
          <span aria-hidden className={`gfd-author-${author} h-2 w-2 rounded-sm`} />
          {t(`assistant.generatedFiles.author.${author}`)} {attribution.counts[author]}
        </span>
      ))}
    </span>
  )
}

function CodeView({
  file,
  attribution,
  stale,
}: {
  file: GeneratedFile
  attribution?: FileAttribution
  /** The run recorded who wrote this file, but the file changed afterwards. */
  stale?: boolean
}) {
  const { t } = useTranslation()
  const lang = langOf(file.path)
  const html = useMemo(() => {
    if (file.text === null) return ""
    if (!lang || file.text.length > MAX_HIGHLIGHT_BYTES) return escapeHtml(file.text)
    if (lang === "markdown") return highlightMarkdown(file.text)
    try {
      return hljs.highlight(file.text, { language: lang }).value
    } catch {
      return escapeHtml(file.text)
    }
  }, [file, lang])
  const lines = file.text === null ? 0 : file.text.split("\n").length

  return (
    <div className="code-surface flex min-h-0 min-w-0 flex-col">
      <div className="gfd-tabs flex h-9 shrink-0 items-center gap-3 px-3.5 text-xs">
        <span className="gfd-tab flex h-full min-w-0 items-center gap-2 font-mono">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.path}</span>
        </span>
        {attribution ? (
          <span className="ml-auto">
            <AuthorshipLegend attribution={attribution} />
          </span>
        ) : stale ? (
          <span className="code-surface-muted ml-auto shrink-0 text-[11px]">
            {t("assistant.generatedFiles.authorshipStale")}
          </span>
        ) : null}
        <span
          className={cn(
            "code-surface-muted shrink-0 font-mono text-[11px]",
            attribution || stale ? "ml-3" : "ml-auto",
          )}
        >
          {file.text === null
            ? formatSize(file.size)
            : t("assistant.generatedFiles.fileMeta", {
                lines,
                size: formatSize(file.size),
                language: lang ?? t("assistant.generatedFiles.plainText"),
              })}
        </span>
      </div>
      {file.text === null ? (
        <div className="code-surface-muted grid flex-1 place-items-center p-6 text-center text-sm">
          {file.size > MAX_PREVIEW_BYTES
            ? t("assistant.generatedFiles.tooLarge")
            : t("assistant.generatedFiles.binary")}
        </div>
      ) : (
        <div className="gfd-code min-h-0 flex-1 overflow-auto font-mono text-xs leading-5">
          <div className="flex min-w-max py-2.5 pb-10">
            {attribution ? (
              <div data-testid="authorship-bar" className="flex w-1 shrink-0 flex-col">
                {authorRuns(attribution.authors).map((run, i) => (
                  <span
                    key={i}
                    data-author={run.author}
                    title={t(`assistant.generatedFiles.authorLines.${run.author}`, { count: run.count })}
                    className={`gfd-author-${run.author} block`}
                    style={{ height: `${run.count * 1.25}rem` }}
                  />
                ))}
              </div>
            ) : null}
            <pre aria-hidden className="gfd-gutter m-0 select-none px-4 text-right">
              {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
            </pre>
            <pre className="m-0 whitespace-pre pr-10">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

/** Mounted only on failure, so the server config is fetched only when needed. */
function LoadFailedNote() {
  const { t } = useTranslation()
  const minutes = useDownloadTtlMinutes()
  return (
    <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
      <p className="max-w-sm">{t("assistant.generatedFiles.loadFailed", { minutes })}</p>
    </div>
  )
}

/**
 * "View files" for a finished Spec-Driven run: the generated project in a file
 * tree with a highlighted, read-only viewer, without downloading it first.
 */
export default function GeneratedFilesDialog({
  open,
  onOpenChange,
  load,
  fileName,
  meta,
  runId,
  onDownload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves to the artifact, or null when it cannot be fetched. */
  load: () => Promise<Blob | null>
  fileName: string
  meta?: string
  /** Picks this run's Agent Trace record when the zip holds several. */
  runId?: string
  onDownload?: () => void
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "ready"; root: string; files: GeneratedFile[] }
  >({ kind: "loading" })
  const [selected, setSelected] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [attribution, setAttribution] = useState<RunAttribution | null>(null)

  useEffect(() => {
    if (!open || state.kind === "ready") return
    let cancelled = false
    setState({ kind: "loading" })
    void (async () => {
      const blob = await load()
      const result = blob ? await readGeneratedFiles(blob, fileName).catch(() => null) : null
      if (cancelled) return
      if (!result || result.files.length === 0) {
        setState({ kind: "error" })
        return
      }
      setState({ kind: "ready", ...result })
      // Who wrote which lines; best-effort, the files show without it.
      readRunAttribution(result.files, runId)
        .then((found) => {
          if (!cancelled) setAttribution(found)
        })
        .catch(() => undefined)
      const readme = result.files.find((f) => /^readme(\.md)?$/i.test(f.path))
      setSelected((readme ?? result.files[0]).path)
    })()
    return () => {
      cancelled = true
    }
    // Load once per open; a loaded project is kept while the card lives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tree = useMemo(() => (state.kind === "ready" ? buildTree(state.files) : null), [state])
  const file = state.kind === "ready" ? state.files.find((f) => f.path === selected) : undefined
  const title = state.kind === "ready" && state.root ? `${state.root}/` : fileName
  const aiFiles = useMemo(() => {
    const paths = new Set<string>()
    attribution?.files.forEach((f, path) => {
      if (f.counts.ai > 0) paths.add(path)
    })
    return paths
  }, [attribution])
  const aiShare = useMemo(() => {
    if (!attribution) return null
    let ai = 0
    let total = 0
    attribution.files.forEach((f) => {
      ai += f.counts.ai
      total += f.authors.length
    })
    return total > 0 ? Math.round((100 * ai) / total) : null
  }, [attribution])

  const toggle = (dir: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(86vh,860px)] max-w-[min(1200px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden overflow-y-hidden p-0">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 py-2.5 pl-4 pr-14">
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <DialogTitle className="min-w-0 truncate font-mono text-[13px] font-medium tracking-normal">
            {title}
          </DialogTitle>
          <DialogDescription className="min-w-0 truncate text-xs">
            {state.kind === "ready"
              ? [
                  t("assistant.generatedFiles.fileCount", { count: state.files.length }),
                  meta,
                  aiShare !== null ? t("assistant.generatedFiles.aiShare", { pct: aiShare }) : null,
                ].filter(Boolean).join(" · ")
              : meta}
          </DialogDescription>
          {onDownload ? (
            <Button type="button" variant="outline" size="xs" onClick={onDownload} className="ml-auto">
              <Download />
              {t("assistant.generatedFiles.download")}
            </Button>
          ) : null}
        </div>

        {state.kind === "loading" ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              {t("assistant.generatedFiles.opening")}
            </span>
          </div>
        ) : state.kind === "error" ? (
          <LoadFailedNote />
        ) : (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[264px_minmax(0,1fr)] sm:grid-rows-1">
            <nav
              aria-label={t("assistant.generatedFiles.treeLabel")}
              className="min-h-0 overflow-auto border-b border-border/60 bg-muted/30 px-1.5 py-2.5 text-[13px] sm:border-b-0 sm:border-r"
            >
              <FileTree
                node={tree!}
                prefix=""
                depth={0}
                selected={selected}
                closed={closed}
                aiFiles={aiFiles}
                onToggle={toggle}
                onSelect={setSelected}
              />
            </nav>
            {file ? (
              <CodeView
                key={file.path}
                file={file}
                attribution={attribution?.files.get(file.path)}
                stale={attribution?.stale.has(file.path)}
              />
            ) : (
              <div className="code-surface" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
