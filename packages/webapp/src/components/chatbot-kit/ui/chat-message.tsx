import React, { useMemo, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Code2,
  Download,
  Github,
  Loader2,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  XCircle,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { cancelSpecDrivenUrl } from "@/main/shared/constants/constant"
import { fetchAndSaveSpecDrivenArtifact } from "@/main/shared/utils/specDrivenDownload"
import { downloadFile } from "@/main/shared/utils/download"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FilePreview } from "@/components/chatbot-kit/ui/file-preview"
import { MarkdownRenderer } from "@/components/chatbot-kit/ui/markdown-renderer"

const chatBubbleVariants = cva(
  "group/message relative break-words rounded-lg p-3 text-sm sm:max-w-[70%]",
  {
    variants: {
      isUser: {
        true: "bg-brand text-brand-foreground",
        false: "bg-muted text-foreground",
      },
      animation: {
        none: "",
        slide: "duration-300 animate-in fade-in-0",
        scale: "duration-300 animate-in fade-in-0 zoom-in-75",
        fade: "duration-500 animate-in fade-in-0",
      },
    },
    compoundVariants: [
      {
        isUser: true,
        animation: "slide",
        class: "slide-in-from-right",
      },
      {
        isUser: false,
        animation: "slide",
        class: "slide-in-from-left",
      },
      {
        isUser: true,
        animation: "scale",
        class: "origin-bottom-right",
      },
      {
        isUser: false,
        animation: "scale",
        class: "origin-bottom-left",
      },
    ],
  }
)

type Animation = VariantProps<typeof chatBubbleVariants>["animation"]

interface Attachment {
  name?: string
  contentType?: string
  url: string
}

interface PartialToolCall {
  state: "partial-call"
  toolName: string
}

interface ToolCall {
  state: "call"
  toolName: string
}

interface ToolResult {
  state: "result"
  toolName: string
  result: {
    __cancelled?: boolean
    [key: string]: any
  }
}

type ToolInvocation = PartialToolCall | ToolCall | ToolResult

interface ReasoningPart {
  type: "reasoning"
  reasoning: string
}

interface ToolInvocationPart {
  type: "tool-invocation"
  toolInvocation: ToolInvocation
}

interface TextPart {
  type: "text"
  text: string
}

// For compatibility with AI SDK types, not used
interface SourcePart {
  type: "source"
  source?: any
}

interface FilePart {
  type: "file"
  mimeType: string
  data: string
}

interface StepStartPart {
  type: "step-start"
}

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolInvocationPart
  | SourcePart
  | FilePart
  | StepStartPart

export interface SpecDrivenToolCallView {
  turn: number
  tool: string
  summary?: string | null
}

export interface SpecDrivenPhaseView {
  phase: string
  label: string
  message: string
  toolCalls: SpecDrivenToolCallView[]
  /**
   * Long-form details attached to a phase after the fact (e.g. the gap
   * analyser's task list). Rendered behind a chevron in
   * SpecDrivenPhaseRow when present.
   */
  details?: string
}

export interface SpecDrivenWarningView {
  code: string
  message: string
}

export interface SpecDrivenMessageState {
  runId?: string
  provider?: string
  model?: string
  phases: SpecDrivenPhaseView[]
  warnings: SpecDrivenWarningView[]
  text: string
  status: "running" | "done" | "error"
  /** Live spend so far in USD (from the backend's 2s cost events). */
  costUsd?: number
  /** Elapsed run time in seconds (from the backend's 2s cost events). */
  elapsedSeconds?: number
  /** Cost budget for this run in USD (from the start event). */
  maxCost?: number
  /** Runtime budget for this run in seconds (from the start event). */
  maxRuntime?: number
  /** Backend download URL carried by the done event. */
  downloadUrl?: string
  /** Artifact filename carried by the done event. */
  fileName?: string
  /** Whether the artifact is a zip (done event). */
  isZip?: boolean
  /**
   * The deterministic generator BESSER used (e.g. `fastapi`, `django`,
   * `web_app`), read from the done event's recipe. Shown on the compact
   * completion card as a short "what was generated" hint.
   */
  generatorUsed?: string
  /** Number of user files the run produced — shown on the compact card. */
  fileCount?: number
  /** Total LLM tokens this run consumed — shown as "N tokens" on a spec-driven
   * run's card (the deterministic card shows "0 tokens" instead). */
  tokensUsed?: number
  /**
   * Generation succeeded but the browser download failed. The artifact
   * stays on the server (~30 min TTL) so "Download again" can retry.
   */
  downloadFailed?: boolean
  /**
   * Generation succeeded and the artifact is ready, but it has NOT been
   * saved to the user's disk yet. The run no longer auto-downloads —
   * the user must click "Download" on the card to consent to the save.
   */
  needsDownload?: boolean
  /**
   * True when this card is a purely DETERMINISTIC generator run (no LLM) —
   * BESSER's built-in generators. Renders "Generated deterministically" with a
   * "0 tokens" badge instead of provider/model, and downloads the in-hand
   * artifact blob directly (there is no server-side run id to re-fetch).
   */
  deterministic?: boolean
  /** The generated artifact for a deterministic run's manual Download button. */
  deterministicBlob?: Blob
}

export interface Message {
  id: string
  role: "user" | "assistant" | (string & {})
  content: string
  createdAt?: Date
  experimental_attachments?: Attachment[]
  toolInvocations?: ToolInvocation[]
  parts?: MessagePart[]
  /** True when this message represents a progress/status update. */
  isProgress?: boolean
  /** Current step index (1-based) for progress messages. */
  progressStep?: number
  /** Total number of steps for progress messages. */
  progressTotal?: number
  /** True when this message represents an error. */
  isError?: boolean
  /** True when the assistant is still streaming this message. */
  isStreaming?: boolean
  /** The injection action type, if the message was the result of an injection. */
  injectionType?: string
  /** Structured smart-generator run state, rendered as a card. */
  specDriven?: SpecDrivenMessageState
}

export interface ChatMessageProps extends Message {
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
  /**
   * Handler for the SpecDrivenCard's "Push to GitHub" button. Supplied by the
   * assistant surface (via MessageList's messageOptions) so the push flow has
   * access to the current project + GitHub auth. When omitted, the button is
   * hidden (e.g. contexts without a project).
   */
  onPushToGithub?: (runId: string) => void
}

/* ------------------------------------------------------------------ */
/*  MessageBadge — visual badge for different message types            */
/* ------------------------------------------------------------------ */

function MessageBadge({ message }: { message: ChatMessageProps }) {
  const { t } = useTranslation()
  if (message.isProgress) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        {t("assistant.chatKit.badge.inProgress")}
      </span>
    )
  }
  if (message.isError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
        {t("assistant.chatKit.badge.error")}
      </span>
    )
  }
  if (message.injectionType) {
    const labels: Record<string, string> = {
      inject_element: t("assistant.chatKit.badge.applied"),
      inject_complete_system: t("assistant.chatKit.badge.systemCreated"),
      modify_model: t("assistant.chatKit.badge.modified"),
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <svg
          className="h-2.5 w-2.5"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {labels[message.injectionType] || t("assistant.chatKit.badge.applied")}
      </span>
    )
  }
  if (message.isStreaming) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
        {t("assistant.chatKit.badge.typing")}
      </span>
    )
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  StreamingCursor — blinking cursor appended while streaming         */
/* ------------------------------------------------------------------ */

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60" />
  )
}

export const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { t } = useTranslation()
  const {
    role,
    content,
    createdAt,
    showTimeStamp = false,
    animation = "scale",
    actions,
    experimental_attachments,
    toolInvocations,
    parts,
    isProgress,
    progressStep,
    progressTotal,
    isError,
    isStreaming,
    injectionType,
    specDriven,
    onPushToGithub,
  } = props
  const files = useMemo(() => {
    return experimental_attachments?.map((attachment) => {
      const dataArray = dataUrlToUint8Array(attachment.url)
      const file = new File([dataArray], attachment.name ?? "Unknown", {
        type: attachment.contentType,
      })
      return file
    })
  }, [experimental_attachments])

  const isUser = role === "user"

  const formattedTime = createdAt?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  if (isUser) {
    return (
      <div
        className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
      >
        {files ? (
          <div className="mb-1 flex flex-wrap gap-2">
            {files.map((file, index) => {
              if (file.type.startsWith("image/")) {
                const objectUrl = URL.createObjectURL(file)
                return (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <div className="cursor-pointer overflow-hidden rounded-lg border transition-opacity hover:opacity-80">
                        <img
                          alt={t("assistant.chatKit.attachmentAlt", { name: file.name })}
                          className="max-h-48 max-w-[280px] object-contain"
                          src={objectUrl}
                        />
                      </div>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[90vh] max-w-[90vw] items-center justify-center border-none bg-transparent p-0 shadow-none">
                      <img
                        alt={t("assistant.chatKit.attachmentAlt", { name: file.name })}
                        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
                        src={objectUrl}
                      />
                    </DialogContent>
                  </Dialog>
                )
              }
              return <FilePreview file={file} key={index} />
            })}
          </div>
        ) : null}

        <div className={cn(chatBubbleVariants({ isUser, animation }))}>
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>

        {showTimeStamp && createdAt ? (
          <time
            dateTime={createdAt.toISOString()}
            className={cn(
              "mt-1 block px-1 text-xs opacity-50",
              animation !== "none" && "duration-500 animate-in fade-in-0"
            )}
          >
            {formattedTime}
          </time>
        ) : null}
      </div>
    )
  }

  if (parts && parts.length > 0) {
    return parts.map((part, index) => {
      if (part.type === "text") {
        const isFirstTextPart = parts.findIndex((p) => p.type === "text") === index
        const isLastTextPart =
          parts.filter((p) => p.type === "text").length - 1 ===
          parts.filter((p, i) => p.type === "text" && i <= index).length - 1

        return (
          <div
            className={cn(
              "flex flex-col",
              isUser ? "items-end" : "items-start"
            )}
            key={`text-${index}`}
          >
            {!isUser && isFirstTextPart && <MessageBadge message={props} />}
            <div className={cn(chatBubbleVariants({ isUser, animation }), !isUser && isFirstTextPart && (injectionType || isStreaming) && "mt-1")}>
              <MarkdownRenderer>{part.text}</MarkdownRenderer>
              {isStreaming && isLastTextPart && <StreamingCursor />}
              {actions ? (
                <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border border-border/60 bg-background p-1 text-muted-foreground shadow-sm opacity-0 transition-all duration-200 group-hover/message:opacity-100">
                  {actions}
                </div>
              ) : null}
            </div>

            {showTimeStamp && createdAt ? (
              <time
                dateTime={createdAt.toISOString()}
                className={cn(
                  "mt-1 block px-1 text-xs opacity-50",
                  animation !== "none" && "duration-500 animate-in fade-in-0"
                )}
              >
                {formattedTime}
              </time>
            ) : null}
          </div>
        )
      } else if (part.type === "reasoning") {
        return <ReasoningBlock key={`reasoning-${index}`} part={part} />
      } else if (part.type === "tool-invocation") {
        return (
          <ToolCall
            key={`tool-${index}`}
            toolInvocations={[part.toolInvocation]}
          />
        )
      }
      return null
    })
  }

  if (toolInvocations && toolInvocations.length > 0) {
    return <ToolCall toolInvocations={toolInvocations} />
  }

  /* ---- Progress message: compact status-bar style ---- */
  if (isProgress) {
    return (
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          {content}
          {typeof progressTotal === "number" && progressTotal > 0 && (
            <span className="ml-auto text-[10px] opacity-60">
              {progressStep}/{progressTotal}
            </span>
          )}
        </div>
      </div>
    )
  }

  /* ---- Error message: red/amber alert style ---- */
  if (isError) {
    return (
      <div className="flex flex-col items-start">
        <MessageBadge message={props} />
        <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-200">
          {content}
        </div>
      </div>
    )
  }

  /* ---- Smart Generator: structured run card ---- */
  if (specDriven) {
    return (
      <div className="flex w-full flex-col items-start sm:max-w-[85%]">
        <SpecDrivenCard
          specDriven={specDriven}
          isStreaming={isStreaming === true}
          onPushToGithub={onPushToGithub}
        />
        {showTimeStamp && createdAt ? (
          <time
            dateTime={createdAt.toISOString()}
            className={cn(
              "mt-1 block px-1 text-xs opacity-50",
              animation !== "none" && "duration-500 animate-in fade-in-0"
            )}
          >
            {formattedTime}
          </time>
        ) : null}
      </div>
    )
  }

  /* ---- Default assistant / fallback message ---- */
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      {!isUser && <MessageBadge message={props} />}
      <div className={cn(chatBubbleVariants({ isUser, animation }), !isUser && (injectionType || isStreaming) && "mt-1")}>
        <MarkdownRenderer>{content}</MarkdownRenderer>
        {isStreaming && <StreamingCursor />}
        {actions ? (
          <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border border-border/60 bg-background p-1 text-muted-foreground shadow-sm opacity-0 transition-all duration-200 group-hover/message:opacity-100">
            {actions}
          </div>
        ) : null}
      </div>

      {showTimeStamp && createdAt ? (
        <time
          dateTime={createdAt.toISOString()}
          className={cn(
            "mt-1 block px-1 text-xs opacity-50",
            animation !== "none" && "duration-500 animate-in fade-in-0"
          )}
        >
          {formattedTime}
        </time>
      ) : null}
    </div>
  )
}

function dataUrlToUint8Array(data: string) {
  const base64 = data.split(",")[1] ?? ""
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const ReasoningBlock = ({ part }: { part: ReasoningPart }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mb-2 flex flex-col items-start sm:max-w-[70%]">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="group w-full overflow-hidden rounded-lg border border-border/60 bg-muted/50"
      >
        <div className="flex items-center p-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" aria-label={t("assistant.chatKit.toggleReasoning")}>
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              <span>{t("assistant.chatKit.thinking")}</span>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent forceMount>
          <motion.div
            initial={false}
            animate={isOpen ? "open" : "closed"}
            variants={{
              open: { height: "auto", opacity: 1 },
              closed: { height: 0, opacity: 0 },
            }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="border-t"
          >
            <div className="p-2">
              <div className="whitespace-pre-wrap text-xs">
                {part.reasoning}
              </div>
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function SpecDrivenStatusPill({ status }: { status: SpecDrivenMessageState["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Running
      </span>
    )
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Done
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
      <XCircle className="h-2.5 w-2.5" />
      Error
    </span>
  )
}

function SpecDrivenPhaseRow({
  phase,
  isActivePhase,
}: {
  phase: SpecDrivenPhaseView
  isActivePhase: boolean
}) {
  const hasTools = phase.toolCalls.length > 0
  const hasDetails = typeof phase.details === "string" && phase.details.length > 0
  const isExpandable = hasTools || hasDetails
  const [expanded, setExpanded] = useState(false)

  // Toggle label: prefer the action count (familiar metric); otherwise
  // a generic "details" link for phases that only carry prose (e.g.
  // gap analyser surfacing its task list).
  const toggleLabel = hasTools
    ? `${phase.toolCalls.length} ${phase.toolCalls.length === 1 ? "action" : "actions"}`
    : "details"

  return (
    <li className="border-b border-border/40 last:border-b-0">
      <div className="flex items-baseline gap-2 px-3 py-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {phase.phase}
        </span>
        <span className="text-[13px] font-medium text-foreground">
          {phase.label}
        </span>
        {phase.message && phase.message !== phase.label ? (
          <span className="truncate text-xs text-muted-foreground">
            — {phase.message}
          </span>
        ) : null}
        {isActivePhase ? (
          <Loader2 className="ml-1 h-3 w-3 animate-spin text-primary" />
        ) : null}
        {isExpandable ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span>{toggleLabel}</span>
            <ChevronRight
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : null}
      </div>
      {expanded && hasDetails ? (
        <div className="border-t border-border/40 bg-background/40 px-3 py-2 pl-6 text-xs text-muted-foreground">
          <MarkdownRenderer>{phase.details!}</MarkdownRenderer>
        </div>
      ) : null}
      {expanded && hasTools ? (
        <ul className="flex flex-col gap-0.5 px-3 pb-2 pl-6">
          {phase.toolCalls.map((tc, j) => (
            <li
              key={`${tc.turn}-${tc.tool}-${j}`}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Wrench className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="font-mono text-foreground">{tc.tool}</span>
              <span className="text-[10px] opacity-60">turn {tc.turn}</span>
              {tc.summary ? (
                <span className="truncate">— {tc.summary}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** `3m 10s` / `45s` / `10m` — compact duration for the runtime meter. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m === 0) return `${rem}s`
  if (rem === 0) return `${m}m`
  return `${m}m ${rem}s`
}

function SpecDrivenCard({
  specDriven,
  isStreaming,
  onStop,
  onPushToGithub,
}: {
  specDriven: SpecDrivenMessageState
  isStreaming: boolean
  /**
   * Optional override for the Stop action — defaults to a self-contained
   * fire-and-forget POST to the backend cancel endpoint. The backend
   * then terminates the SSE stream with a CANCELLED event which the
   * run's existing error handling renders. Deliberately independent of
   * the chat's `isGenerating` flag (which auto-clears after 120s and on
   * any incoming WS message — long before a smart-gen run finishes).
   */
  onStop?: (runId: string) => void
  /**
   * Push the finished generation (code + model) to GitHub. Supplied by the
   * assistant surface so the handler has the current project + GitHub auth.
   * When omitted the button is hidden. Rendered next to Download and gated on
   * the same `canRedownload` condition (a finished run with a run id + file).
   */
  onPushToGithub?: (runId: string) => void
}) {
  // Note: costUsd/maxCost exist on the state (the hook still tracks them
  // for the agent outcome report) but are deliberately NOT rendered —
  // the estimate is too rough to show users as if it were a bill.
  const {
    runId,
    provider,
    model,
    phases,
    warnings,
    text,
    status,
    elapsedSeconds,
    maxRuntime,
    fileName,
    isZip,
    downloadFailed,
    needsDownload,
    generatorUsed,
    fileCount,
    tokensUsed,
    deterministic,
    deterministicBlob,
  } = specDriven

  const [stopRequested, setStopRequested] = useState(false)
  const [redownloadState, setRedownloadState] = useState<
    "idle" | "busy" | "failed"
  >("idle")
  // The run no longer auto-saves the artifact (consent fix). Track
  // whether the user has saved it yet so the button reads "Download"
  // before the first save and "Download again" afterwards.
  const [hasDownloaded, setHasDownloaded] = useState(false)
  // Completed runs collapse to a compact line, but the phase/tool-call timeline
  // stays available behind a toggle — users asked to still see what the agent
  // did ("the tool calling and etc") after the run finishes, not just while it
  // is running.
  const [showSteps, setShowSteps] = useState(false)

  const handleStop = () => {
    if (!runId || stopRequested) return
    setStopRequested(true)
    if (onStop) {
      onStop(runId)
      return
    }
    // Fire-and-forget — no body needed. Errors are swallowed: if the
    // cancel request itself fails the run simply keeps streaming and
    // the user can hit Stop again after the button re-enables.
    void fetch(cancelSpecDrivenUrl(runId), { method: "POST" })
      .then((response) => {
        if (!response.ok) setStopRequested(false)
      })
      .catch(() => {
        setStopRequested(false)
      })
  }

  const handleRedownload = async () => {
    if (!runId || !fileName || redownloadState === "busy") return
    setRedownloadState("busy")
    const result = await fetchAndSaveSpecDrivenArtifact(
      runId,
      fileName,
      isZip === true
    )
    setRedownloadState(result.ok ? "idle" : "failed")
    if (result.ok) setHasDownloaded(true)
  }

  // Deterministic runs hold the artifact in-hand (no server run id), so the
  // Download button saves the blob directly instead of re-fetching by run id.
  const handleDeterministicDownload = () => {
    if (!deterministicBlob) return
    try {
      downloadFile(deterministicBlob, fileName || "generated_code.zip", deterministicBlob.type || "application/zip")
      setHasDownloaded(true)
    } catch {
      setRedownloadState("failed")
    }
  }
  const canDetDownload = status === "done" && deterministic === true && deterministicBlob instanceof Blob

  const showMeter =
    (status === "running" || status === "done") &&
    typeof elapsedSeconds === "number"
  const showStop = status === "running" && typeof runId === "string"
  const canRedownload =
    status === "done" &&
    typeof runId === "string" &&
    typeof fileName === "string"
  const showFooter = showMeter || showStop || canRedownload

  // Completed run: collapse the big phased card to a SMALL inline line with a
  // compact download button (the process timeline is no longer useful once the
  // app is ready). Warnings and the download-failed note stay visible.
  if (status === "done") {
    const isFirstSave = needsDownload === true && !hasDownloaded
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-muted/40 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-[13px] font-medium text-foreground">
            {deterministic ? "Generated deterministically" : "Application ready"}
          </span>
          {generatorUsed ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              · {generatorUsed}
            </span>
          ) : null}
          {typeof fileCount === "number" && fileCount > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              · {fileCount} file{fileCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {!deterministic && typeof tokensUsed === "number" && tokensUsed > 0 ? (
            <span
              className="font-mono text-[11px] text-muted-foreground"
              title="LLM tokens this run consumed"
            >
              · {tokensUsed.toLocaleString()} tokens
            </span>
          ) : null}
          {deterministic ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary"
              title="Built by BESSER's deterministic generator — no LLM, no tokens, exact output."
            >
              0 tokens
            </span>
          ) : null}
          {phases.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              aria-expanded={showSteps}
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span>{showSteps ? "Hide steps" : "Show steps"}</span>
              <ChevronRight
                className={`h-3 w-3 transition-transform ${showSteps ? "rotate-90" : ""}`}
              />
            </button>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            {redownloadState === "failed" ? (
              <span className="text-[11px] text-red-600 dark:text-red-400">
                Retry failed
              </span>
            ) : null}
            {canDetDownload ? (
              <button
                type="button"
                onClick={handleDeterministicDownload}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
                  hasDownloaded
                    ? "border border-border/60 bg-background text-foreground hover:bg-muted"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Download className="h-3 w-3" />
                {hasDownloaded ? "Download again" : "Download"}
              </button>
            ) : null}
            {canRedownload ? (
              <button
                type="button"
                onClick={() => void handleRedownload()}
                disabled={redownloadState === "busy"}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-50",
                  isFirstSave
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border/60 bg-background text-foreground hover:bg-muted"
                )}
              >
                {redownloadState === "busy" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {isFirstSave ? "Download" : "Download again"}
              </button>
            ) : null}
            {canRedownload && onPushToGithub && runId ? (
              <button
                type="button"
                onClick={() => onPushToGithub(runId)}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                <Github className="h-3 w-3" />
                Push to GitHub
              </button>
            ) : null}
          </span>
        </div>

        {/* Run timeline — hidden by default, revealed via "Show steps" so users
            can still inspect the phases and tool calls after the run ends. */}
        {showSteps && phases.length > 0 ? (
          <ol className="flex flex-col border-t border-border/40">
            {phases.map((phase, i) => (
              <SpecDrivenPhaseRow
                key={`${phase.phase}-${i}`}
                phase={phase}
                isActivePhase={false}
              />
            ))}
          </ol>
        ) : null}

        {/* The model's own narration/output. Shown while streaming (running
            card); keep it inspectable after the run too, behind "Show steps",
            so the LLM's text isn't lost the moment the run finishes. */}
        {showSteps && typeof text === "string" && text.trim() ? (
          <div className="border-t border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <MarkdownRenderer>{text}</MarkdownRenderer>
          </div>
        ) : null}

        {/* Warnings (incomplete / timeout) stay visible on the compact card */}
        {warnings.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-950/20">
            {warnings.map((w, i) => (
              <div
                key={`${w.code}-${i}`}
                className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="font-mono">{w.code}</span>
                <span className="break-words">— {w.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Download failed — artifact still retrievable from the server */}
        {downloadFailed ? (
          <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              The download failed, but the generated file is still available on
              the server for about 30 minutes. Use &ldquo;Download again&rdquo;
              to retry.
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-muted/40 text-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/60 px-3 py-2 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">Spec-Driven Agent</span>
        {runId ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {runId.slice(0, 8)}…
          </span>
        ) : null}
        {provider ? (
          <span className="text-muted-foreground">
            • {provider}
            {model ? ` / ${model}` : ""}
          </span>
        ) : null}
        <span className="ml-auto">
          <SpecDrivenStatusPill status={status} />
        </span>
      </div>

      {/* Phases timeline */}
      {phases.length > 0 ? (
        <ol className="flex flex-col">
          {phases.map((phase, i) => {
            const isLast = i === phases.length - 1
            const isActivePhase = isLast && status === "running"
            return (
              <SpecDrivenPhaseRow
                key={`${phase.phase}-${i}`}
                phase={phase}
                isActivePhase={isActivePhase}
              />
            )
          })}
        </ol>
      ) : (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Waiting for the first event…
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-950/20">
          {warnings.map((w, i) => (
            <div
              key={`${w.code}-${i}`}
              className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="font-mono">{w.code}</span>
              <span className="break-words">— {w.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* LLM prose */}
      {text ? (
        <div className="border-t border-border/60 bg-background/40 px-3 py-2">
          <MarkdownRenderer>{text}</MarkdownRenderer>
          {isStreaming ? <StreamingCursor /> : null}
        </div>
      ) : null}

      {/* Download failed — artifact still retrievable from the server */}
      {downloadFailed ? (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            The download failed, but the generated file is still available on
            the server for about 30 minutes. Use &ldquo;Download again&rdquo;
            to retry.
          </span>
        </div>
      ) : null}

      {/* Footer: live cost/runtime meter + run controls */}
      {showFooter ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 bg-muted/60 px-3 py-1.5 text-xs">
          {showMeter ? (
            <span className="font-mono tabular-nums text-muted-foreground">
              {formatDuration(elapsedSeconds ?? 0)}
              {typeof maxRuntime === "number"
                ? ` / ${formatDuration(maxRuntime)}`
                : ""}
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            {redownloadState === "failed" ? (
              <span className="text-[11px] text-red-600 dark:text-red-400">
                Retry failed
              </span>
            ) : null}
            {canDetDownload ? (
              <button
                type="button"
                onClick={handleDeterministicDownload}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
                  hasDownloaded
                    ? "border border-border/60 bg-background text-foreground hover:bg-muted"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Download className="h-3 w-3" />
                {hasDownloaded ? "Download again" : "Download"}
              </button>
            ) : null}
            {canRedownload ? (
              (() => {
                // First save vs. re-download. Before the user has saved
                // the artifact (the run no longer auto-downloads), show a
                // prominent primary "Download" button to signal the
                // pending action; afterwards fall back to a subtle
                // "Download again".
                const isFirstSave = needsDownload === true && !hasDownloaded
                return (
                  <button
                    type="button"
                    onClick={() => void handleRedownload()}
                    disabled={redownloadState === "busy"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-50",
                      isFirstSave
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border/60 bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {redownloadState === "busy" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {isFirstSave ? "Download" : "Download again"}
                  </button>
                )
              })()
            ) : null}
            {canRedownload && onPushToGithub && runId ? (
              <button
                type="button"
                onClick={() => onPushToGithub(runId)}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                <Github className="h-3 w-3" />
                Push to GitHub
              </button>
            ) : null}
            {showStop ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopRequested}
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-background px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Square className="h-3 w-3" />
                {stopRequested ? "Stopping…" : "Stop"}
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function ToolCall({
  toolInvocations,
}: Pick<ChatMessageProps, "toolInvocations">) {
  const { t } = useTranslation()
  if (!toolInvocations?.length) return null

  return (
    <div className="flex flex-col items-start gap-2">
      {toolInvocations.map((invocation, index) => {
        const isCancelled =
          invocation.state === "result" &&
          invocation.result.__cancelled === true

        if (isCancelled) {
          return (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            >
              <Ban className="h-4 w-4" />
              <span>
                {t("assistant.chatKit.toolCancelled")}{" "}
                <span className="font-mono">
                  {"`"}
                  {invocation.toolName}
                  {"`"}
                </span>
              </span>
            </div>
          )
        }

        switch (invocation.state) {
          case "partial-call":
          case "call":
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"
              >
                <Terminal className="h-4 w-4 text-primary/70" />
                <span>
                  {t("assistant.chatKit.toolCalling")}{" "}
                  <span className="font-mono">
                    {"`"}
                    {invocation.toolName}
                    {"`"}
                  </span>
                  ...
                </span>
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              </div>
            )
          case "result":
            return (
              <div
                key={index}
                className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Code2 className="h-4 w-4 text-primary/60" />
                  <span>
                    {t("assistant.chatKit.toolResultFrom")}{" "}
                    <span className="font-mono">
                      {"`"}
                      {invocation.toolName}
                      {"`"}
                    </span>
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-foreground">
                  {JSON.stringify(invocation.result, null, 2)}
                </pre>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
