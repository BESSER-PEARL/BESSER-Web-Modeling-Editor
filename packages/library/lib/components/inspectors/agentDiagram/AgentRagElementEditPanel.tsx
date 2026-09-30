import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentRagElementNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation } from "@/i18n"

/**
 * Inspector for `AgentRagElement`.
 *
 * The standalone RAG cylinder carries its display name plus an
 * `llm_name` reference: the DB/RAG selection fields (`ragDatabaseName`,
 * `dbCustomName`, `dbSelectionType`, `dbQueryMode`, `dbOperation`,
 * `dbSqlQuery`) were moved off this inspector — they belong to the
 * AgentState `db_reply` reply mode (see `AgentStateEditPanel.tsx`).
 *
 * The LLM picker mirrors develop's
 * `agent-rag-element-update.tsx`: "Name of RAG DB" text field plus an
 * "LLM" dropdown offering "(use default)" and the names of registered
 * `AgentLLM` definition nodes.
 */
const OLLAMA_DEFAULT_URL = "http://localhost:11434"

export const AgentRagElementEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentRagElementNodeProps

  // Names of registered AgentLLM definitions. Keep a non-registry
  // current value selectable so opening the inspector never silently
  // drops a loaded `llm_name`.
  const llmNames = Array.from(
    new Set(
      nodes
        .filter((n) => (n.type as string) === "AgentLLM")
        .map((n) => ((n.data as { name?: string }).name ?? "").trim())
        .filter((name) => name.length > 0)
    )
  )
  const currentLlm = data.llm_name ?? ""
  if (currentLlm && !llmNames.includes(currentLlm)) {
    llmNames.push(currentLlm)
  }

  const update = (patch: Partial<AgentRagElementNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentRagElementNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label={t("popup.agent.rag.name", "Name of RAG DB")}
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Typography variant="caption">{t("packages.AgentDiagram.llm", "LLM")}</Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={currentLlm}
        onChange={(e) => update({ llm_name: String(e.target.value) })}
      >
        <MenuItem value="">
          {t("packages.AgentDiagram.selectPlaceholder", "(use default)")}
        </MenuItem>
        {llmNames.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </Select>

      {/* Develop `agent-rag-element-update.tsx` L71-94: LLM prompt prefix,
          K (retrieved chunks, clamped >= 1), num previous messages
          (clamped >= 0). */}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label={t("packages.AgentDiagram.llmPromptPrefix", "LLM Prompt Prefix")}
        value={data.llm_prompt ?? ""}
        onChange={(e) => update({ llm_prompt: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label={t("packages.AgentDiagram.retrievedChunks", "K (retrieved chunks)")}
        value={data.k ?? 4}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({ k: Math.max(1, Number.isNaN(parsed) ? 4 : parsed) })
        }}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label={t("packages.AgentDiagram.numPreviousMessages", "Num Previous Messages")}
        value={data.num_previous_messages ?? 0}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({
            num_previous_messages: Math.max(
              0,
              Number.isNaN(parsed) ? 0 : parsed
            ),
          })
        }}
      />

      {/* smart-gen 70b3852d / 42bbd00c: embedding backend + hybrid RAG. */}
      <Typography variant="caption">
        {t("packages.AgentDiagram.embeddingProvider", "Embedding Provider")}
      </Typography>
      <Select
        size="small"
        fullWidth
        value={data.embedding_provider ?? "openai"}
        onChange={(e) => {
          const provider = e.target.value === "ollama" ? "ollama" : "openai"
          update({
            embedding_provider: provider,
            ...(provider === "ollama" && !data.embedding_base_url
              ? { embedding_base_url: OLLAMA_DEFAULT_URL }
              : {}),
          })
        }}
      >
        <MenuItem value="openai">{t("packages.AgentDiagram.openai", "OpenAI")}</MenuItem>
        <MenuItem value="ollama">
          {t("packages.AgentDiagram.ollamaLocal", "Ollama (local)")}
        </MenuItem>
      </Select>
      {data.embedding_provider === "ollama" && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label={t("packages.AgentDiagram.embeddingBaseUrl", "Embedding Base URL")}
          placeholder={t(
            "packages.AgentDiagram.embeddingBaseUrlPlaceholder",
            OLLAMA_DEFAULT_URL
          )}
          value={data.embedding_base_url ?? ""}
          onChange={(e) => update({ embedding_base_url: e.target.value })}
        />
      )}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label={t("packages.AgentDiagram.embeddingModel", "Embedding Model")}
        value={data.embedding_model ?? ""}
        onChange={(e) => update({ embedding_model: e.target.value })}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={!!data.use_hybrid_rag}
            onChange={(e) => update({ use_hybrid_rag: e.target.checked })}
          />
        }
        label={t("packages.AgentDiagram.hybridRag", "Hybrid RAG (BM25)")}
      />
      {data.use_hybrid_rag && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          type="number"
          inputProps={{ step: 0.1, min: 0.05, max: 0.95 }}
          label={t("packages.AgentDiagram.bm25Weight", "BM25 weight")}
          value={data.bm25_weight ?? 0.6}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value)
            update({
              bm25_weight:
                Number.isNaN(parsed) || parsed <= 0 || parsed >= 1 ? 0.6 : parsed,
            })
          }}
        />
      )}
    </Box>
  )
}
