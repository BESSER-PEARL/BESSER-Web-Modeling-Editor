import type { InterfaceMode } from '../../types/project';
import { getPostHog } from './lazy-analytics';

/** Where the user picked between the low-code editor and the agent. */
export type InterfaceChoiceSource = 'first_run' | 'new_project' | 'url';

// Both are no-ops until PostHog has loaded, and PostHog only captures after
// cookie consent.

/** The user chose an interface on the chooser, or arrived through an agentic link. */
export const trackInterfaceChoice = (
  mode: InterfaceMode,
  source: InterfaceChoiceSource,
  extra: Record<string, unknown> = {},
): void => {
  getPostHog()?.capture('interface_chosen', { interface: mode, source, ...extra });
};

/** A project was created; ``interface`` is the final choice, after any change on the form. */
export const trackProjectCreated = (mode: InterfaceMode, via: 'form' | 'describe_it'): void => {
  getPostHog()?.capture('project_created', { interface: mode, via });
};
