import { useState } from "react"
import { Box, MenuItem, Stack, TextField, Typography } from "@mui/material"
import CodeMirror from "@uiw/react-codemirror"
import { useTranslation } from "@/i18n"
import {
  InspectorSectionHeader,
  useCodeMirrorTheme,
} from "@/components/inspectors/_shared"
import { GOV_POLICY_TYPES, GovPolicyType } from "@/services/bpmnCollaborationBlocks"

const POLICY_LABEL_KEYS: Record<GovPolicyType, string> = {
  MajorityPolicy: "BPMNGovPolicyMajority",
  AbsoluteMajorityPolicy: "BPMNGovPolicyAbsoluteMajority",
  LeaderDrivenPolicy: "BPMNGovPolicyLeaderDriven",
  ConsensusPolicy: "BPMNGovPolicyConsensus",
}

const POLICY_FALLBACKS: Record<GovPolicyType, string> = {
  MajorityPolicy: "Majority",
  AbsoluteMajorityPolicy: "Absolute majority",
  LeaderDrivenPolicy: "Leader-driven",
  ConsensusPolicy: "Consensus",
}

export interface BPMNGovernanceSectionProps {
  governanceDsl: string | undefined
  onChange: (dsl: string) => void
  /** Builds the starter DSL for the chosen policy from the collaboration block. */
  generate: (policyType: GovPolicyType) => string
}

/**
 * Governance policy of an agentic merging gateway: a policy picker, Generate /
 * Regenerate (an existing DSL is only replaced after an inline confirm) and the
 * hand-editable DSL. The picked policy only seeds generation; it is not stored.
 */
export const BPMNGovernanceSection: React.FC<BPMNGovernanceSectionProps> = ({
  governanceDsl,
  onChange,
  generate,
}) => {
  const { t } = useTranslation()
  const codeTheme = useCodeMirrorTheme()
  const [policyType, setPolicyType] = useState<GovPolicyType>("MajorityPolicy")
  const [confirming, setConfirming] = useState(false)
  const hasDsl = (governanceDsl ?? "").trim().length > 0
  const tb = (key: string, fallback: string) =>
    t(`packages.BPMNDiagram.${key}`, fallback)

  const write = () => {
    onChange(generate(policyType))
    setConfirming(false)
  }

  return (
    <Stack spacing={1} data-testid="bpmn-governance-section">
      <div className="bp-section-head">
        <InspectorSectionHeader>
          {tb("BPMNGovernanceLabel", "Governance policy (DSL)")}
        </InspectorSectionHeader>
        {!confirming && (
          <button
            type="button"
            className="bp-text-btn"
            onClick={() => (hasDsl ? setConfirming(true) : write())}
          >
            {hasDsl
              ? tb("BPMNGovernanceRegenerate", "Regenerate")
              : tb("BPMNGovernanceGenerate", "Generate")}
          </button>
        )}
      </div>

      <TextField
        select
        size="small"
        fullWidth
        label={tb("BPMNGovernancePolicyTypeLabel", "Decision policy")}
        value={policyType}
        onChange={(e) => setPolicyType(e.target.value as GovPolicyType)}
      >
        {GOV_POLICY_TYPES.map((policy) => (
          <MenuItem key={policy} value={policy}>
            {tb(POLICY_LABEL_KEYS[policy], POLICY_FALLBACKS[policy])}
          </MenuItem>
        ))}
      </TextField>

      {confirming && (
        <Box
          sx={{
            p: 1,
            border: "1px solid var(--bp-border)",
            borderRadius: "6px",
            background: "var(--bp-subtle)",
          }}
        >
          <Typography sx={{ fontSize: 12, lineHeight: "16px", color: "var(--bp-fg)" }}>
            {tb(
              "BPMNGovernanceOverwriteConfirm",
              "Replace the current governance DSL with a freshly generated one?"
            )}
          </Typography>
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 1 }}>
            <button type="button" className="bp-text-btn" onClick={() => setConfirming(false)}>
              {tb("BPMNGovernanceCancel", "Cancel")}
            </button>
            <button type="button" className="bp-text-btn" onClick={write}>
              {tb("BPMNGovernanceReplace", "Replace")}
            </button>
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          border: "1px solid var(--bp-border)",
          borderRadius: "6px",
          overflow: "hidden",
          "& .cm-editor": { fontSize: "12px", minHeight: 160 },
          "& .cm-editor.cm-focused": { outline: "none" },
        }}
      >
        <CodeMirror
          value={governanceDsl ?? ""}
          theme={codeTheme}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, tabSize: 4 }}
        />
      </Box>
    </Stack>
  )
}
