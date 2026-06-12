/**
 * Accent colors for the reasoning-primitive elements (ReasoningState /
 * Tool / Skill / Workspace) so they are distinguishable at a glance on
 * the canvas. Develop source:
 * `agent-state-diagram/agent-primitive-colors.ts` (ReasoningState's
 * purple accent lived inline in its component there).
 *
 * The accent is used for the border and the «stereotype» label; the
 * tint is a translucent fill so it reads correctly over either the
 * light or dark themed background.
 */
export const AGENT_PRIMITIVE_COLORS = {
  reasoning: { accent: "#7C3AED", tint: "rgba(124, 58, 237, 0.08)", icon: "▷" },
  tool: { accent: "#3B82F6", tint: "rgba(59, 130, 246, 0.10)", icon: "🔧" },
  skill: { accent: "#22C55E", tint: "rgba(34, 197, 94, 0.10)", icon: "💡" },
  workspace: { accent: "#F59E0B", tint: "rgba(245, 158, 11, 0.12)", icon: "📁" },
} as const

/**
 * Shared single-line truncation for the primitive subtitles (develop's
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
