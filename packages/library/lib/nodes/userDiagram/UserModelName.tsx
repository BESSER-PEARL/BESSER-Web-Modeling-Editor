import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useMemo, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { UserModelNameSVG } from "@/components/svgs/nodes/userDiagram"
import { useDiagramStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import {
  measureTextWidth,
  calculateMinWidth,
  calculateMinHeight,
} from "@/utils"
import { LAYOUT } from "@/constants"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import {
  ClassNodeElement,
  UserModelAttributeRow,
  UserModelNameNodeProps,
} from "@/types"

/**
 * `UserModelName`. Full v3-parity rewrite.
 *
 * v3 source: `packages/editor/src/main/packages/user-modeling/uml-user-model-name/uml-user-model-name.ts`
 *
 * Visual contract (matches v3 `UMLUserModelName.render` + the way
 * `composeUserModelPreview` emits one card per meta-model class):
 *  - Underlined header showing `name` (the instance name) and the linked
 *    class label `: className` when `className` is set — this matches the
 *    v3 sidebar drag-source `${classInfo.name.charAt(0).toLowerCase() +
 *    classInfo.name.slice(1)}_1` format and the v3 inspector workflow.
 *  - No methods rendered (user-model is constraint-style data only).
 *  - Each attribute row is rendered in `name = value` format. The
 *    formatter prefers `attributeOperator` when present (so `>=`, `<=`
 *    etc. round-trip from the v3 fixture untouched) and falls back to
 *    `=` otherwise. Visibility symbols are NOT shown (per spec).
 */
const formatUserModelAttributeForDisplay = (
  row: UserModelAttributeRow
): ClassNodeElement => {
  // Preserve any explicit operator the inspector already shaped.
  if (row.name && /[<>=]+/.test(row.name)) return row
  const op = row.attributeOperator ?? "="
  if (row.value !== undefined && row.value !== null && row.value !== "") {
    return { ...row, name: `${row.name} ${op} ${row.value}` }
  }
  // No value yet — still surface the operator so the user can read it
  // off the canvas (`age >=`).
  if (row.attributeOperator) {
    return { ...row, name: `${row.name} ${row.attributeOperator}` }
  }
  return row
}

export function UserModelName({
  id,
  width,
  height,
  data,
}: NodeProps<Node<UserModelNameNodeProps>>) {
  const { attributes, name, className } = data
  // Per-node `view` — default to `"icon"` (v3 preferred
  // preview). The class-style attribute table is opt-in via the inspector.
  const view = data.view ?? "icon"
  const displayAttributes = useMemo(
    () => attributes.map(formatUserModelAttributeForDisplay),
    [attributes]
  )
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({
      setNodes: state.setNodes,
    }))
  )

  const isDiagramModifiable = useDiagramModifiable()
  const userSvgWrapperRef = useRef<HTMLDivElement | null>(null)

  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING
  const font = LAYOUT.DEFAULT_FONT

  // Header label is the instance name plus optional `: className` suffix
  // (v3 visual). Use that for sizing.
  const headerLabel = useMemo(() => {
    return className ? `${name} : ${className}` : name
  }, [name, className])

  const maxTextWidth = useMemo(() => {
    const headerTextWidth = measureTextWidth(headerLabel, font)
    const attributesTextWidths = displayAttributes.map(
      (attr: { name: string }) => measureTextWidth(attr.name, font)
    )
    return Math.max(headerTextWidth, ...attributesTextWidths, 0)
  }, [headerLabel, displayAttributes, font])

  const minWidth = useMemo(
    () => calculateMinWidth(maxTextWidth, padding),
    [maxTextWidth, padding]
  )

  const minHeight = useMemo(
    () => {
      // Icon view collapses the row stack to a single
      // glyph slot. Reserve roughly the same footprint v3 reserved
      // (`renderIconView` defaulted to a 50×50 glyph below a 40-px
      // header — see `uml-user-model-name.ts:196-209`).
      if (view === "icon") {
        return headerHeight + 60
      }
      return calculateMinHeight(
        headerHeight,
        attributes.length,
        0,
        attributeHeight,
        methodHeight
      )
    },
    [view, headerHeight, attributes.length, attributeHeight, methodHeight]
  )

  useEffect(() => {
    if (height && height <= minHeight) {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                height: minHeight,
                measured: { ...node.measured, height: minHeight },
              }
            : node
        )
      )
    }
  }, [minHeight, height, id, setNodes])

  useEffect(() => {
    if (width && width <= minWidth) {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                width: Math.max(width ?? 0, minWidth),
                measured: { width: Math.max(width ?? 0, minWidth) },
              }
            : node
        )
      )
    }
  }, [id, setNodes, minWidth, width])

  const finalWidth = Math.max(width ?? 0, minWidth)

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      className="horizontally-not-resizable"
    >
      <NodeToolbar elementId={id} />
      <NodeResizer
        nodeId={id}
        isVisible={isDiagramModifiable}
        minWidth={minWidth}
        minHeight={minHeight}
        maxHeight={minHeight}
        handleStyle={{ width: 8, height: 8 }}
      />

      <div ref={userSvgWrapperRef}>
        <UserModelNameSVG
          width={finalWidth}
          height={minHeight}
          data={{
            name,
            className,
            classId: data.classId,
            icon: data.icon,
            fillColor: data.fillColor,
            strokeColor: data.strokeColor,
            textColor: data.textColor,
            attributes: displayAttributes,
            // Forward the per-node view so the SVG
            // renders the icon glyph by default.
            view,
          }}
          id={id}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>
      <PopoverManager
        anchorEl={userSvgWrapperRef.current}
        elementId={id}
        type={"UserModelName" as const}
      />
    </DefaultNodeWrapper>
  )
}
