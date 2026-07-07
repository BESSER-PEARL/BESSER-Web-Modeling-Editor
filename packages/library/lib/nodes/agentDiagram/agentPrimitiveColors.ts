import type { LucideIcon } from "lucide-react"
import {
  Bot,
  BookOpen,
  Braces,
  Brain,
  Code,
  Database,
  FolderOpen,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Monitor,
  Target,
  Wrench,
} from "lucide-react"

/**
 * Accent + icon system for the AgentDiagram nodes.
 *
 * The agent diagram is styled as an *AI-agent flow* (React-Flow-UI
 * "AI workflow editor" aesthetic) rather than reusing the plain UML class
 * box. Every agent node type gets its own accent + `lucide-react` icon so
 * the flow reads at a glance:
 *
 *   Flow          → State (indigo) / Reasoning (purple)
 *   Knowledge     → Intent (sky) / RAG (teal)
 *   Capabilities  → Tool (blue) / Skill (green) / Workspace (amber)
 *   Model         → LLM (violet, data-only)
 *
 * The accent drives the icon chip, the type badge and the card border;
 * translucent tints (via `color-mix`) keep it readable on light or dark
 * themed backgrounds. Icons are monochrome lucide components tinted white
 * on the accent chip — consistent across platforms (unlike emoji).
 */
export type AgentPrimitiveStyle = {
  accent: string
  tint: string
  Icon: LucideIcon
}

export const AGENT_PRIMITIVE_COLORS = {
  state: { accent: "#6366F1", tint: "rgba(99, 102, 241, 0.10)", Icon: MessageSquare },
  reasoning: { accent: "#7C3AED", tint: "rgba(124, 58, 237, 0.10)", Icon: Brain },
  intent: { accent: "#0EA5E9", tint: "rgba(14, 165, 233, 0.10)", Icon: Target },
  rag: { accent: "#14B8A6", tint: "rgba(20, 184, 166, 0.10)", Icon: Database },
  tool: { accent: "#3B82F6", tint: "rgba(59, 130, 246, 0.10)", Icon: Wrench },
  skill: { accent: "#22C55E", tint: "rgba(34, 197, 94, 0.10)", Icon: Lightbulb },
  workspace: { accent: "#F59E0B", tint: "rgba(245, 158, 11, 0.12)", Icon: FolderOpen },
  llm: { accent: "#8B5CF6", tint: "rgba(139, 92, 246, 0.10)", Icon: Bot },
} satisfies Record<string, AgentPrimitiveStyle>

/**
 * Icon for an `AgentStateBodyRow.replyType` — used to tag each reply
 * "step" pill inside a State card so the reply kind is visible without
 * opening the inspector. Falls back to the plain message icon.
 */
export const replyTypeIcon = (replyType?: string): LucideIcon => {
  switch (replyType) {
    case "llm":
    case "llm_chat":
    case "web_crawl_llm":
      return Bot
    case "rag":
      return BookOpen
    case "db_reply":
      return Database
    case "code":
      return Code
    case "image":
      return ImageIcon
    case "json":
      return Braces
    default:
      if (replyType && replyType.startsWith("ws_")) return Monitor
      return MessageSquare
  }
}

/**
 * Shared single-line truncation for the card subtitles (develop's
 * `truncate` helper, duplicated per component there — centralised here).
 */
export const truncatePrimitiveSubtitle = (
  value: string | undefined,
  max = 48
): string => {
  if (!value) return ""
  const flat = value.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}
