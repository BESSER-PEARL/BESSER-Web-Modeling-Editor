import { BaseEdge } from "@xyflow/react"
import {
  BaseEdgeProps,
  EdgeEndpointMarkers,
  CommonEdgeElements,
} from "../GenericEdge"
import { EdgeEndLabels } from "../labelTypes/EdgeEndLabels"
import { useEdgeConfig } from "@/hooks/useEdgeConfig"
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { useToolbar } from "@/hooks"
import { useMemo, useRef } from "react"
import { EDGES } from "@/constants"
import { FeedbackDropzone } from "@/components/wrapper/FeedbackDropzone"
import { AssessmentSelectableWrapper } from "@/components"
import { getCustomColorsFromDataForEdge } from "@/utils"
import { EdgeInlineMarkers } from "@/components/svgs/edges/InlineMarker"
import { useSettingsStore } from "@/store/settingsStore"
import { useEdgeLinkingStore } from "@/store/edgeLinkingStore"
import {
  ASSOCIATION_CLASS_CAPABLE_TYPES,
  computeAnchorOnNodeBoundary,
  getAbsoluteNodePosition,
  getLinkRelForAssociation,
  isEdgeAnchoredLinkRel,
  resolveLinkRelClassNodeId,
} from "@/utils/associationClassLink"

/**
 * Association kinds that draw an edge-anchored `ClassLinkRel` overlay.
 * Authoring is limited to `ASSOCIATION_CLASS_CAPABLE_TYPES`; rendering
 * additionally tolerates Aggregation so legacy/third-party fixtures
 * with a link on an aggregation stay visible.
 */
const ASSOCIATION_CLASS_RENDER_TYPES: ReadonlySet<string> = new Set([
  ...ASSOCIATION_CLASS_CAPABLE_TYPES,
  "ClassAggregation",
])

/**
 * Stable "no link" selector result — `useShallow` compares values, but
 * sharing one object keeps the no-link case allocation-free.
 */
const NO_LINK_INFO = {
  hasLink: false,
  linkId: null as string | null,
  strokeColor: null as string | null,
  nodeX: 0,
  nodeY: 0,
  nodeW: 0,
  nodeH: 0,
}

export const ClassDiagramEdge = ({
  id,
  type,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
  selected,
}: BaseEdgeProps) => {
  const anchorRef = useRef<SVGSVGElement | null>(null)
  const { handleDelete } = useToolbar({ id })

  const config = useEdgeConfig(
    type as
      | "ClassAggregation"
      | "ClassInheritance"
      | "ClassRealization"
      | "ClassComposition"
      | "ClassBidirectional"
      | "ClassUnidirectional"
      | "ClassDependency"
  )

  const allowMidpointDragging =
    "allowMidpointDragging" in config ? config.allowMidpointDragging : true
  const enableStraightPath =
    "enableStraightPath" in config
      ? (config.enableStraightPath as boolean)
      : true

  const { assessments } = useDiagramStore(
    useShallow((state) => ({
      assessments: state.assessments,
    }))
  )

  const { setNodes, setEdges, setSelectedElementsId } = useDiagramStore(
    useShallow((state) => ({
      setNodes: state.setNodes,
      setEdges: state.setEdges,
      setSelectedElementsId: state.setSelectedElementsId,
    }))
  )

  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )

  // Edge-anchored ClassLinkRel (association class) attached to THIS
  // association. The link edge lives only in the store (App filters it
  // out of React Flow), so this renderer draws it as a computed dashed
  // overlay from the association midpoint to the class-node boundary.
  const linkInfo = useDiagramStore(
    useShallow((state) => {
      if (!ASSOCIATION_CLASS_RENDER_TYPES.has(type as string)) {
        return NO_LINK_INFO
      }
      const link = getLinkRelForAssociation(state.edges, id)
      if (!link) return NO_LINK_INFO
      const nodeIds = new Set(state.nodes.map((n) => n.id))
      if (!isEdgeAnchoredLinkRel(link, nodeIds)) {
        // Node-to-node link that happens to reference this edge id is
        // impossible; an already-rendered RF link still blocks a second
        // attach (one association class per association).
        return { ...NO_LINK_INFO, hasLink: true }
      }
      const classNodeId = resolveLinkRelClassNodeId(link, nodeIds)
      const classNode = classNodeId
        ? state.nodes.find((n) => n.id === classNodeId)
        : undefined
      if (!classNode) return { ...NO_LINK_INFO, hasLink: true }
      const abs = getAbsoluteNodePosition(
        classNode,
        new Map(state.nodes.map((n) => [n.id, n]))
      )
      return {
        hasLink: true,
        linkId: link.id,
        strokeColor:
          (link.data as { strokeColor?: string } | undefined)?.strokeColor ??
          null,
        nodeX: abs.x,
        nodeY: abs.y,
        nodeW: classNode.measured?.width ?? classNode.width ?? 0,
        nodeH: classNode.measured?.height ?? classNode.height ?? 0,
      }
    })
  )

  const linkSelected = useDiagramStore(
    (state) =>
      linkInfo.linkId !== null &&
      state.selectedElementIds.length === 1 &&
      state.selectedElementIds[0] === linkInfo.linkId
  )

  const startLinking = useEdgeLinkingStore((state) => state.startLinking)

  const {
    pathRef,
    edgeData,
    currentPath,
    overlayPath,
    midpoints,
    hasInitialCalculation,
    isReconnectingRef,
    markerEnd,
    markerStart,
    strokeDashArray,
    handlePointerDown,
    handleEndpointPointerDown,
    sourcePoint,
    targetPoint,
    isDiagramModifiable,
  } = useStepPathEdge({
    id,
    type,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    sourceHandleId,
    targetHandleId,
    data,
    allowMidpointDragging,
    enableReconnection: true,
    enableStraightPath,
  })

  const { strokeColor, textColor } = getCustomColorsFromDataForEdge(data)

  // ----- Association-class link overlay (edge-anchored ClassLinkRel) -----

  const linkAnchorRef = useRef<SVGSVGElement | null>(null)

  const linkRender = useMemo(() => {
    if (!linkInfo.linkId) return null
    const mid = edgeData.pathMiddlePosition
    const anchor = computeAnchorOnNodeBoundary(
      { x: linkInfo.nodeX, y: linkInfo.nodeY },
      { width: linkInfo.nodeW, height: linkInfo.nodeH },
      mid
    )
    return {
      path: `M ${mid.x} ${mid.y} L ${anchor.x} ${anchor.y}`,
      middle: { x: (mid.x + anchor.x) / 2, y: (mid.y + anchor.y) / 2 },
    }
  }, [
    linkInfo.linkId,
    linkInfo.nodeX,
    linkInfo.nodeY,
    linkInfo.nodeW,
    linkInfo.nodeH,
    edgeData.pathMiddlePosition,
  ])

  const handleLinkClick = () => {
    const linkId = linkInfo.linkId
    if (!linkId) return
    // Clear React-Flow-side selection flags (the link itself was never
    // handed to React Flow), then select the link — drives the midpoint
    // toolbar + the properties panel / popover.
    setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)))
    setSelectedElementsId([linkId])
    setPopOverElementId(linkId)
  }

  const handleLinkDelete = () => {
    const linkId = linkInfo.linkId
    if (!linkId) return
    // React Flow's deleteElements can't see this edge — delete straight
    // from the store (Yjs-backed via setEdges).
    setEdges((es) => es.filter((e) => e.id !== linkId))
    setSelectedElementsId((ids) => ids.filter((sid) => sid !== linkId))
  }

  // "Attach association class" appears on the midpoint toolbar of
  // attachable association kinds while no link exists yet (one
  // association class per association — the backend warns and uses the
  // first anyway).
  const canAttachAssociationClass =
    isDiagramModifiable &&
    ASSOCIATION_CLASS_CAPABLE_TYPES.has(type as string) &&
    !linkInfo.hasLink

  // Wire `showAssociationNames` to the rendered
  // edge. v3 stored the user-typed association name on `data.name`
  // (matches `ClassEdgeEditPanel`); when the global setting is on we
  // render that name centred on the path. Inheritance / realization edges
  // never have a name and the empty-string guard suppresses the label.
  const showAssociationNames = useSettingsStore(
    (s) => s.showAssociationNames
  )
  const classNotation = useSettingsStore((s) => s.classNotation)
  const associationName =
    typeof (data as { name?: unknown })?.name === "string"
      ? ((data as { name?: string }).name ?? "")
      : ""

  // ER (Chen) mode: for the four "plain" binary associations replace the
  // UML arrow/rhombus end markers with a named diamond drawn at the
  // midpoint of the path. Inheritance, realization, OCL link, dependency,
  // and link relationships keep their UML rendering. Mirrors v3
  // `uml-association-component.tsx` ER_DIAMOND_RELATIONSHIP_TYPES.
  const ER_DIAMOND_TYPES: ReadonlyArray<string> = [
    "ClassBidirectional",
    "ClassUnidirectional",
    "ClassAggregation",
    "ClassComposition",
  ]
  const showsERDiamond =
    classNotation === "ER" && ER_DIAMOND_TYPES.includes(type as string)
  const effectiveMarkerStart = showsERDiamond ? undefined : markerStart
  const effectiveMarkerEnd = showsERDiamond ? undefined : markerEnd
  const markerKey = `${id}-${effectiveMarkerStart ?? "none"}-${
    effectiveMarkerEnd ?? "none"
  }-${showsERDiamond ? "er" : "uml"}`
  const erDiamondFill =
    (data as { strokeColor?: string } | undefined)?.strokeColor &&
    typeof (data as { fillColor?: string } | undefined)?.fillColor === "string"
      ? ((data as { fillColor?: string }).fillColor as string)
      : "var(--besser-background, #ffffff)"

  return (
    <AssessmentSelectableWrapper elementId={id} asElement="g">
      <FeedbackDropzone elementId={id} asElement="path" elementType={type}>
        <g className="edge-container">
          <BaseEdge
            key={markerKey}
            id={id}
            path={currentPath}
            pointerEvents="none"
            style={{
              stroke: strokeColor,
              strokeDasharray: isReconnectingRef.current
                ? "none"
                : strokeDashArray,
              transition: hasInitialCalculation
                ? "opacity 0.1s ease-in"
                : "none",
              opacity: 1,
            }}
          />

          {/* Inline markers for export compatibility (survives ungrouping).
              In ER mode for ER-capable association types, the inline
              markers are suppressed in favour of the midpoint diamond
              rendered below. */}
          {!isReconnectingRef.current && (
            <EdgeInlineMarkers
              pathD={currentPath}
              markerEnd={effectiveMarkerEnd}
              markerStart={effectiveMarkerStart}
              strokeColor={strokeColor}
            />
          )}

          <path
            ref={pathRef}
            className="edge-overlay"
            d={overlayPath}
            fill="none"
            strokeWidth={EDGES.EDGE_HIGHLIGHT_STROKE_WIDTH}
            pointerEvents="stroke"
            style={{
              opacity: isReconnectingRef.current ? 0 : 0.4,
            }}
          />

          <EdgeEndpointMarkers
            sourcePoint={sourcePoint}
            targetPoint={targetPoint}
            isDiagramModifiable={isDiagramModifiable}
            selected={selected}
            diagramType="step"
            pathType="step"
            onSourcePointerDown={(e) => handleEndpointPointerDown(e, "source")}
            onTargetPointerDown={(e) => handleEndpointPointerDown(e, "target")}
          />

          {isDiagramModifiable &&
            !isReconnectingRef.current &&
            allowMidpointDragging &&
            midpoints.map((point, midPointIndex) => (
              <circle
                className="edge-circle"
                pointerEvents="all"
                key={`${id}-midpoint-${midPointIndex}`}
                cx={point.x}
                cy={point.y}
                r={10}
                fill="var(--besser-gray-variant, #adb5bd)"
                stroke="none"
                style={{ cursor: "grab", zIndex: 9999 }}
                onPointerDown={(e) => handlePointerDown(e, midPointIndex)}
              />
            ))}
        </g>

        <EdgeEndLabels
          data={data}
          activePoints={edgeData.activePoints}
          sourceX={sourceX}
          sourceY={sourceY}
          targetX={targetX}
          targetY={targetY}
          sourcePosition={sourcePosition}
          targetPosition={targetPosition}
          textColor={textColor}
        />

        {/* ER (Chen) diamond at the path midpoint, replacing the UML
            arrow/rhombus markers for the four binary association types.
            The diamond carries the association name centred inside (so
            we suppress the separate UML mid-edge name label below to
            avoid duplication). Mirrors v3 `uml-association-component.tsx`
            ER branch. */}
        {showsERDiamond && (
          <g
            transform={`translate(${edgeData.pathMiddlePosition.x} ${edgeData.pathMiddlePosition.y})`}
            pointerEvents="none"
            data-testid="er-relationship-diamond"
          >
            <polygon
              points="-30,0 0,-15 30,0 0,15"
              fill={erDiamondFill}
              stroke={strokeColor}
              strokeWidth={1}
            />
            {associationName && (
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: "11px",
                  fill: textColor,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                {associationName}
              </text>
            )}
          </g>
        )}

        {/* Live association-name label, gated on
            the `showAssociationNames` setting. Mirrors the v3 mid-edge
            label position; centre-anchored above the midpoint. In ER
            mode the name is rendered inside the diamond, so suppress
            this label for ER-capable association types. */}
        {showAssociationNames && associationName && !showsERDiamond && (
          <text
            x={edgeData.pathMiddlePosition.x}
            y={edgeData.pathMiddlePosition.y - 8}
            textAnchor="middle"
            dominantBaseline="auto"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              fill: textColor,
              userSelect: "none",
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            {associationName}
          </text>
        )}

        <CommonEdgeElements
          id={id}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isDiagramModifiable={isDiagramModifiable}
          assessments={assessments}
          anchorRef={anchorRef}
          handleDelete={handleDelete}
          setPopOverElementId={setPopOverElementId}
          type={type}
          onAttachAssociationClass={
            canAttachAssociationClass ? () => startLinking(id) : undefined
          }
        />

        {/* Edge-anchored ClassLinkRel overlay: dashed tether from the
            association midpoint to the association-class node boundary,
            with its own click target, midpoint toolbar and inspector
            routing (the link edge is invisible to React Flow). */}
        {linkRender && linkInfo.linkId && (
          <g data-testid="association-class-link">
            <path
              d={linkRender.path}
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={linkSelected ? 2 : 1.5}
              stroke={
                linkInfo.strokeColor ||
                "var(--besser-primary-contrast, #000)"
              }
              pointerEvents="none"
            />
            <path
              d={linkRender.path}
              fill="none"
              stroke="transparent"
              strokeWidth={EDGES.EDGE_HIGHLIGHT_STROKE_WIDTH}
              pointerEvents="stroke"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation()
                handleLinkClick()
              }}
            />
            <CommonEdgeElements
              id={linkInfo.linkId}
              pathMiddlePosition={linkRender.middle}
              isDiagramModifiable={isDiagramModifiable}
              assessments={assessments}
              anchorRef={linkAnchorRef}
              handleDelete={handleLinkDelete}
              setPopOverElementId={setPopOverElementId}
              type="ClassLinkRel"
            />
          </g>
        )}
      </FeedbackDropzone>
    </AssessmentSelectableWrapper>
  )
}
