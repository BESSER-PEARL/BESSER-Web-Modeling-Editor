/**
 * The provider allowlists are contracts with other services: a key goes only
 * to a service that takes its provider, so each list must equal its
 * counterpart, not be derived from the app's own provider list.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ASSISTANT_KEY_PROVIDERS, KEY_PROVIDERS } from '../llmKeyStorage';
import { KG_LLM_PROVIDERS } from '../../api/knowledgeGraph';

// modeling-agent `src/llm/byok.py` SUPPORTED_PROVIDERS. Pinned: the agent is
// another repo; update both together.
const AGENT_SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'mistral', 'nebius'];

const sorted = (list: readonly string[]) => [...list].sort();

describe('LLM provider allowlists', () => {
  it("assistant: the agent's SUPPORTED_PROVIDERS plus its catalog gateway 'pia' and 'local' (sent as openai)", () => {
    expect(sorted(ASSISTANT_KEY_PROVIDERS)).toEqual(sorted([...AGENT_SUPPORTED_PROVIDERS, 'pia', 'local']));
  });

  it("knowledge graph: the backend's KGLLMProvider, read from the committed OpenAPI schema", () => {
    const spec = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../openapi/besser-openapi.json'), 'utf-8'),
    );
    for (const schema of ['KGLLMRequest', 'KGOrphanClassifyRequest']) {
      const wire: string[] = spec.components.schemas[schema].properties.provider.enum;
      expect(sorted(KG_LLM_PROVIDERS)).toEqual(sorted(wire));
    }
  });

  it('every allowlisted provider is a key provider', () => {
    for (const p of [...ASSISTANT_KEY_PROVIDERS, ...KG_LLM_PROVIDERS]) expect(KEY_PROVIDERS).toContain(p);
  });
});
