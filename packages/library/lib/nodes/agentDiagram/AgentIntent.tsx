import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { MessagesSquare, Tag } from "lucide-react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import {
  AgentIntentEntitySlot,
  AgentIntentNodeProps,
} from "@/types"
import { AGENT_PRIMITIVE_COLORS } from "./agentPrimitiveColors"
import {
  AGENT_CARD_HEADER_HEIGHT,
  AgentNodeCard,
  AgentPill,
  AgentSectionLabel,
} from "./AgentNodeCard"

/**
 * `AgentIntent` — a matched user intent. Rendered as a sky `🎯 «intent»`
 * flow card: the description as a subtitle, then one pill per training
 * phrase (🗣️) and one per entity slot (🏷️), with a section label between
 * them. Auto-grows to fit all rows like `AgentState`.
 */
const PILL_ROW = 30
const DESC_ROW = 24
const SECTION = 18
const BODY_PAD = 16

const slotLabel = (slot: AgentIntentEntitySlot): string => {
  const head = slot.name || slot.slot || ""
  const entityPart = slot.entity ? `: ${slot.entity}` : ""
  const slotPart = slot.slot && slot.name !== slot.slot ? ` (${slot.slot})` : ""
  const valuePart = slot.value ? ` = ${slot.value}` : ""
  return `${head}${entityPart}${slotPart}${valuePart}`
}

export function AgentIntent({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<AgentIntentNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()
  const setNodes = useDiagramStore((state) => state.setNodes)

  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.intent.accent
  const { name, italic, underline } = data

  const description =
    data.intent_description && data.intent_description.trim().length > 0
      ? data.intent_description
      : ""
  const hasDescription = description.length > 0
  const phrases = data.training_phrases ?? []
  const slots = data.entity_slots ?? []
  const hasSlotSection = phrases.length > 0 && slots.length > 0
  const hasBody = hasDescription || phrases.length > 0 || slots.length > 0

  const requiredHeight = hasBody
    ? AGENT_CARD_HEADER_HEIGHT +
      BODY_PAD +
      (hasDescription ? DESC_ROW : 0) +
      (phrases.length + slots.length) * PILL_ROW +
      (hasSlotSection ? SECTION : 0)
    : AGENT_CARD_HEADER_HEIGHT + 10

  useEffect(() => {
    if ((height ?? 0) < requiredHeight) {
      setNodes((all) =>
        all.map((n) =>
          n.id === id
            ? {
                ...n,
                height: requiredHeight,
                measured: {
                  width: n.measured?.width ?? width ?? 0,
                  height: requiredHeight,
                },
                style: { ...(n.style ?? {}), height: requiredHeight },
              }
            : n
        )
      )
    }
  }, [requiredHeight, height, id, setNodes, width])

  if (!width || !height) return null

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
          icon={<AGENT_PRIMITIVE_COLORS.intent.Icon size={15} />}
          typeLabel="intent"
          name={name}
          surface={data.fillColor || undefined}
          textColor={data.textColor || undefined}
          italic={italic}
          underline={underline}
        >
          {hasBody ? (
            <>
              {hasDescription ? (
                <div
                  title={description}
                  style={{
                    fontSize: 12,
                    fontStyle: "italic",
                    color: "var(--besser-gray-variant, #64748b)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {description}
                </div>
              ) : null}
              {phrases.map((p) => (
                <AgentPill
                  key={p.id}
                  accent={accent}
                  icon={<MessagesSquare size={12} />}
                  label={p.name ?? ""}
                />
              ))}
              {hasSlotSection ? (
                <AgentSectionLabel>entities</AgentSectionLabel>
              ) : null}
              {slots.map((s) => (
                <AgentPill
                  key={s.id}
                  accent={accent}
                  icon={<Tag size={12} />}
                  label={slotLabel(s)}
                />
              ))}
            </>
          ) : undefined}
        </AgentNodeCard>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntent" as const}
      />
    </DefaultNodeWrapper>
  )
}
