import { DeleteIcon, EditIcon } from "@/components/Icon"
import { ZINDEX } from "@/constants"
import { IPoint } from "@/edges"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { useIsOnlyThisElementSelected } from "@/hooks/useIsOnlyThisElementSelected"
import { useMemo, useRef } from "react"
import { useTranslation } from "@/i18n"
import { placeEdgeToolbar } from "@/utils/edgeUtils"
import type { LayoutRect } from "@/utils/autoLayoutHandles"
import { ToolbarButton } from "../ToolbarButton"

/** Default offset from the midpoint (below-right) before any placement. */
const TOOLBAR_GAP = 16

/** What the toolbar keeps clear of: the edge's route and the node boxes. */
export interface EdgeToolbarSurroundings {
  points: readonly IPoint[]
  rects: readonly LayoutRect[]
}

/**
 * Tiny class-rect glyph for the "Attach association class" toolbar
 * action. Inline SVG (matches the rest of `@/components/Icon`) so we
 * don't need a new icon-pack dependency.
 */
const AssociationClassGlyph: React.FC = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <rect
      x={2.5}
      y={2.5}
      width={11}
      height={11}
      rx={1}
      fill="none"
      stroke="currentColor"
    />
    <line x1={2.5} y1={6.5} x2={13.5} y2={6.5} stroke="currentColor" />
  </svg>
)

interface CustomEdgeToolbarProps {
  edgeId: string
  position: IPoint
  onEditClick: (event: React.MouseEvent<HTMLElement>) => void
  onDeleteClick: (event: React.MouseEvent<HTMLElement>) => void
  anchorRef: React.Ref<SVGForeignObjectElement>
  /**
   * Callers pass `showEdit={false}` while the inspector already shows this
   * edge — the pencil would be duplicate UI.
   */
  showEdit?: boolean
  /**
   * Association-class authoring entry point. When
   * provided (only by `ClassDiagramEdge` on association types without
   * an existing link) a third action renders that arms the
   * click-to-pick `ClassLinkRel` flow.
   */
  onAttachAssociationClass?: () => void
  /** Route and nodes around the selected edge; without them, below-right. */
  surroundings?: EdgeToolbarSurroundings
}

export const CustomEdgeToolbar: React.FC<CustomEdgeToolbarProps> = ({
  edgeId,
  position,
  onEditClick,
  onDeleteClick,
  anchorRef,
  showEdit = true,
  onAttachAssociationClass,
  surroundings,
}) => {
  const { t } = useTranslation()
  const isDiagramModifiable = useDiagramModifiable()
  const selected = useIsOnlyThisElementSelected(edgeId)

  const showToolbar = useMemo(() => {
    return selected && isDiagramModifiable
  }, [selected, isDiagramModifiable])

  // 28px buttons, 2px gaps, 3px padding + 1px border on each side.
  const actionCount =
    1 + (showEdit ? 1 : 0) + (onAttachAssociationClass ? 1 : 0)
  const toolbarWidth = 28 * actionCount + 2 * (actionCount - 1) + 8
  const toolbarHeight = 36

  // Beside the midpoint, off the route and off node boxes (below-right when
  // clear).
  const lastPlacement = useRef<IPoint | null>(null)
  const toolbarPosition = useMemo(() => {
    if (!showToolbar || !surroundings) {
      // Keep the anchor where it was (an open popover stays put).
      return lastPlacement.current ?? { x: position.x + TOOLBAR_GAP, y: position.y + TOOLBAR_GAP }
    }
    const placed = placeEdgeToolbar(position, toolbarWidth, toolbarHeight, surroundings.points, surroundings.rects)
    lastPlacement.current = placed
    return placed
  }, [showToolbar, surroundings, position, toolbarWidth])

  return (
    <foreignObject
      ref={anchorRef}
      width={toolbarWidth}
      height={toolbarHeight}
      x={toolbarPosition.x}
      y={toolbarPosition.y}
      // The foreignObject is ALWAYS present (it anchors the popover) and sits
      // offset from the edge line, so if it captured the pointer it would
      // select the edge -- or swallow a click meant for a node -- from an
      // empty region well away from the visible line (upstream Apollon
      // #801). Keep the box transparent to the pointer; the toolbar buttons
      // re-enable themselves below. Anchoring is geometric, so unaffected.
      // Visible overflow so the toolbar's shadow is not clipped.
      style={{ pointerEvents: "none", overflow: "visible" }}
    >
      {showToolbar && (
        <div
          className="besser-canvas-toolbar besser-edge-toolbar"
          style={{
            // Only the buttons capture, not the box body.
            pointerEvents: "none",
            width: "100%",
            height: "100%",
            transform: "translateZ(0)",
            position: "relative",
            zIndex: ZINDEX.TOOLTIP,
          }}
        >
          {showEdit && (
            <ToolbarButton
              label={t("actions.edit", "Edit")}
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(e)
              }}
            >
              <EditIcon />
            </ToolbarButton>
          )}
          {onAttachAssociationClass && (
            <ToolbarButton
              label={t("toolbar.attachAssociationClass", "Attach association class")}
              onClick={(e) => {
                e.stopPropagation()
                onAttachAssociationClass()
              }}
            >
              <AssociationClassGlyph />
            </ToolbarButton>
          )}
          <ToolbarButton
            label={t("actions.delete", "Delete")}
            danger
            onClick={(e) => {
              e.stopPropagation()
              onDeleteClick(e)
            }}
          >
            <DeleteIcon />
          </ToolbarButton>
        </div>
      )}
    </foreignObject>
  )
}
