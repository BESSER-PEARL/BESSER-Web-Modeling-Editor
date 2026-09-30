import { FC, useState } from "react"
import { Box, Button, Divider, Popover, Typography } from "@mui/material"
import { useShallow } from "zustand/shallow"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { dropElementConfigs } from "@/constants"
import { useTranslation } from "@/i18n"
import {
  ASSOCIATED_OBJECT_DIAGRAM_TYPES,
  ASSOCIATED_OBJECT_NODE_TYPES,
  buildAssociatedObject,
  getAssociatedObjectTargets,
} from "@/utils/associatedObject"
import { AddIcon } from "../Icon"

/**
 * (+) node-toolbar action + "Add and connect to new Object" popup for
 * ObjectDiagram / UserDiagram instance nodes. Port of v3 `updatable.tsx`
 * `onAdd` + `association-popup.tsx`; the model logic lives in
 * `utils/associatedObject.ts`. Renders nothing for other diagrams / nodes.
 */
export const AddAssociatedObjectButton: FC<{ elementId: string }> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const diagramType = useMetadataStore((state) => state.diagramType)
  const { nodes, edges, setNodesAndEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodesAndEdges: state.setNodesAndEdges,
    }))
  )
  const sourceNode = nodes.find((n) => n.id === elementId)

  if (
    !sourceNode ||
    !ASSOCIATED_OBJECT_DIAGRAM_TYPES.has(diagramType) ||
    !ASSOCIATED_OBJECT_NODE_TYPES.has(sourceNode.type ?? "")
  ) {
    return null
  }

  const open = Boolean(anchorEl)
  const targets = open ? getAssociatedObjectTargets(sourceNode) : []
  const title = t("associationPopup.title", "Add and connect to new Object")

  const close = () => setAnchorEl(null)

  const handleSelect = (targetClassId: string) => {
    const created = buildAssociatedObject({
      sourceNode,
      targetClassId,
      diagramType,
      paletteEntries: dropElementConfigs[diagramType] ?? [],
    })
    if (created) {
      setNodesAndEdges([...nodes, created.node], [...edges, created.edge])
    }
    close()
  }

  return (
    <>
      <AddIcon
        role="button"
        aria-label={title}
        data-testid={`add-associated-object-${elementId}`}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        // The node toolbar is pointer-transparent (see NodeToolbar);
        // re-enable the icon itself.
        style={{
          cursor: "pointer",
          pointerEvents: "auto",
          width: 16,
          height: 16,
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box
          sx={{
            minWidth: 260,
            maxWidth: 400,
            maxHeight: 400,
            overflowY: "auto",
            padding: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Typography variant="subtitle2" component="div">
            {title}
          </Typography>
          <Divider />
          {targets.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ textAlign: "center", fontStyle: "italic", padding: 2 }}
            >
              {t(
                "associationPopup.noTargets",
                "No other objects available to connect to"
              )}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {targets.map((target) => (
                <Button
                  key={target.id}
                  variant="outlined"
                  size="small"
                  onClick={() => handleSelect(target.id)}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  {target.name}
                </Button>
              ))}
            </Box>
          )}
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={close}>
              {t("associationPopup.cancel", "Cancel")}
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}
