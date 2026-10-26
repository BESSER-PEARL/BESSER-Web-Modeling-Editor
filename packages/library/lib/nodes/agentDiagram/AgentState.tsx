import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { useEffect, useState } from "react"
import { Bot, Map, RotateCw } from "lucide-react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { AgentStateNodeProps } from "@/types"
import { useTranslation } from "@/i18n"
import { resolveReplyType } from "@/utils/agentActions"
import { parseA2AOutTags } from "@/utils/a2aNotation"
import { A2AChip, A2ADetails } from "./A2ABadge"
import {
  AGENT_PRIMITIVE_COLORS,
  replyTypeIcon,
} from "./agentPrimitiveColors"
import {
  AGENT_CARD_HEADER_HEIGHT,
  AgentBadge,
  AgentNodeCard,
  AgentPill,
  AgentSectionLabel,
} from "./AgentNodeCard"

/**
 * `AgentState` — the core agent-flow node, styled as an AI-workflow card
 * (see `AgentNodeCard`) rather than the flat UML box it used to share with
 * the Class diagram.
 *
 *  - `'standard'`: indigo card, message-icon `«state»` header, and one
 *    **reply pill** per `data.bodies[]` row (icon keyed on `replyType`),
 *    followed by a dashed "fallback" section for `data.fallbackBodies[]`,
 *    and an outbound A2A chip when `data.description` has `a2a:out` lines.
 *  - `'reasoning'`: purple card, brain-icon `«reasoning»` header with the
 *    resolved LLM as a header badge, and the loop config (step budget,
 *    planning) as body pills. Fixed height (no row-driven auto-grow).
 */
const PILL_ROW = 30
const BODY_PAD = 16
const FALLBACK_SECTION = 22
const A2A_ROW = 25

export function AgentState({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<AgentStateNodeProps>>) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()
  const setNodes = useDiagramStore((state) => state.setNodes)
  const { t } = useTranslation()
  const [a2aOpen, setA2aOpen] = useState(false)

  const { name, italic, underline } = data
  const isReasoning = data.stateType === "reasoning"
  const accent =
    data.strokeColor ||
    (isReasoning
      ? AGENT_PRIMITIVE_COLORS.reasoning.accent
      : AGENT_PRIMITIVE_COLORS.state.accent)
  const TypeIcon = isReasoning
    ? AGENT_PRIMITIVE_COLORS.reasoning.Icon
    : AGENT_PRIMITIVE_COLORS.state.Icon
  const surface = data.fillColor || undefined
  const textColor = data.textColor || undefined

  const mainBodies = data.bodies ?? []
  const fallbackBodies = data.fallbackBodies ?? []
  const hasAnyBody = mainBodies.length > 0 || fallbackBodies.length > 0
  const hasFallbackDivider = fallbackBodies.length > 0 && mainBodies.length > 0
  // Develop draws A2A on standard states only.
  const a2aOutTags = isReasoning ? [] : parseA2AOutTags(data.description)
  const hasA2A = a2aOutTags.length > 0

  const requiredHeight = hasAnyBody
    ? AGENT_CARD_HEADER_HEIGHT +
      BODY_PAD +
      (mainBodies.length + fallbackBodies.length) * PILL_ROW +
      (hasFallbackDivider ? FALLBACK_SECTION : 0) +
      (hasA2A ? A2A_ROW : 0)
    : hasA2A
      ? AGENT_CARD_HEADER_HEIGHT + BODY_PAD + A2A_ROW
      : AGENT_CARD_HEADER_HEIGHT + 10

  useEffect(() => {
    if (isReasoning) return
    if (!width || !height) return
    if (height < requiredHeight) {
      setNodes((all) =>
        all.map((n) =>
          n.id === id
            ? {
                ...n,
                height: requiredHeight,
                measured: {
                  width: n.measured?.width ?? width,
                  height: requiredHeight,
                },
                style: { ...(n.style ?? {}), height: requiredHeight },
              }
            : n
        )
      )
    }
  }, [requiredHeight, height, id, setNodes, width, isReasoning])

  if (!width || !height) return null

  // ── Reasoning card ─────────────────────────────────────────────────────
  if (isReasoning) {
    const llmLabel = data.llm_name
      ? data.llm_name
      : t("packages.AgentDiagram.card.defaultLlm", "default")
    return (
      <DefaultNodeWrapper width={width} height={height} elementId={id}>
        <NodeToolbar elementId={id} />
        <NodeResizer
          isVisible={isDiagramModifiable}
          onResize={onResize}
          minWidth={160}
          minHeight={80}
          handleStyle={{ width: 8, height: 8 }}
        />
        <div ref={wrapperRef}>
          <AgentNodeCard
            width={width}
            height={height}
            accent={accent}
            icon={<TypeIcon size={15} />}
            typeLabel={t("packages.AgentDiagram.card.reasoning", "reasoning")}
            name={name}
            surface={surface}
            textColor={textColor}
            italic={italic}
            underline={underline}
            headerRight={
              <AgentBadge accent={accent}>
                <Bot size={11} />
                {llmLabel}
              </AgentBadge>
            }
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              <AgentPill
                accent={accent}
                icon={<RotateCw size={12} />}
                label={t("packages.AgentDiagram.card.maxSteps", "≤ {{count}} steps", {
                  count: data.max_steps ?? 8,
                })}
              />
              {data.enable_task_planning !== false ? (
                <AgentPill
                  accent={accent}
                  icon={<Map size={12} />}
                  label={t("packages.AgentDiagram.card.planning", "planning")}
                />
              ) : null}
            </div>
          </AgentNodeCard>
        </div>
        <PopoverManager
          anchorEl={wrapperEl}
          elementId={id}
          type={"AgentState" as const}
        />
      </DefaultNodeWrapper>
    )
  }

  // ── Standard state card ────────────────────────────────────────────────
  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={140}
        minHeight={60}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <AgentNodeCard
          width={width}
          height={height}
          accent={accent}
          icon={<TypeIcon size={15} />}
          typeLabel={t("packages.AgentDiagram.card.state", "state")}
          name={name}
          surface={surface}
          textColor={textColor}
          italic={italic}
          underline={underline}
        >
          {hasAnyBody || hasA2A ? (
            <>
              {mainBodies.map((b) => {
                const replyType = resolveReplyType(b)
                const isCode = replyType === "code"
                const label = isCode ? b.code ?? b.name ?? "" : b.name ?? ""
                const RIcon = replyTypeIcon(replyType)
                return (
                  <AgentPill
                    key={b.id}
                    accent={accent}
                    icon={<RIcon size={12} />}
                    label={label}
                  />
                )
              })}
              {hasFallbackDivider ? (
                <AgentSectionLabel>
                  {t("packages.AgentDiagram.card.fallback", "fallback")}
                </AgentSectionLabel>
              ) : null}
              {fallbackBodies.map((b) => {
                const replyType = resolveReplyType(b)
                const isCode = replyType === "code"
                const label = isCode ? b.code ?? b.name ?? "" : b.name ?? ""
                const RIcon = replyTypeIcon(replyType)
                return (
                  <AgentPill
                    key={b.id}
                    accent={accent}
                    icon={<RIcon size={12} />}
                    label={label}
                    dashed
                  />
                )
              })}
              {hasA2A ? (
                <A2AChip
                  tags={a2aOutTags}
                  open={a2aOpen}
                  onToggle={() => setA2aOpen((v) => !v)}
                />
              ) : null}
            </>
          ) : undefined}
        </AgentNodeCard>
        {hasA2A && a2aOpen ? (
          <div style={{ position: "absolute", left: width + 8, bottom: 0 }}>
            <A2ADetails tags={a2aOutTags} />
          </div>
        ) : null}
      </div>
      <PopoverManager
        anchorEl={wrapperEl}
        elementId={id}
        type={"AgentState" as const}
      />
    </DefaultNodeWrapper>
  )
}
