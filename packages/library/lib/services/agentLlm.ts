/**
 * Agent LLM provider catalogue.
 *
 * Single source of truth for the editor and the webapp: the union type
 * below and every runtime whitelist derive from `AGENT_LLM_PROVIDERS`, so
 * adding a provider is a one-line change here rather than an edit to
 * seven hand-maintained lists. The v4 `AgentLLM` node keeps its provider
 * on `data.provider`; the defaults seeded on load live in
 * `utils/versionConverter.ts` (`normalizeAgentReasoningPrimitiveDefaults`).
 *
 * Must stay in sync with `Agent._LLM_PROVIDERS` in the BESSER backend
 * (`besser/BUML/metamodel/state_machine/agent.py`).
 */

/** Canonical LLM provider keys, in dropdown order. */
export const AGENT_LLM_PROVIDERS = [
  "openai",
  "huggingface",
  "huggingface_api",
  "replicate",
  "ollama",
  "mistral",
  "deepseek",
  "google",
  "meta",
  "anthropic",
  "qwen",
  "xai",
  "groq",
  "together",
  "openrouter",
] as const

export type AgentLLMProviderType = (typeof AGENT_LLM_PROVIDERS)[number]

/**
 * Provider spellings written by older builds and still present in saved
 * configs. They are accepted on read so an existing selection is never
 * silently reset to the default; the value on the right is the canonical
 * key they correspond to.
 */
export const LEGACY_AGENT_LLM_PROVIDER_ALIASES = {
  huggingfaceapi: "huggingface_api",
} as const

export type LegacyAgentLLMProviderType =
  keyof typeof LEGACY_AGENT_LLM_PROVIDER_ALIASES

/** Every provider spelling accepted on read: canonical keys plus legacy aliases. */
export const ACCEPTED_AGENT_LLM_PROVIDERS: readonly string[] = [
  ...AGENT_LLM_PROVIDERS,
  ...Object.keys(LEGACY_AGENT_LLM_PROVIDER_ALIASES),
]

/** True when `value` is a provider key this build accepts (canonical or legacy). */
export const isAcceptedAgentLLMProvider = (
  value: unknown
): value is AgentLLMProviderType | LegacyAgentLLMProviderType =>
  typeof value === "string" && ACCEPTED_AGENT_LLM_PROVIDERS.includes(value)

/**
 * Providers whose runtime wrapper does not expose a chat-completion API, so
 * a chat action cannot target them. Everything else in
 * `AGENT_LLM_PROVIDERS` does.
 */
export const NON_CHAT_AGENT_LLM_PROVIDERS: readonly string[] = [
  "huggingface_api",
  "replicate",
]

/**
 * Map any accepted spelling onto its canonical key, falling back to
 * `fallback` for unknown input (including `''`, `undefined` and
 * non-strings). Legacy aliases are accepted on read and normalised here so
 * the rest of the app only ever handles canonical keys.
 */
export const canonicalizeAgentLLMProvider = (
  value: unknown,
  fallback: AgentLLMProviderType = "openai"
): AgentLLMProviderType => {
  if (typeof value !== "string") return fallback
  if ((AGENT_LLM_PROVIDERS as readonly string[]).includes(value)) {
    return value as AgentLLMProviderType
  }
  return (
    (LEGACY_AGENT_LLM_PROVIDER_ALIASES as Record<string, AgentLLMProviderType>)[
      value
    ] ?? fallback
  )
}
