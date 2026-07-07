import { SVGComponentProps } from "@/types/SVG"
import { AgentStateBodyRow, AgentStateNodeProps } from "@/types"
import {
  AGENT_PRIMITIVE_COLORS,
  replyTypeIcon,
  truncatePrimitiveSubtitle,
} from "@/nodes/agentDiagram/agentPrimitiveColors"
import {
  AgentBadge,
  AgentNodeCard,
  AgentPill,
  AgentSectionLabel,
} from "@/nodes/agentDiagram/AgentNodeCard"
import { Bot, Map, RotateCw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * AgentDiagram palette previews.
 *
 * These render the **real** on-canvas `AgentNodeCard` (HTML), not a
 * separate SVG mirror — so the drag panel and the canvas share a single
 * source of truth and can never drift. The sidebar + drag ghost both
 * instantiate this as a plain React component (see `Sidebar.tsx`
 * `React.createElement(config.svg, …)` and `DraggableGhost.tsx`), so HTML
 * is fine; there is no rasterization. The card is scaled to the sidebar
 * thumbnail size via `SIDEBAR_PREVIEW_SCALE`.
 *
 * (File/export names keep the historical `…SVG` spelling so `constants.ts`
 * doesn't need to change; the content is now HTML.)
 */

const ScaledAgentCard: React.FC<{
  width: number
  height: number
  scale: number
  accent: string
  Icon: LucideIcon
  typeLabel: string
  name: string
  headerRight?: React.ReactNode
  children?: React.ReactNode
}> = ({ width, height, scale, accent, Icon, typeLabel, name, headerRight, children }) => (
  <div style={{ width: width * scale, height: height * scale, overflow: "visible" }}>
    <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
      <AgentNodeCard
        width={width}
        height={height}
        accent={accent}
        icon={<Icon size={15} />}
        typeLabel={typeLabel}
        name={name}
        headerRight={headerRight}
      >
        {children}
      </AgentNodeCard>
    </div>
  </div>
)

type AgentStateSVGProps = SVGComponentProps & {
  data?: Partial<AgentStateNodeProps> & {
    name?: string
    bodies?: AgentStateBodyRow[]
    fallbackBodies?: AgentStateBodyRow[]
  }
}

export const AgentStateSVG: React.FC<AgentStateSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  data,
}) => {
  const bodies = data?.bodies ?? []
  const fallbackBodies = data?.fallbackBodies ?? []
  const hasFallbackDivider = fallbackBodies.length > 0 && bodies.length > 0
  return (
    <ScaledAgentCard
      width={width}
      height={height}
      scale={SIDEBAR_PREVIEW_SCALE ?? 1}
      accent={AGENT_PRIMITIVE_COLORS.state.accent}
      Icon={AGENT_PRIMITIVE_COLORS.state.Icon}
      typeLabel="state"
      name={data?.name ?? "AgentState"}
    >
      {bodies.length || fallbackBodies.length ? (
        <>
          {bodies.map((b) => {
            const RIcon = replyTypeIcon(b.replyType)
            return (
              <AgentPill
                key={b.id}
                accent={AGENT_PRIMITIVE_COLORS.state.accent}
                icon={<RIcon size={12} />}
                label={b.name ?? ""}
              />
            )
          })}
          {hasFallbackDivider ? <AgentSectionLabel>fallback</AgentSectionLabel> : null}
          {fallbackBodies.map((b) => {
            const RIcon = replyTypeIcon(b.replyType)
            return (
              <AgentPill
                key={b.id}
                accent={AGENT_PRIMITIVE_COLORS.state.accent}
                icon={<RIcon size={12} />}
                label={b.name ?? ""}
                dashed
              />
            )
          })}
        </>
      ) : undefined}
    </ScaledAgentCard>
  )
}

type PrimitiveSVGProps = SVGComponentProps & {
  data?: {
    name?: string
    description?: string
    path?: string
    llm_name?: string
    max_steps?: number
  }
}

const Subtitle: React.FC<{ text: string; mono?: boolean }> = ({ text, mono }) =>
  text ? (
    <div
      title={text}
      style={{
        fontSize: 12,
        fontFamily: mono ? "monospace" : undefined,
        color: "var(--besser-gray-variant, #64748b)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  ) : null

export const AgentReasoningStateSVG: React.FC<PrimitiveSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  data,
}) => {
  const accent = AGENT_PRIMITIVE_COLORS.reasoning.accent
  return (
    <ScaledAgentCard
      width={width}
      height={height}
      scale={SIDEBAR_PREVIEW_SCALE ?? 1}
      accent={accent}
      Icon={AGENT_PRIMITIVE_COLORS.reasoning.Icon}
      typeLabel="reasoning"
      name={data?.name ?? "ReasoningState"}
      headerRight={
        <AgentBadge accent={accent}>
          <Bot size={11} />
          {data?.llm_name ? data.llm_name : "default"}
        </AgentBadge>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <AgentPill accent={accent} icon={<RotateCw size={12} />} label={`≤ ${data?.max_steps ?? 8} steps`} />
        <AgentPill accent={accent} icon={<Map size={12} />} label="planning" />
      </div>
    </ScaledAgentCard>
  )
}

export const AgentIntentSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
}) => (
  <ScaledAgentCard
    width={width}
    height={height}
    scale={SIDEBAR_PREVIEW_SCALE ?? 1}
    accent={AGENT_PRIMITIVE_COLORS.intent.accent}
    Icon={AGENT_PRIMITIVE_COLORS.intent.Icon}
    typeLabel="intent"
    name="Intent"
  />
)

export const AgentRagElementSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
}) => {
  const accent = AGENT_PRIMITIVE_COLORS.rag.accent
  return (
    <ScaledAgentCard
      width={width}
      height={height}
      scale={SIDEBAR_PREVIEW_SCALE ?? 1}
      accent={accent}
      Icon={AGENT_PRIMITIVE_COLORS.rag.Icon}
      typeLabel="rag"
      name="RAG"
      headerRight={<AgentBadge accent={accent}>k = 4</AgentBadge>}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <AgentPill accent={accent} icon={<Bot size={12} />} label="default" />
      </div>
    </ScaledAgentCard>
  )
}

export const AgentToolSVG: React.FC<PrimitiveSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  data,
}) => (
  <ScaledAgentCard
    width={width}
    height={height}
    scale={SIDEBAR_PREVIEW_SCALE ?? 1}
    accent={AGENT_PRIMITIVE_COLORS.tool.accent}
    Icon={AGENT_PRIMITIVE_COLORS.tool.Icon}
    typeLabel="tool"
    name={data?.name ?? "tool_name"}
  >
    <Subtitle text={truncatePrimitiveSubtitle(data?.description)} />
  </ScaledAgentCard>
)

export const AgentSkillSVG: React.FC<PrimitiveSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  data,
}) => (
  <ScaledAgentCard
    width={width}
    height={height}
    scale={SIDEBAR_PREVIEW_SCALE ?? 1}
    accent={AGENT_PRIMITIVE_COLORS.skill.accent}
    Icon={AGENT_PRIMITIVE_COLORS.skill.Icon}
    typeLabel="skill"
    name={data?.name ?? "skill_name"}
  >
    <Subtitle text={truncatePrimitiveSubtitle(data?.description)} />
  </ScaledAgentCard>
)

export const AgentWorkspaceSVG: React.FC<PrimitiveSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  data,
}) => {
  const accent = AGENT_PRIMITIVE_COLORS.workspace.accent
  return (
    <ScaledAgentCard
      width={width}
      height={height}
      scale={SIDEBAR_PREVIEW_SCALE ?? 1}
      accent={accent}
      Icon={AGENT_PRIMITIVE_COLORS.workspace.Icon}
      typeLabel="workspace"
      name={data?.name ?? "workspace_name"}
      headerRight={<AgentBadge accent={accent}>rw</AgentBadge>}
    >
      <Subtitle text={truncatePrimitiveSubtitle(data?.path || data?.description)} mono />
    </ScaledAgentCard>
  )
}

export const AgentIntentObjectComponentSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={4}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={1.5}
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={12}
        fill="var(--besser-primary-contrast, #000)"
      >
        slot:entity
      </text>
    </svg>
  )
}
