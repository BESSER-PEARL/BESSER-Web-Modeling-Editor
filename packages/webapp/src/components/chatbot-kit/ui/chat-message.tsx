import React, { useMemo, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { Ban, ChevronRight, Code2, Loader2, Terminal } from "lucide-react"

import { cn } from "@/lib/utils"
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
}

export interface ChatMessageProps extends Message {
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  MessageBadge — visual badge for different message types            */
/* ------------------------------------------------------------------ */

function MessageBadge({ message }: { message: ChatMessageProps }) {
  if (message.isProgress) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        In progress
      </span>
    )
  }
  if (message.isError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
        Error
      </span>
    )
  }
  if (message.injectionType) {
    const labels: Record<string, string> = {
      inject_element: "Applied",
      inject_complete_system: "System created",
      modify_model: "Modified",
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
        {labels[message.injectionType] || "Applied"}
      </span>
    )
  }
  if (message.isStreaming) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
        Typing
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
                          alt={`Attachment ${file.name}`}
                          className="max-h-48 max-w-[280px] object-contain"
                          src={objectUrl}
                        />
                      </div>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[90vh] max-w-[90vw] items-center justify-center border-none bg-transparent p-0 shadow-none">
                      <img
                        alt={`Attachment ${file.name}`}
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
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" aria-label="Toggle reasoning details">
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              <span>Thinking</span>
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

function ToolCall({
  toolInvocations,
}: Pick<ChatMessageProps, "toolInvocations">) {
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
                Cancelled{" "}
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
                  Calling{" "}
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
                    Result from{" "}
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
