/**
 * Whether this editor instance is a BESSER Lab, read from the cached
 * `GET /spec-driven/config` (`lab.enabled`). `getLabEnabled` counts an
 * unreachable backend as "not a lab"; `resolveLabEnabled` tells the two apart,
 * for a caller that must not guess (where the chat sends a message).
 */
import { getSpecDrivenConfig, peekServerSpecDrivenConfig } from './specDrivenConfig';

/** Wait before the one retry of a failed config load (the backend may be restarting). */
const LAB_CONFIG_RETRY_DELAY_MS = 1500;

/** Resolves once the server config is known (fetched at most once per page load). */
export async function getLabEnabled(): Promise<boolean> {
  return (await getSpecDrivenConfig()).lab?.enabled === true;
}

/**
 * Whether this instance is a BESSER Lab, retrying a failed config load once;
 * null when the server's config still cannot be read.
 */
export async function resolveLabEnabled(): Promise<boolean | null> {
  for (let attempt = 0; ; attempt += 1) {
    // A failed load is not cached: the next call fetches again.
    await getSpecDrivenConfig();
    const config = peekServerSpecDrivenConfig();
    if (config) return config.lab?.enabled === true;
    if (attempt > 0) return null;
    await new Promise((resolve) => setTimeout(resolve, LAB_CONFIG_RETRY_DELAY_MS));
  }
}

/** The answer without waiting: false until the server config has loaded. */
export function peekLabEnabled(): boolean {
  return peekServerSpecDrivenConfig()?.lab?.enabled === true;
}

/** Whether the server's config has loaded, so a false answer means "not a lab" and not "unreachable". */
export function isLabConfigKnown(): boolean {
  return peekServerSpecDrivenConfig() !== null;
}
