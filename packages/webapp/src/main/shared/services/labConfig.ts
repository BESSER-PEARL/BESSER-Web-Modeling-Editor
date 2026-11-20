/**
 * Whether this editor instance is a BESSER Lab, read from the cached
 * `GET /spec-driven/config` (`lab.enabled`). An unreachable backend or one
 * without the field counts as "not a lab", so the chat keeps its normal path.
 */
import { getSpecDrivenConfig, peekServerSpecDrivenConfig } from './specDrivenConfig';

/** Resolves once the server config is known (fetched at most once per page load). */
export async function getLabEnabled(): Promise<boolean> {
  return (await getSpecDrivenConfig()).lab?.enabled === true;
}

/** The answer without waiting: false until the server config has loaded. */
export function peekLabEnabled(): boolean {
  return peekServerSpecDrivenConfig()?.lab?.enabled === true;
}

/** Whether the server's config has loaded, so a false answer means "not a lab" and not "unreachable". */
export function isLabConfigKnown(): boolean {
  return peekServerSpecDrivenConfig() !== null;
}
