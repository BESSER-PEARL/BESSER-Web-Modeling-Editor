import type { AgentComponentsStore } from '../hooks/useAgentComponentsStore';

/** Props shared by every section of the agent components panel. */
export interface SectionProps {
  store: AgentComponentsStore;
  /** Id of the expanded row, if any (one row open at a time across the panel). */
  expandedId: string | null;
  toggle: (id: string) => void;
  expand: (id: string) => void;
}
