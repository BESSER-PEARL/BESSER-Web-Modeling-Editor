import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import {
  AgentIntentEntitySlot,
  AgentIntentNodeProps,
  AgentIntentTrainingPhrase,
} from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `AgentIntent` renders description / training
 * phrases / entity slots as inline SVG rows on the parent rectangle —
 * mirroring how `AgentState` renders `data.bodies[]` and how `Class`
 * renders `data.attributes[]`. The previous version split each
 * row into a separate React-Flow child node anchored via `parentId`;
 * the user requested folding these onto the parent so the editor
 * surfaces a single, inspectable intent shape.
 *
 * Layout:
 *   - Header (stereotype optional + "Intent: <name>").
 *   - Header divider (drawn when any row exists: description, phrase, slot).
 *   - Description row (italic, single line) — when `intent_description`
 *     is set.
 *   - Training-phrase rows.
 *   - Dashed divider before entity slots when both phrases and slots
 *     exist.
 *   - Entity-slot rows ("name: entity (slot=value)").
 *
 * Auto-grows node height to fit all rows via the `requiredHeight` /
 * `setNodes` effect, same as `AgentState.tsx`.
 */
const ROW_HEIGHT = 30

const renderDescriptionRow = (
  description: string,
  yOffset: number,
  width: number,
  textColor: string
): React.ReactNode => (
  <foreignObject
    key="__description"
    x={0}
    y={yOffset}
    width={width}
    height={ROW_HEIGHT}
  >
    <div
      style={{
        fontSize: LAYOUT.NAME_FONT_SIZE - 2,
        color: textColor,
        padding: "0 10px",
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontStyle: "italic",
      }}
      title={description}
    >
      {description}
    </div>
  </foreignObject>
)

const renderPhraseRow = (
  phrase: AgentIntentTrainingPhrase,
  index: number,
  yOffset: number,
  width: number,
  textColor: string
): React.ReactNode => {
  const y = yOffset + index * ROW_HEIGHT
  const label = phrase.name ?? ""
  return (
    <foreignObject
      key={phrase.id}
      x={0}
      y={y}
      width={width}
      height={ROW_HEIGHT}
    >
      <div
        style={{
          fontSize: LAYOUT.NAME_FONT_SIZE - 2,
          color: textColor,
          padding: "0 10px",
          height: ROW_HEIGHT,
          lineHeight: `${ROW_HEIGHT}px`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={label}
      >
        {label}
      </div>
    </foreignObject>
  )
}

const renderSlotRow = (
  slot: AgentIntentEntitySlot,
  index: number,
  yOffset: number,
  width: number,
  textColor: string
): React.ReactNode => {
  const y = yOffset + index * ROW_HEIGHT
  // Compose "name: entity (slot=value)" — gracefully omit pieces that
  // are missing. Matches v3's `AgentIntentObjectComponent` row label
  // shape closely enough to remain user-recognisable.
  const head = slot.name || slot.slot || ""
  const entityPart = slot.entity ? `: ${slot.entity}` : ""
  const slotPart = slot.slot && slot.name !== slot.slot ? ` (${slot.slot})` : ""
  const valuePart = slot.value ? ` = ${slot.value}` : ""
  const label = `${head}${entityPart}${slotPart}${valuePart}`
  return (
    <foreignObject
      key={slot.id}
      x={0}
      y={y}
      width={width}
      height={ROW_HEIGHT}
    >
      <div
        style={{
          fontSize: LAYOUT.NAME_FONT_SIZE - 2,
          color: textColor,
          padding: "0 10px",
          height: ROW_HEIGHT,
          lineHeight: `${ROW_HEIGHT}px`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={label}
      >
        {label}
      </div>
    </foreignObject>
  )
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

  // Hooks must run unconditionally — compute layout values up front
  // so the auto-grow effect always sees a stable `requiredHeight`.
  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, stereotype, italic, underline } = data
  const showStereotype = !!stereotype
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const intentFill = !data.fillColor ? "#E3F9E5" : fillColor

  const description =
    data.intent_description && data.intent_description.trim().length > 0
      ? data.intent_description
      : ""
  const hasDescription = description.length > 0
  const phrases = data.training_phrases ?? []
  const slots = data.entity_slots ?? []
  const totalRows =
    (hasDescription ? 1 : 0) + phrases.length + slots.length
  const slotDividerHeight = phrases.length > 0 && slots.length > 0 ? 8 : 0
  const requiredHeight =
    headerHeight + totalRows * ROW_HEIGHT + slotDividerHeight + 16

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

  // Y offsets for the row sections.
  const descriptionY = headerHeight
  const phrasesYOffset = headerHeight + (hasDescription ? ROW_HEIGHT : 0)
  const slotsYOffset =
    phrasesYOffset + phrases.length * ROW_HEIGHT + slotDividerHeight
  const slotDividerY = phrasesYOffset + phrases.length * ROW_HEIGHT + 4

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={60}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height + 30}
          viewBox={`0 0 ${width} ${height + 30}`}
          overflow="visible"
        >
          {/* Folded-corner intent rectangle path. Mirrors v3 ThemedPath. */}
          <path
            d={`M 0 0 H ${width} V ${height} H 30 L 0 ${height + 30} L 10 ${height} H 10 0 Z`}
            fill={intentFill}
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          {showStereotype ? (
            <>
              <text
                x={width / 2}
                y={18}
                textAnchor="middle"
                fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
                fill={textColor}
              >
                {`«${stereotype}»`}
              </text>
              <text
                x={width / 2}
                y={38}
                textAnchor="middle"
                fontSize={LAYOUT.NAME_FONT_SIZE}
                fontStyle={italic ? "italic" : undefined}
                textDecoration={underline ? "underline" : undefined}
                fontWeight="600"
                fill={textColor}
              >
                {name && name.toLowerCase() !== "intent" ? `Intent: ${name}` : "Intent"}
              </text>
            </>
          ) : (
            <text
              x={width / 2}
              y={26}
              textAnchor="middle"
              fontSize={LAYOUT.NAME_FONT_SIZE}
              fontStyle={italic ? "italic" : undefined}
              textDecoration={underline ? "underline" : undefined}
              fontWeight="600"
              fill={textColor}
            >
              {`Intent: ${name}`}
            </text>
          )}
          {/* Header divider — drawn whenever the intent has at least
              one row (description, phrase, or slot). */}
          {totalRows > 0 && (
            <line
              x1={0}
              x2={width}
              y1={headerHeight}
              y2={headerHeight}
              stroke={strokeColor}
              strokeWidth={1}
            />
          )}
          {hasDescription &&
            renderDescriptionRow(description, descriptionY, width, textColor)}
          {phrases.map((p, i) =>
            renderPhraseRow(p, i, phrasesYOffset, width, textColor)
          )}
          {phrases.length > 0 && slots.length > 0 && (
            <line
              x1={0}
              x2={width}
              y1={slotDividerY}
              y2={slotDividerY}
              stroke={strokeColor}
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.6}
            />
          )}
          {slots.map((s, i) =>
            renderSlotRow(s, i, slotsYOffset, width, textColor)
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntent" as const}
      />
    </DefaultNodeWrapper>
  )
}
