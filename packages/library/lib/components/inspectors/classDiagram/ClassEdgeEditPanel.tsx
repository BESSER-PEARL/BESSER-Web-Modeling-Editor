import {
  Box,
  Checkbox,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { useSettingsStore } from "@/store/settingsStore"
import { DividerLine, EdgeStyleEditor, Typography } from "@/components/ui"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { SwapHorizIcon } from "@/components/Icon"
import { erCardinalityToUML } from "@/utils/multiplicity"
import { InspectorSectionHeader } from "../_shared"
import { useTranslation } from "@/i18n"
import {
  AssociationEnd,
  applyAssociationTypeChange,
  applyNavigabilityToggle,
  canToggleNavigability,
  normalizeAssociationType,
  resolveAssociationNavigability,
  supportsNavigability,
} from "@/utils/uml-association-navigability"

/**
 * ClassEdgeEditPanel — single inspector body bound to all nine
 * v4 ClassDiagram edge types.
 *
 * Source-of-truth port: `v3 source: uml-class-association-update.tsx`.
 *
 * Fields:
 *
 *   - `name` text field (hidden for `ClassInheritance` / `ClassRealization`,
 *     mirroring v3 which only showed `name` for non-inheritance edges).
 *   - flip action — swaps source/target/handle pairs in the store.
 *   - association-type Select with the v3 7-entry dropdown (Bi /
 *     Uni / Aggregation / Composition / Inheritance / Realization /
 *     Dependency). v3's source comments out four of these; the new
 *     library exposes all seven plus the OCL link +
 *     LinkRel for completeness when authoring those types.
 *   - per-end multiplicity textfield with v3 placeholder `'1..1'`,
 *     swapping to `'(1,1) or 1..1'` when `classNotation === 'ER'`.
 *   - per-end role textfield.
 *   - per-end "navigable" checkbox for Association / Composition /
 *     Aggregation (v3 smart-generator parity). A type change or a toggle
 *     writes the type and both `sourceNavigable` / `targetNavigable`
 *     flags in ONE store update, so it is a single undo step and the
 *     rules (at least one navigable end; a composition's part end is
 *     always navigable) are never broken in between.
 *   - color editor (`strokeColor`, `textColor`) via `EdgeStyleEditor`,
 *     mirroring the v3 `<StylePane lineColor textColor>`.
 *
 * Registered for:
 *   ClassInheritance, ClassRealization, ClassComposition,
 *   ClassAggregation, ClassUnidirectional, ClassBidirectional,
 *   ClassDependency, ClassOCLLink, ClassLinkRel.
 */

// `ClassOCLLink` and `ClassLinkRel` are no longer manual
// picks — they're auto-detected by `useConnect` based on the endpoint
// node types. The user can't change a regular association into one of
// them, and a constraint-attached link can't accidentally be turned
// into something else. The current edge keeps its type; the dropdown
// just doesn't expose those two options.
// v3 BESSER parity: the editor only exposes the four edge kinds that
// have a BUML metamodel equivalent — bi / uni association, composition,
// and inheritance. Aggregation, Realization, and Dependency are masked
// from the picker (legacy fixtures still render correctly via
// ``edgeUtils.ts``; users just can't author new ones).
// A plain association is always `ClassBidirectional`; one-way navigation
// is expressed with the per-end "navigable" checkboxes, so the legacy
// `ClassUnidirectional` is no longer offered (it is shown as Association).
const EDGE_TYPE_OPTIONS = [
  {
    value: "ClassBidirectional",
    key: "packages.ClassDiagram.ClassBidirectional",
    label: "Association",
  },
  {
    value: "ClassComposition",
    key: "packages.ClassDiagram.ClassComposition",
    label: "Composition",
  },
  {
    value: "ClassInheritance",
    key: "packages.ClassDiagram.ClassInheritance",
    label: "Generalization",
  },
] as const

const NON_DIRECTIONAL_TYPES = new Set([
  "ClassInheritance",
  "ClassRealization",
])

export const ClassEdgeEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setEdges: state.setEdges,
    }))
  )
  const classNotation = useSettingsStore((s) => s.classNotation)
  const { t } = useTranslation()

  const edge = edges.find((e) => e.id === elementId)
  if (!edge) return null

  const data = (edge.data ?? {}) as CustomEdgeProps & {
    name?: string
    sourceMultiplicity?: string | null
    targetMultiplicity?: string | null
    sourceRole?: string | null
    targetRole?: string | null
  }

  const isInheritance = NON_DIRECTIONAL_TYPES.has(edge.type as string)

  // Resolve the source/target node names so the inspector section
  // headers carry the same orientation cue v3 provided.
  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)
  const sourceName =
    (sourceNode?.data as { name?: string } | undefined)?.name ||
    t("common.source", "Source")
  const targetName =
    (targetNode?.data as { name?: string } | undefined)?.name ||
    t("common.target", "Target")

  // Mirror the v3 ER hint: storage is always UML, but ER users get a
  // hint that `(1,N)` syntax is also accepted on input.
  const multiplicityPlaceholder =
    classNotation === "ER"
      ? t("popup.class.erMultiplicityPlaceholder", "(1,1) or 1..1")
      : "1..1"

  const updateData = (patch: Partial<CustomEdgeProps & { name?: string }>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const handleEdgeTypeChange = (newType: string) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? applyAssociationTypeChange(e, newType) : e
      )
    )
  }

  const showsNavigability = supportsNavigability(edge.type)
  const navigability = resolveAssociationNavigability(edge)

  // Disabled checkboxes don't show their tooltip in most browsers, so the
  // explanation lives on the always-hoverable label as well.
  const navigableInfoText = (end: AssociationEnd): string => {
    if (edge.type === "ClassComposition" && end === "source") {
      return t(
        "popup.navigableCompositionHint",
        "The composite can always navigate to its parts"
      )
    }
    if (!canToggleNavigability(edge, end)) {
      return t(
        "popup.navigableDisabledHint",
        "At least one end of an association must be navigable"
      )
    }
    return t("popup.navigableInfo", "At least one end must be navigable")
  }

  const handleToggleNavigable = (end: AssociationEnd, checked: boolean) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? applyNavigabilityToggle(e, end, checked) : e
      )
    )
  }

  const renderNavigableRow = (end: AssociationEnd) => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={navigableInfoText(end)}>
        <Typography variant="caption" sx={{ minWidth: 70, cursor: "help" }}>
          {t("popup.navigable", "Navigable")}
        </Typography>
      </Tooltip>
      <Checkbox
        size="small"
        checked={navigability[end]}
        disabled={!canToggleNavigability(edge, end)}
        onChange={(e) => handleToggleNavigable(end, e.target.checked)}
        inputProps={{
          "aria-label": `${
            end === "source"
              ? t("common.source", "Source")
              : t("common.target", "Target")
          } ${t("popup.navigable", "Navigable")}`,
        }}
        data-testid={`${end}-navigable`}
      />
    </Stack>
  )

  const handleSwap = () => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== elementId) return e
        return {
          ...e,
          source: e.target,
          sourceHandle: e.targetHandle,
          target: e.source,
          targetHandle: e.sourceHandle,
        }
      })
    )
  }

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    updateData({ [key]: value })
  }

  // develop opened its plain `DefaultRelationshipPopup` (colours only) for
  // OCL links and association-class links — no name, type, ends or flip.
  if (edge.type === "ClassOCLLink" || edge.type === "ClassLinkRel") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <EdgeStyleEditor
          edgeData={data}
          handleDataFieldUpdate={handleStyleFieldUpdate}
          label={t("popup.relationship", "Relationship")}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Color editor + flip action — matches v3 layout */}
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label={t("popup.association", "Association")}
        sideElements={[
          <Tooltip
            key="flip"
            title={t("common.flipSourceTarget", "Flip source / target")}
          >
            <IconButton size="small" onClick={handleSwap}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
        ]}
      />

      <DividerLine width="100%" />

      {/* v3 hides the name field for inheritance / realization */}
      {!isInheritance && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label={t("popup.associationNamePlaceholder", "Association name")}
          value={data.name ?? ""}
          onChange={(e) => updateData({ name: e.target.value })}
        />
      )}

      <Select
        size="small"
        value={normalizeAssociationType(edge.type) ?? "ClassBidirectional"}
        onChange={(e) => handleEdgeTypeChange(String(e.target.value))}
      >
        {EDGE_TYPE_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {t(option.key, option.label)}
          </MenuItem>
        ))}
        {/* Legacy kinds (aggregation, realization, dependency) are not
            authorable any more but must still show in the picker when
            an edge already carries one. */}
        {!EDGE_TYPE_OPTIONS.some(
          (o) => o.value === normalizeAssociationType(edge.type)
        ) &&
          edge.type && (
            <MenuItem value={edge.type}>
              {t(`packages.ClassDiagram.${edge.type}`, edge.type)}
            </MenuItem>
          )}
      </Select>

      {!isInheritance && (
        <>
          <DividerLine width="100%" />
          {/* Shared section header; #6: caption col 80 → 70. */}
          <InspectorSectionHeader>
            {t("popup.class.sourceEnd", "Source — {{name}}", {
              name: sourceName,
            })}
          </InspectorSectionHeader>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              {t("popup.multiplicity", "Multiplicity")}
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              autoFocus
              placeholder={multiplicityPlaceholder}
              value={data.sourceMultiplicity ?? ""}
              onChange={(e) =>
                updateData({ sourceMultiplicity: e.target.value })
              }
              onBlur={(e) =>
                updateData({
                  sourceMultiplicity: erCardinalityToUML(e.target.value),
                })
              }
            />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              {t("popup.role", "Role")}
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={data.sourceRole ?? ""}
              onChange={(e) => updateData({ sourceRole: e.target.value })}
            />
          </Stack>
          {showsNavigability && renderNavigableRow("source")}

          <DividerLine width="100%" />
          <InspectorSectionHeader>
            {t("popup.class.targetEnd", "Target — {{name}}", {
              name: targetName,
            })}
          </InspectorSectionHeader>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              {t("popup.multiplicity", "Multiplicity")}
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder={multiplicityPlaceholder}
              value={data.targetMultiplicity ?? ""}
              onChange={(e) =>
                updateData({ targetMultiplicity: e.target.value })
              }
              onBlur={(e) =>
                updateData({
                  targetMultiplicity: erCardinalityToUML(e.target.value),
                })
              }
            />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              {t("popup.role", "Role")}
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={data.targetRole ?? ""}
              onChange={(e) => updateData({ targetRole: e.target.value })}
            />
          </Stack>
          {showsNavigability && renderNavigableRow("target")}
        </>
      )}
    </Box>
  )
}
