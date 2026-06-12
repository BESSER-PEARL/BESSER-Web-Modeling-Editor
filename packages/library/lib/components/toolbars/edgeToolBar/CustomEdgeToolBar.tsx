import { DeleteIcon, EditIcon } from "@/components/Icon"
import { ZINDEX } from "@/constants"
import { IPoint } from "@/edges"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { useIsOnlyThisElementSelected } from "@/hooks/useIsOnlyThisElementSelected"
import { Box } from "@mui/material"
import { useMemo } from "react"

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
  anchorRef: React.RefObject<SVGForeignObjectElement>
  /**
   * When the right-side properties panel is the
   * active inspector surface, callers pass `showEdit={false}` to hide
   * the pencil — the panel auto-shows on selection so the floating
   * affordance is duplicate UI.
   */
  showEdit?: boolean
  /**
   * Association-class authoring entry point. When
   * provided (only by `ClassDiagramEdge` on association types without
   * an existing link) a third action renders that arms the
   * click-to-pick `ClassLinkRel` flow.
   */
  onAttachAssociationClass?: () => void
}

export const CustomEdgeToolbar: React.FC<CustomEdgeToolbarProps> = ({
  edgeId,
  position,
  onEditClick,
  onDeleteClick,
  anchorRef,
  showEdit = true,
  onAttachAssociationClass,
}) => {
  const isDiagramModifiable = useDiagramModifiable()
  const selected = useIsOnlyThisElementSelected(edgeId)

  const showToolbar = useMemo(() => {
    return selected && isDiagramModifiable
  }, [selected, isDiagramModifiable])

  const toolbarPosition = useMemo(() => {
    return {
      x: position.x - 16,
      y: position.y - 28,
    }
  }, [position.x, position.y, edgeId])

  // 16px icon + 8px gap per action inside 8px padding —
  // 2 actions ⇒ 56 (historic size), 3 actions ⇒ 80.
  const actionCount =
    1 + (showEdit ? 1 : 0) + (onAttachAssociationClass ? 1 : 0)
  const toolbarHeight = 24 * actionCount + 8

  return (
    <foreignObject
      ref={anchorRef}
      width={32}
      height={toolbarHeight}
      x={toolbarPosition.x + 20}
      y={toolbarPosition.y + 20}
    >
      {showToolbar && (
        <Box
          sx={{
            backgroundColor: "var(--besser-background, white)",
            boxShadow: "0 0 4px 0 var(--besser-background-variant, #f8f9fa)",
            borderRadius: "8px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: "8px",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
            position: "relative",
            zIndex: ZINDEX.TOOLTIP,
          }}
        >
          <Box
            sx={{
              width: "16px",
              height: "16px",
              backgroundColor: "var(--besser-background, white)",
              borderRadius: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteClick(e)
            }}
          >
            <DeleteIcon style={{ width: 16, height: 16 }} />
          </Box>
          {showEdit && (
            <Box
              sx={{
                width: "16px",
                height: "16px",
                backgroundColor: "var(--besser-background, white)",
                borderRadius: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(e)
              }}
            >
              <EditIcon style={{ width: 16, height: 16 }} />
            </Box>
          )}
          {onAttachAssociationClass && (
            <Box
              title="Attach association class"
              aria-label="Attach association class"
              sx={{
                width: "16px",
                height: "16px",
                backgroundColor: "var(--besser-background, white)",
                borderRadius: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              onClick={(e) => {
                e.stopPropagation()
                onAttachAssociationClass()
              }}
            >
              <AssociationClassGlyph />
            </Box>
          )}
        </Box>
      )}
    </foreignObject>
  )
}
