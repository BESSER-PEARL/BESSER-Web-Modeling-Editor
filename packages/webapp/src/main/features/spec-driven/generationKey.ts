/**
 * What the next Spec-Driven run started from this tab would use: the one rule
 * the run start applies, also read by the key indicator and the assistant
 * context. Never exposes the key itself outside `RunTierChoice`.
 */

import { useEffect, useReducer } from 'react';

import { getDemoToken } from '../../shared/services/demoMode';
import {
  LLM_KEY_CHANGED_EVENT,
  readFreeTierModel,
  readFreeTierSelected,
  readLlmKey,
  type LlmKey,
} from '../../shared/services/llmKeyStorage';
import { getSpecDrivenConfig, peekSpecDrivenConfig } from '../../shared/services/specDrivenConfig';

export type RunTierChoice =
  | { tier: 'sponsored'; demoToken: string }
  | { tier: 'free'; optedIn: boolean }
  | { tier: 'own_key'; key: LlmKey }
  | { tier: 'none' };

/**
 * A demo link, the opted-in free tier, the stored key; else the free tier when
 * the server offers it (the run opts in), else none (the run asks for a key).
 */
export function readRunTier(freeTierOffered: boolean): RunTierChoice {
  const demoToken = getDemoToken();
  if (demoToken) return { tier: 'sponsored', demoToken };
  if (readFreeTierSelected()) return { tier: 'free', optedIn: true };
  const key = readLlmKey();
  if (key) return { tier: 'own_key', key };
  if (freeTierOffered) return { tier: 'free', optedIn: false };
  return { tier: 'none' };
}

/** The `generationKey` field the editor sends to the modeling agent. */
export interface GenerationKey {
  tier: 'own' | 'free' | 'none';
  provider?: string;
  /** The chosen model, or null for the provider's (or free tier's) default. */
  model?: string | null;
}

/** What the next run would use, by the run start's rule. A demo link's server-paid tier counts as free. */
export function readGenerationKey(): GenerationKey {
  const choice = readRunTier(peekSpecDrivenConfig()?.free_tier.available ?? false);
  switch (choice.tier) {
    case 'own_key':
      return { tier: 'own', provider: choice.key.provider, model: choice.key.model ?? null };
    case 'free':
      return { tier: 'free', provider: 'free', model: readFreeTierModel() };
    case 'sponsored':
      return { tier: 'free', provider: 'sponsored', model: null };
    default:
      return { tier: 'none' };
  }
}

/** `readGenerationKey`, kept current as the key, the free-tier choice or the server config change. */
export function useGenerationKey(): GenerationKey {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let active = true;
    const onChange = () => refresh();
    window.addEventListener(LLM_KEY_CHANGED_EVENT, onChange);
    void getSpecDrivenConfig().then(() => {
      if (active) refresh();
    });
    return () => {
      active = false;
      window.removeEventListener(LLM_KEY_CHANGED_EVENT, onChange);
    };
  }, []);
  return readGenerationKey();
}
