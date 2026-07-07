import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { Bot, Map, RotateCw } from "lucide-react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { AgentStateNodeProps } from "@/types"
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
 *    followed by a dashed "fallback" section for `data.fallbackBodies[]`.
 *  - `'reasoning'`: purple card, brain-icon `«reasoning»` header with the
 *    resolved LLM as a header badge, and the loop config (step budget,
 *    planning) as body pills. Fixed height (no row-driven auto-grow).
 */
const PILL_ROW = 30
const BODY_PAD = 16
const FALLBACK_SECTION = 22

export function AgentState({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<AgentStateNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()
  const setNodes = useDiagramStore((state) => state.setNodes)

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

  const requiredHeight = hasAnyBody
    ? AGENT_CARD_HEADER_HEIGHT +
      BODY_PAD +
      (mainBodies.length + fallbackBodies.length) * PILL_ROW +
      (hasFallbackDivider ? FALLBACK_SECTION : 0)
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
    const llmLabel = data.llm_name ? data.llm_name : "default"
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
            typeLabel="reasoning"
            name={name}
            surface={surface}
            textColor={textColor}
            italic={italic}
            underline={underline}
            initial={data.initial}
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
                label={`≤ ${data.max_steps ?? 8} steps`}
              />
              {data.enable_task_planning !== false ? (
                <AgentPill accent={accent} icon={<Map size={12} />} label="planning" />
              ) : null}
            </div>
          </AgentNodeCard>
        </div>
        <PopoverManager
          anchorEl={wrapperRef.current}
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
      <div ref={wrapperRef}>
        <AgentNodeCard
          width={width}
          height={height}
          accent={accent}
          icon={<TypeIcon size={15} />}
          typeLabel="state"
          name={name}
          surface={surface}
          textColor={textColor}
          italic={italic}
          underline={underline}
          initial={data.initial}
        >
          {hasAnyBody ? (
            <>
              {mainBodies.map((b) => {
                const isCode = b.replyType === "code"
                const label = isCode ? b.code ?? b.name ?? "" : b.name ?? ""
                const RIcon = replyTypeIcon(b.replyType)
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
                <AgentSectionLabel>fallback</AgentSectionLabel>
              ) : null}
              {fallbackBodies.map((b) => {
                const isCode = b.replyType === "code"
                const label = isCode ? b.code ?? b.name ?? "" : b.name ?? ""
                const RIcon = replyTypeIcon(b.replyType)
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
            </>
          ) : undefined}
        </AgentNodeCard>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentState" as const}
      />
    </DefaultNodeWrapper>
  )
}
