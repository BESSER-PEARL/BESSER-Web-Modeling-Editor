import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { ObjectNameSVG } from "@/components"
import { useEffect, useMemo, useRef } from "react"
import { ClassNodeElement, ObjectNodeAttribute, ObjectNodeProps } from "@/types"
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
import { formatObjectMember } from "@/utils/classifierMemberDisplay"

/**
 * Object-diagram rows render as `attribute = value` (no visibility, no
 * type, no `{id}` markers — PC-4 Gap 3). v3 stripped these via
 * `UMLObjectAttribute.displayName` (`uml-object-attribute.ts:23-25`); we
 * route through `formatObjectMember` so the canvas label is consistent
 * even when the inspector stores `visibility` / `attributeType` on the
 * row.
 */
const formatObjectAttribute = (row: ObjectNodeAttribute): ClassNodeElement => {
  // Preserve any explicit "name = value" the popup writer already shaped.
  if (row.name && row.name.includes(" = ")) return row
  const displayName = formatObjectMember({
    name: row.name,
    value: row.value,
  })
  return { ...row, name: displayName }
}

export function ObjectName({
  id,
  width,
  height,
  data,
}: NodeProps<Node<ObjectNodeProps>>) {
  const { attributes, methods, name, stereotype } = data
  const displayAttributes = useMemo(
    () => attributes.map(formatObjectAttribute),
    [attributes]
  )
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({
      setNodes: state.setNodes,
    }))
  )

  const isDiagramModifiable = useDiagramModifiable()

  const objectSvgWrapperRef = useRef<HTMLDivElement | null>(null)

  // PC-4 Gap 1: ObjectName carries an optional stereotype band; widen
  // the header height to make room for the `«…»` line when set.
  const hasStereotype = !!stereotype
  const headerHeight = hasStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING
  const font = LAYOUT.DEFAULT_FONT

  // Calculate the widest text accurately. PC-4 Gap 1: include the
  // `«stereotype»` line in the width budget when set so a long
  // stereotype label doesn't get clipped.
  const maxTextWidth = useMemo(() => {
    const stereotypeWidth = stereotype
      ? measureTextWidth(`«${stereotype}»`, font)
      : 0
    const headerTextWidth = measureTextWidth(name, font)
    const attributesTextWidths = displayAttributes.map(
      (attr: { name: string }) => measureTextWidth(attr.name, font)
    )
    const methodsTextWidths = methods.map((method: { name: string }) =>
      measureTextWidth(method.name, font)
    )
    const allTextWidths = [
      stereotypeWidth,
      headerTextWidth,
      ...attributesTextWidths,
      ...methodsTextWidths,
    ]

    const result = Math.max(...allTextWidths, 0)
    return result
  }, [stereotype, name, displayAttributes, methods, font])

  const minWidth = useMemo(() => {
    const result = calculateMinWidth(maxTextWidth, padding)
    return result
  }, [maxTextWidth, padding])

  // Calculate minimum dimensions
  const minHeight = useMemo(
    () =>
      calculateMinHeight(
        headerHeight,
        attributes.length,
        methods.length,
        attributeHeight,
        methodHeight
      ),
    [
      headerHeight,
      attributes.length,
      methods.length,
      attributeHeight,
      methodHeight,
    ]
  )

  useEffect(() => {
    if (height && height <= minHeight) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              height: minHeight,
              measured: {
                ...node.measured,
                height: minHeight,
              },
            }
          }
          return node
        })
      )
    }
  }, [minHeight, height, id, setNodes])

  useEffect(() => {
    if (width && width <= minWidth) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              width: Math.max(width ?? 0, minWidth),
              measured: {
                width: Math.max(width ?? 0, minWidth),
              },
            }
          }
          return node
        })
      )
    }
  }, [id, setNodes, minWidth])

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

      <div ref={objectSvgWrapperRef}>
        <ObjectNameSVG
          width={finalWidth}
          height={minHeight}
          data={{ ...data, attributes: displayAttributes }}
          id={id}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>
      <PopoverManager
        anchorEl={objectSvgWrapperRef.current}
        elementId={id}
        type={"objectName" as const}
      />
    </DefaultNodeWrapper>
  )
}
