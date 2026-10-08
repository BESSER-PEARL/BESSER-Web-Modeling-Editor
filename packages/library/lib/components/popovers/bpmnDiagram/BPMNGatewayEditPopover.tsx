import { useMemo } from "react"
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField as MuiTextField,
  Typography,
} from "@mui/material"
import { useShallow } from "zustand/shallow"
import { PopoverProps } from "../types"
import { BPMNGatewayProps, BPMNGatewayType } from "@/types"
import { BPMNGatewayRole, clampTrustScore } from "@/types/bpmnAgentic"
import type { UMLModel } from "@/typings"
import { DividerLine, TextField } from "@/components/ui"
import { InspectorSectionHeader } from "@/components/inspectors/_shared"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { useTranslation } from "@/i18n"
import { clearIneligibleBpmnDefaults } from "@/utils/bpmnDefaultFlow"
import {
  AGENTIC_ELIGIBLE_GATEWAY_TYPES,
  findDownstreamAgenticConstructs,
  generateGovernanceDsl,
  resolveUpstreamDivergingGateway,
} from "@/services/bpmnCollaborationBlocks"
import { parseTrustScore } from "./BPMNTaskEditPopover"
import { BPMNGovernanceSection } from "./BPMNGovernanceSection"

/**
 * Gateway data with "Agentic" switched on or off. Off drops every agentic key,
 * so a plain gateway's JSON carries none; on fills develop's defaults.
 */
export const withGatewayAgentic = (
  data: BPMNGatewayProps,
  isAgentic: boolean
): BPMNGatewayProps => {
  if (!isAgentic) {
    const rest: BPMNGatewayProps = { ...data }
    delete rest.isAgentic
    delete rest.gatewayRole
    delete rest.trustScore
    delete rest.governanceDsl
    return rest
  }
  return {
    ...data,
    isAgentic: true,
    gatewayRole: data.gatewayRole ?? "diverging",
    trustScore: clampTrustScore(data.trustScore ?? 0),
  }
}

const ROLES: { value: BPMNGatewayRole; key: string; fallback: string }[] = [
  { value: "diverging", key: "BPMNGatewayRoleDiverging", fallback: "Diverging" },
  { value: "merging", key: "BPMNGatewayRoleMerging", fallback: "Merging" },
]

export const BPMNGatewayEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { nodes, edges, setNodes, setEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodes: state.setNodes,
      setEdges: state.setEdges,
    }))
  )
  const agenticEnabled = useMetadataStore((state) => state.agenticEnabled)
  const node = nodes.find((n) => n.id === elementId)
  const data = (node?.data ?? {}) as BPMNGatewayProps
  const gatewayType = data.gatewayType ?? "exclusive"
  const showAgentic =
    agenticEnabled && AGENTIC_ELIGIBLE_GATEWAY_TYPES.has(gatewayType)
  // The collaboration-block walkers read the live graph.
  const model = useMemo(
    () => ({ nodes, edges }) as unknown as UMLModel,
    [nodes, edges]
  )
  const hasUpstreamDiverging = useMemo(
    () =>
      showAgentic &&
      data.isAgentic === true &&
      resolveUpstreamDivergingGateway(elementId, model) !== undefined,
    [showAgentic, data.isAgentic, elementId, model]
  )
  if (!node) return null

  const role = data.gatewayRole ?? "diverging"
  const tb = (key: string, fallback: string) =>
    t(`packages.BPMNDiagram.${key}`, fallback)

  const update = (fn: (data: BPMNGatewayProps) => BPMNGatewayProps) =>
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? { ...n, data: fn(n.data as BPMNGatewayProps) }
          : n
      )
    )
  const setField = (patch: Partial<BPMNGatewayProps>) =>
    update((d) => ({ ...d, ...patch }))

  const handleTypeChange = (value: BPMNGatewayType) => {
    const eligible = AGENTIC_ELIGIBLE_GATEWAY_TYPES.has(value)
    // An agentic diverging gateway keeps its block's merging gateways on the
    // same type (SEAA'25 § 4.3); a non-eligible type drops the agentic fields.
    const mergingIds = new Set(
      eligible && data.isAgentic && role === "diverging"
        ? findDownstreamAgenticConstructs(elementId, model).mergingGatewayIds
        : []
    )
    setNodes((all) =>
      all.map((n) => {
        if (n.id === elementId) {
          const next = { ...(n.data as BPMNGatewayProps), gatewayType: value }
          return { ...n, data: eligible ? next : withGatewayAgentic(next, false) }
        }
        if (mergingIds.has(n.id)) {
          return { ...n, data: { ...n.data, gatewayType: value } }
        }
        return n
      })
    )
    // A Parallel / Event-Based gateway cannot carry a default flow
    // (BPMN 2.0.2 § 8.3.13): clear the flag on its outgoing flows.
    const retyped = { id: elementId, type: node.type, data: { ...data, gatewayType: value } }
    setEdges((all) =>
      clearIneligibleBpmnDefaults([retyped], all, { sourceId: elementId })
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label={t("popup.name", "Name")}
        value={data.name ?? ""}
        onChange={(e) => setField({ name: e.target.value })}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-gateway-type-label">
          {t("popup.bpmn.gatewayType", "Gateway Type")}
        </InputLabel>
        <Select
          labelId="bpmn-gateway-type-label"
          id="bpmn-gateway-type-select"
          value={gatewayType}
          label={t("popup.bpmn.gatewayType", "Gateway Type")}
          onChange={(e) => handleTypeChange(e.target.value as BPMNGatewayType)}
        >
          <MenuItem value="exclusive">
            {tb("BPMNExclusiveGateway", "Exclusive")}
          </MenuItem>
          <MenuItem value="parallel">
            {tb("BPMNParallelGateway", "Parallel")}
          </MenuItem>
          <MenuItem value="inclusive">
            {tb("BPMNInclusiveGateway", "Inclusive")}
          </MenuItem>
          <MenuItem value="event-based">
            {tb("BPMNEventBasedGateway", "Event-based")}
          </MenuItem>
          <MenuItem value="complex">
            {tb("BPMNComplexGateway", "Complex")}
          </MenuItem>
        </Select>
      </FormControl>

      {showAgentic && (
        <>
          <DividerLine width="100%" />
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={data.isAgentic === true}
                onChange={(_, checked) =>
                  update((d) => withGatewayAgentic(d, checked))
                }
              />
            }
            label={tb("BPMNAgentic", "Agentic")}
          />
        </>
      )}

      {showAgentic && data.isAgentic && (
        <>
          <Box>
            <InspectorSectionHeader sx={{ mb: 0.5 }}>
              {t("popup.role", "Role")}
            </InspectorSectionHeader>
            <div className="bp-segmented" role="group" aria-label={t("popup.role", "Role")}>
              {ROLES.map(({ value, key, fallback }) => {
                // Merging needs an agentic diverging gateway upstream.
                const unavailable =
                  value === "merging" && !hasUpstreamDiverging && role !== "merging"
                return (
                  <button
                    key={value}
                    type="button"
                    className="bp-toggle"
                    aria-pressed={role === value}
                    disabled={unavailable}
                    title={
                      unavailable
                        ? t(
                            "popup.bpmn.mergingNeedsDiverging",
                            "Needs an agentic diverging gateway upstream"
                          )
                        : undefined
                    }
                    onClick={() => setField({ gatewayRole: value })}
                  >
                    {tb(key, fallback)}
                  </button>
                )
              })}
            </div>
            {role === "merging" && !hasUpstreamDiverging && (
              <Typography
                data-testid="bpmn-gateway-orphan-hint"
                sx={{ mt: 0.5, fontSize: 12, lineHeight: "16px", color: "var(--bp-danger)" }}
              >
                {t(
                  "popup.bpmn.orphanedMergingGateway",
                  "No agentic diverging gateway upstream: this gateway closes no collaboration block."
                )}
              </Typography>
            )}
          </Box>
          <MuiTextField
            size="small"
            fullWidth
            label={tb("BPMNTrustScore", "Trust score (0-100)")}
            value={String(data.trustScore ?? 0)}
            onChange={(e) => setField({ trustScore: parseTrustScore(e.target.value) })}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          {role === "merging" && (
            <>
              <DividerLine width="100%" />
              <BPMNGovernanceSection
                key={elementId}
                governanceDsl={data.governanceDsl}
                onChange={(governanceDsl) => setField({ governanceDsl })}
                generate={(policyType) =>
                  generateGovernanceDsl(elementId, model, policyType)
                }
              />
            </>
          )}
        </>
      )}
    </Box>
  )
}
