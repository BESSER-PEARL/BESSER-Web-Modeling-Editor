import { REQUIREMENT_KINDS, type RequirementKind } from '../types/traceability';
import type { NamedElementRef } from './classModelDiff';

/**
 * The requirements the modeling assistant extracted from a request, the LLM that extracted them, and the
 * class-diagram elements that realize each one, as its `inject_complete_system` reply carries them
 * (`requirements`, `requirementsModel`, `realizations`; the agent's `diagram_handlers/core/requirements.py`,
 * described in its `websocket_protocol.rst`).
 *
 * The reply is untrusted input: it is read field by field, and an item that is malformed is left out.
 */

/** A requirement as the assistant states it; `id` (`R1`, `R2`, ...) is unique within its reply. */
export interface StatedRequirement {
  id: string;
  text: string;
  quote: string;
  kind: RequirementKind;
}

export interface RequirementRealization {
  requirement: string;
  elements: NamedElementRef[];
}

/** An LLM as the assistant names it. */
export interface AssistantModel {
  name: string;
  provider: string;
}

export interface AssistantRequirements {
  requirements: StatedRequirement[];
  realizations: RequirementRealization[];
  /** The LLM that extracted the requirements; undefined when the reply does not name one (an older agent). */
  model?: AssistantModel;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

function readRequirement(raw: unknown): StatedRequirement | undefined {
  if (!isRecord(raw)) return undefined;
  const [id, statement, quote] = [text(raw.id), text(raw.text), text(raw.quote)];
  const kind = REQUIREMENT_KINDS.find((k) => k === raw.kind);
  return id && statement && quote && kind ? { id, text: statement, quote, kind } : undefined;
}

function readElement(raw: unknown): NamedElementRef | undefined {
  if (!isRecord(raw)) return undefined;
  const [type, name, owner] = [text(raw.type), text(raw.name), text(raw.owner)];
  if (!type || !name) return undefined;
  return owner ? { type, name, owner } : { type, name };
}

function readModel(raw: unknown): AssistantModel | undefined {
  if (!isRecord(raw)) return undefined;
  const [name, provider] = [text(raw.name), text(raw.provider)];
  return name && provider ? { name, provider } : undefined;
}

/** The requirements a reply carries, or undefined when it carries none that can be used. */
export function readAssistantRequirements(
  reply: { requirements?: unknown; realizations?: unknown; requirementsModel?: unknown },
): AssistantRequirements | undefined {
  if (!Array.isArray(reply.requirements)) return undefined;
  const requirements = reply.requirements.map(readRequirement).filter((r): r is StatedRequirement => r !== undefined);
  const ids = new Set(requirements.map((r) => r.id));
  if (requirements.length === 0 || ids.size !== requirements.length) return undefined;
  const realizations = (Array.isArray(reply.realizations) ? reply.realizations : [])
    .filter(isRecord)
    .filter((raw) => typeof raw.requirement === 'string' && ids.has(raw.requirement))
    .map((raw) => ({
      requirement: raw.requirement as string,
      elements: (Array.isArray(raw.elements) ? raw.elements : [])
        .map(readElement)
        .filter((e): e is NamedElementRef => e !== undefined),
    }))
    .filter((realization) => realization.elements.length > 0);
  const model = readModel(reply.requirementsModel);
  return model ? { requirements, realizations, model } : { requirements, realizations };
}

const normalised = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether `quote` is in `prompt`, ignoring case and whitespace differences: the check the assistant
 *  applies before it sends a requirement, repeated here because its word is not evidence. */
export const quoteIsInPrompt = (quote: string, prompt: string): boolean => normalised(prompt).includes(normalised(quote));

/** The first of `requests` whose text has every quote of `stated`: the request they were extracted from.
 *  The assistant extracts from one request and sends only quotes found in it, so a request stating some
 *  quotes and not others is not it. */
export function requestStating<T extends { text: string }>(stated: AssistantRequirements, requests: T[]): T | undefined {
  return requests.find((request) => stated.requirements.every((r) => quoteIsInPrompt(r.quote, request.text)));
}
