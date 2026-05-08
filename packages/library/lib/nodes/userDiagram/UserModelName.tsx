import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useMemo, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { ObjectNameSVG } from "@/components"
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
  ObjectNodeProps,
  UserModelAttributeRow,
  UserModelNameNodeProps,
} from "@/types"

/**
 * SA-4 `UserModelName`. Derived from SA-2's `ObjectName` per the SA-4 brief
 * — the user-modelling diagram is a special case of object diagram with
 * semantic constraints (validated server-side via `usermetamodel.json`).
 *
 * Key shape differences from `ObjectName`:
 *  - Each attribute carries an `attributeOperator` (`< / <= / == / >= / >`)
 *    that signals a constraint-style comparison rather than a simple
 *    value assignment. The display uses that operator instead of `=`.
 *  - Spec open question #1 resolution: `classId` (and cached `className`)
 *    are preserved verbatim for parity with `ObjectName.classId`.
 *  - Reuses `ObjectNameSVG` so the visual stays identical to ObjectDiagram.
 */
const formatUserModelAttribute = (
  row: UserModelAttributeRow
): ClassNodeElement => {
  if (row.value === undefined || row.value === null || row.value === "") {
    return row
  }
  const op = row.attributeOperator ?? "=="
  // Preserve any explicit operator the inspector already shaped.
  if (row.name && /[<>=]+/.test(row.name)) return row
  return { ...row, name: `${row.name} ${op} ${row.value}` }
}

export function UserModelName({
  id,
  width,
  height,
  data,
}: NodeProps<Node<UserModelNameNodeProps>>) {
  const { attributes, name } = data
  const displayAttributes = useMemo(
    () => attributes.map(formatUserModelAttribute),
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

  const maxTextWidth = useMemo(() => {
    const headerTextWidth = measureTextWidth(name, font)
    const attributesTextWidths = displayAttributes.map(
      (attr: { name: string }) => measureTextWidth(attr.name, font)
    )
    return Math.max(headerTextWidth, ...attributesTextWidths, 0)
  }, [name, displayAttributes, font])

  const minWidth = useMemo(
    () => calculateMinWidth(maxTextWidth, padding),
    [maxTextWidth, padding]
  )

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

  // Reuse `ObjectNameSVG` shape — the visual stays identical to
  // ObjectDiagram per the SA-4 brief.
  const renderData: ObjectNodeProps = {
    name,
    fillColor: data.fillColor,
    strokeColor: data.strokeColor,
    textColor: data.textColor,
    methods: [],
    attributes: displayAttributes,
    classId: data.classId,
    className: data.className,
    icon: data.icon,
  }

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
        <ObjectNameSVG
          width={finalWidth}
          height={minHeight}
          data={renderData}
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
