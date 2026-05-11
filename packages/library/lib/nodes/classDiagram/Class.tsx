import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { ClassSVG } from "@/components"
import { useEffect, useMemo, useRef } from "react"
import { ClassNodeElement, ClassNodeProps } from "@/types"
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
import { formatDisplayName } from "@/utils/classifierMemberDisplay"
import { useClassNotation } from "@/store/settingsStore"

/**
 * Format a row for display. When the row carries structured BESSER fields
 * (`attributeType`, `visibility`, …) we re-render the canonical UML / ER
 * string so the editor responds to notation toggles without round-tripping
 * to the inspector. Stock diagrams that only set `{id, name}` get the raw
 * `name` back unchanged.
 *
 * When the parent class' `stereotype` is
 * `'Enumeration'`, the row is an enumeration literal — `formatDisplayName`
 * drops visibility / type / flag markers and returns just the bare name.
 * We force-format Enumeration rows even when the row has no structured
 * fields, because legacy fixtures may store visibility / type in the
 * `name` itself ("+ FOO: int") and the Enumeration display must scrub it.
 */
const formatRow = (
  row: ClassNodeElement,
  mode: "UML" | "ER",
  stereotype?: string | null
): ClassNodeElement => {
  const hasStructuredFields =
    row.attributeType !== undefined ||
    row.visibility !== undefined ||
    row.isOptional !== undefined ||
    row.isDerived !== undefined ||
    row.isId !== undefined ||
    row.isExternalId !== undefined ||
    row.defaultValue !== undefined
  const isEnumeration = stereotype === "Enumeration"
  if (!hasStructuredFields && !isEnumeration) return row
  const formatted = formatDisplayName(
    {
      name: row.name,
      attributeType: row.attributeType,
      visibility: row.visibility,
      isOptional: row.isOptional,
      isDerived: row.isDerived,
      isId: row.isId,
      isExternalId: row.isExternalId,
      defaultValue: row.defaultValue,
    },
    mode,
    stereotype ?? undefined
  )
  return { ...row, name: formatted }
}

export function Class({
  id,
  width,
  height,
  data,
}: NodeProps<Node<ClassNodeProps>>) {
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({
      setNodes: state.setNodes,
    }))
  )
  const classNotation = useClassNotation()
  const { name, stereotype, attributes, methods } = data
  // Replaces the v3 `editorRevision++` hack: the Zustand subscription on
  // `classNotation` re-renders this node whenever ER↔UML flips, with no
  // editor remount and no undo-history loss.
  const displayAttributes = useMemo(
    () => attributes.map((a) => formatRow(a, classNotation, stereotype)),
    [attributes, classNotation, stereotype]
  )
  const displayMethods = useMemo(
    () => methods.map((m) => formatRow(m, classNotation, stereotype)),
    [methods, classNotation, stereotype]
  )

  const isDiagramModifiable = useDiagramModifiable()

  const classSvgWrapperRef = useRef<HTMLDivElement | null>(null)

  const showStereotype = !!stereotype
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT

  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING
  const font = LAYOUT.DEFAULT_FONT

  // Calculate the widest text accurately. Width must consider the
  // *display* name (post-format) so ER/UML toggles re-fit the node.
  const maxTextWidth = useMemo(() => {
    const headerTextWidths = [
      stereotype ? measureTextWidth(`«${stereotype}»`, font) : 0,
      measureTextWidth(name, font),
    ]
    const attributesTextWidths = displayAttributes.map((attr) =>
      measureTextWidth(attr.name, font)
    )
    const methodsTextWidths = displayMethods.map((method) =>
      measureTextWidth(method.name, font)
    )
    const allTextWidths = [
      ...headerTextWidths,
      ...attributesTextWidths,
      ...methodsTextWidths,
    ]

    const result = Math.max(...allTextWidths, 0)
    return result
  }, [stereotype, name, displayAttributes, displayMethods, font])

  const minWidth = useMemo(() => {
    const result = calculateMinWidth(maxTextWidth, padding)
    return result
  }, [maxTextWidth, padding])

  // Calculate minimum dimensions. Enumeration
  // hides the methods compartment entirely; height drops the methods
  // contribution to match. ER mode also hides methods for entity-capable
  // classifiers (Class / Abstract) — must drop the height contribution
  // too so the node doesn't reserve empty space below the attributes.
  const isEnumerationVariant = stereotype === "Enumeration"
  const isERHidesMethodsVariant =
    classNotation === "ER" &&
    stereotype !== "Interface" &&
    stereotype !== "Enumeration"
  const effectiveMethodCount =
    isEnumerationVariant || isERHidesMethodsVariant ? 0 : methods.length
  const minHeight = useMemo(
    () =>
      calculateMinHeight(
        headerHeight,
        attributes.length,
        effectiveMethodCount,
        attributeHeight,
        methodHeight
      ),
    [
      headerHeight,
      attributes.length,
      effectiveMethodCount,
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
      <div ref={classSvgWrapperRef}>
        {/* Pass the *raw* attribute/method rows (not the pre-formatted
            display copies). ClassSVG reads the live `classNotation` from
            the settings store and runs `formatDisplayName` once on the
            raw rows — feeding it already-formatted names produces double
            visibility prefixes and double `?` markers because the strip
            logic doesn't reverse the inline `optional`/`derived` flags.
            `displayAttributes`/`displayMethods` above are kept for the
            width calculation (a single canonical-form measure is what
            we want there). */}
        <ClassSVG
          width={finalWidth}
          height={minHeight}
          data={data}
          id={id}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>

      <PopoverManager
        anchorEl={classSvgWrapperRef.current}
        elementId={id}
        type={"class" as const}
      />
    </DefaultNodeWrapper>
  )
}
