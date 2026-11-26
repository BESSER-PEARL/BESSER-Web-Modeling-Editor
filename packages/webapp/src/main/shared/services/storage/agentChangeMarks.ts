/**
 * The marks of what the assistant changed, per project and diagram (see `agentChanges.ts`).
 * They live in this browser only, so they never reach the model, an export or a repository.
 */
import { localStorageAgentChangesPrefix } from '../../constants/constant';
import type { AgentIteration, DeletedMark } from '../agentChanges/agentChanges';

/** Fired on window with `{ projectId }` whenever a project's marks change. */
export const AGENT_CHANGES_EVENT = 'besser:agent-changes';

const marksKey = (projectId: string): string => `${localStorageAgentChangesPrefix}${projectId}`;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const isDeleted = (value: unknown): value is DeletedMark => {
  const mark = value as Partial<DeletedMark> | null;
  return !!mark && typeof mark.id === 'string' && typeof mark.label === 'string';
};

function readAll(projectId: string): Record<string, AgentIteration[]> {
  try {
    const value = JSON.parse(localStorage.getItem(marksKey(projectId)) || '{}');
    if (!value || typeof value !== 'object') return {};
    const all: Record<string, AgentIteration[]> = {};
    for (const [diagramId, iterations] of Object.entries(value)) {
      if (!Array.isArray(iterations)) continue;
      all[diagramId] = iterations
        .filter((iteration) => iteration && typeof iteration === 'object')
        .map((iteration) => ({
          at: typeof iteration.at === 'string' ? iteration.at : '',
          added: strings(iteration.added),
          modified: strings(iteration.modified),
          deleted: Array.isArray(iteration.deleted) ? iteration.deleted.filter(isDeleted) : [],
        }));
    }
    return all;
  } catch {
    return {};
  }
}

export const readAgentChanges = (projectId: string, diagramId: string): AgentIteration[] =>
  readAll(projectId)[diagramId] ?? [];

/** Replace one diagram's marks; none removes them. */
export function writeAgentChanges(projectId: string, diagramId: string, iterations: AgentIteration[]): void {
  const all = readAll(projectId);
  if (iterations.length) all[diagramId] = iterations;
  else delete all[diagramId];
  try {
    if (Object.keys(all).length) localStorage.setItem(marksKey(projectId), JSON.stringify(all));
    else localStorage.removeItem(marksKey(projectId));
  } catch {
    // Storage full or blocked: the marks are a convenience.
  }
  window.dispatchEvent(new CustomEvent(AGENT_CHANGES_EVENT, { detail: { projectId } }));
}

/** The project is deleted. */
export function removeAgentChanges(projectId: string): void {
  try {
    localStorage.removeItem(marksKey(projectId));
  } catch {
    // nothing kept
  }
}
