import { describe, expect, it } from "vitest"
import {
  ACCEPTED_AGENT_LLM_PROVIDERS,
  AGENT_LLM_PROVIDERS,
  LEGACY_AGENT_LLM_PROVIDER_ALIASES,
  NON_CHAT_AGENT_LLM_PROVIDERS,
  canonicalizeAgentLLMProvider,
  isAcceptedAgentLLMProvider,
} from "../../lib/services/agentLlm"

const NEW_PROVIDERS = [
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

describe("AGENT_LLM_PROVIDERS", () => {
  it("starts with the original provider families in dropdown order", () => {
    expect(AGENT_LLM_PROVIDERS.slice(0, 5)).toEqual([
      "openai",
      "huggingface",
      "huggingface_api",
      "replicate",
      "ollama",
    ])
  })

  it.each(NEW_PROVIDERS)("contains the new provider family %s", (provider) => {
    expect(AGENT_LLM_PROVIDERS).toContain(provider)
  })

  it("does not list the legacy spelling as a canonical key", () => {
    expect(AGENT_LLM_PROVIDERS as readonly string[]).not.toContain("huggingfaceapi")
  })
})

describe("ACCEPTED_AGENT_LLM_PROVIDERS", () => {
  it("accepts every canonical key plus every legacy alias", () => {
    for (const provider of AGENT_LLM_PROVIDERS) {
      expect(ACCEPTED_AGENT_LLM_PROVIDERS).toContain(provider)
    }
    for (const alias of Object.keys(LEGACY_AGENT_LLM_PROVIDER_ALIASES)) {
      expect(ACCEPTED_AGENT_LLM_PROVIDERS).toContain(alias)
    }
  })
})

describe("isAcceptedAgentLLMProvider", () => {
  it("is true for canonical and legacy spellings", () => {
    expect(isAcceptedAgentLLMProvider("openai")).toBe(true)
    expect(isAcceptedAgentLLMProvider("openrouter")).toBe(true)
    expect(isAcceptedAgentLLMProvider("huggingfaceapi")).toBe(true)
  })

  it("is false for unknown values and non-strings", () => {
    expect(isAcceptedAgentLLMProvider("atlantis-ai")).toBe(false)
    expect(isAcceptedAgentLLMProvider("")).toBe(false)
    expect(isAcceptedAgentLLMProvider(undefined)).toBe(false)
    expect(isAcceptedAgentLLMProvider(null)).toBe(false)
    expect(isAcceptedAgentLLMProvider(42)).toBe(false)
  })
})

describe("canonicalizeAgentLLMProvider", () => {
  it.each(AGENT_LLM_PROVIDERS)("preserves canonical provider %s", (provider) => {
    expect(canonicalizeAgentLLMProvider(provider)).toBe(provider)
  })

  it("maps the legacy huggingfaceapi spelling onto huggingface_api", () => {
    expect(canonicalizeAgentLLMProvider("huggingfaceapi")).toBe("huggingface_api")
  })

  it("falls back to openai for unknown, empty and non-string input", () => {
    expect(canonicalizeAgentLLMProvider("atlantis-ai")).toBe("openai")
    expect(canonicalizeAgentLLMProvider("")).toBe("openai")
    expect(canonicalizeAgentLLMProvider(undefined)).toBe("openai")
    expect(canonicalizeAgentLLMProvider(null)).toBe("openai")
    expect(canonicalizeAgentLLMProvider(7)).toBe("openai")
  })

  it("honours an explicit fallback", () => {
    expect(canonicalizeAgentLLMProvider("nope", "ollama")).toBe("ollama")
    expect(canonicalizeAgentLLMProvider("", "mistral")).toBe("mistral")
  })
})

describe("NON_CHAT_AGENT_LLM_PROVIDERS", () => {
  it("only lists providers without a chat-completion wrapper", () => {
    expect(NON_CHAT_AGENT_LLM_PROVIDERS).toEqual(["huggingface_api", "replicate"])
    for (const provider of NON_CHAT_AGENT_LLM_PROVIDERS) {
      expect(AGENT_LLM_PROVIDERS as readonly string[]).toContain(provider)
    }
  })
})
