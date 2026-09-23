import { describe, it, expect } from 'vitest';
import {
  AGENT_CATEGORY_TOKENS,
  AGENTIC_EDGE_KIND_TOKENS,
  CAPABILITY_TOKENS,
  isAgentStereotype,
  isAgenticEdgeStereotype,
  stereotypeTokens,
} from '../../../../../../editor/src/main/packages/common/agentic/agentic-tokens';

/**
 * Guards the Phase C (C-lite) agentic token contract. The token strings
 * mirror the BESSER metamodel enums in
 * uml_component/agentic.py — these tests fail if the WME side drifts.
 */
describe('Phase C — agentic token vocabulary', () => {
  it('AgentCategory tokens match the metamodel enum values', () => {
    expect([...AGENT_CATEGORY_TOKENS]).toEqual(['solution', 'supervision']);
  });

  it('AgenticEdgeKind has the 8 metamodel tokens', () => {
    expect([...AGENTIC_EDGE_KIND_TOKENS]).toEqual([
      'delegates',
      'supervises',
      'revises',
      'collaborates',
      'has',
      'uses',
      'granted',
      'implements',
    ]);
  });

  it('stereotypeTokens splits on commas and whitespace, lowercased', () => {
    expect(stereotypeTokens('Solution, External')).toEqual(['solution', 'external']);
    expect(stereotypeTokens('  delegates   has ')).toEqual(['delegates', 'has']);
    expect(stereotypeTokens('')).toEqual([]);
    expect(stereotypeTokens(undefined)).toEqual([]);
  });

  it('isAgentStereotype is true only for an AgentCategory token (human removed)', () => {
    expect(isAgentStereotype('solution')).toBe(true);
    expect(isAgentStereotype('supervision, external')).toBe(true);
    expect(isAgentStereotype('human')).toBe(false); // removed agent token
    expect(isAgentStereotype('actor')).toBe(false); // alias of the removed token
    expect(isAgentStereotype('skill, human')).toBe(false); // neither token is an agent
    expect(isAgentStereotype('skill')).toBe(false); // a capability, not an agent
    expect(isAgentStereotype('external')).toBe(false); // locality, not an agent
    expect(isAgentStereotype('')).toBe(false);
  });

  it('isAgenticEdgeStereotype is true only for an AgenticEdgeKind token', () => {
    expect(isAgenticEdgeStereotype('delegates')).toBe(true);
    expect(isAgenticEdgeStereotype('granted {permission: repo:write}')).toBe(true);
    expect(isAgenticEdgeStereotype('HTTPS')).toBe(false);
    expect(isAgenticEdgeStereotype('')).toBe(false);
  });

  it('CAPABILITY_TOKENS includes the LLM/DB/RAG resource tokens (point 5)', () => {
    expect([...CAPABILITY_TOKENS]).toEqual(['skill', 'tool', 'llm', 'db', 'rag']);
  });

  it('llm/db/rag are capabilities, not agents (no bot overlay)', () => {
    expect(isAgentStereotype('llm')).toBe(false);
    expect(isAgentStereotype('db')).toBe(false);
    expect(isAgentStereotype('rag')).toBe(false);
  });
});
