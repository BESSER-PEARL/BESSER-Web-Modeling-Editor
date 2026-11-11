import type { InterfaceMode } from '../../types/project';
import { track, type InterfaceChoiceSource, type ProjectCreationSource } from './events';

export type { InterfaceChoiceSource };

/** The user chose an interface on the chooser, or arrived through an agentic link. */
export const trackInterfaceChoice = (
  mode: InterfaceMode,
  source: InterfaceChoiceSource,
  extra: { remembered?: boolean } = {},
): void => {
  track('interface_chosen', { interface: mode, source, ...extra });
};

/** A project was created; ``interface`` is the final choice, after any change on the form. */
export const trackProjectCreated = (mode: InterfaceMode, via: ProjectCreationSource): void => {
  track('project_created', { interface: mode, via });
};
