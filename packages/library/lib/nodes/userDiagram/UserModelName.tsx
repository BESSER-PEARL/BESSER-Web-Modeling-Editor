import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useMemo, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import {
  UserModelNameSVG,
  resolveUserModelHeaderLabel,
} from "@/components/svgs/nodes/userDiagram"
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
 * v3 source: `v3 source: user-modeling/uml-user-model-name/uml-user-model-name.ts`
 *
 * Visual contract (matches v3 `UMLUserModelName.render` + the way
 * `composeUserModelPreview` emits one card per meta-model class):
 *  - Underlined header showing the resolved linked-class name (via
 *    `resolveUserModelHeaderLabel` — `classId` lookup, then cached
 *    `className`, then the instance `name` as last resort). This mirrors
 *    `uml-object-name-component.tsx`'s `isUserModelElement` branch, NOT
 *    the `name : className` format used for plain ObjectName instances.
 *  - Icon vs. attribute-table body is derived purely from the global
 *    `showIconView` setting (see `UserDiagramSVGs.tsx`) — there is no
 *    per-node override; node height is always driven by the attribute
 *    row count so both views share the same footprint.
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

  // v3 parity: the header shows the resolved linked-class name (falling
  // back to the cached className / instance name) — mirrors
  // `uml-object-name-component.tsx`'s `isUserModelElement` branch. Shared
  // with `UserModelNameSVG` so the width budget below always matches
  // what's actually painted.
  const headerLabel = resolveUserModelHeaderLabel(data)

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

  // v3 parity: height is driven by the attribute-row count regardless of
  // icon/table view — `UserModelNameSVG` decides at paint time which
  // body to draw inside the same footprint (global `showIconView`
  // setting), mirroring how `ObjectName.tsx` sizes `ObjectNameSVG`.
  const minHeight = useMemo(
    () =>
      calculateMinHeight(
        headerHeight,
        attributes.length,
        0,
        attributeHeight,
        methodHeight
      ),
    [headerHeight, attributes.length, attributeHeight, methodHeight]
  )

  useEffect(() => {
    // Icon view is fixed-height (maxHeight === minHeight), so the node
    // height must equal minHeight exactly. Clamp in BOTH directions:
    // a too-tall persisted height (e.g. sized by attribute count at drop
    // time) leaves an invisible selection box below the drawn card, and
    // a too-short one clips it.
    if (height && height !== minHeight) {
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
      height={minHeight}
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
