import {
  ALL_DIAGRAM_TYPES,
  PerspectiveSettings,
  SupportedDiagramType,
  isPerspectiveVisible,
} from './types/project';

/**
 * A named *preset* (aggregation) of perspectives. Selecting a preset replaces
 * the per-diagram visibility map with exactly the diagrams listed here —
 * presets are pure UI sugar over the per-diagram toggles in
 * `BesserProject.settings.perspectives`.
 *
 * The "Modeling Perspectives" card in Project Settings renders these as
 * quick-select buttons above the per-diagram switches; users can fall back
 * to flipping individual toggles for fine-grained control.
 *
 * Generators are intentionally **not** filtered by perspective — every
 * generator that fits the active diagram remains reachable from the
 * Generate menu regardless of which preset is chosen.
 */
export interface PerspectiveDefinition {
  /** Stable key used for `data-testid` and matching against active state. */
  key: string;
  /** Short, user-facing label rendered on the preset button. */
  label: string;
  /** One-sentence tooltip explaining the preset. */
  description: string;
  /** The diagrams to enable when this preset is selected. */
  diagrams: SupportedDiagramType[];
}

/**
 * Curated presets, ordered as they appear in the settings panel. The set is
 * intentionally small (per the design discussion: "all dimensions individual
 * + a couple of aggregations, not too many") — for fine-grained control
 * users flip per-diagram toggles directly.
 *
 * Naming notes:
 *  - "Data Modeler" subsumes the old #117 "Database Modeling" preset
 *    (database work always uses the class diagram, so they collapse cleanly).
 *  - "Full Application" includes the agent — full-stack flows almost always
 *    pair a UI with an assistant.
 *  - "Show All" is the escape hatch back to the unfiltered workspace.
 */
export const PERSPECTIVES: PerspectiveDefinition[] = [
  {
    key: 'data',
    label: 'Data Modeler',
    description: 'Class + object diagrams (covers OOP, schemas, SQL, SQLAlchemy).',
    diagrams: ['ClassDiagram', 'ObjectDiagram'],
  },
  {
    key: 'agent',
    label: 'Agent Developer',
    description: 'Agent and user diagrams for conversational agents.',
    diagrams: ['AgentDiagram', 'UserDiagram'],
  },
  {
    key: 'fullApp',
    label: 'Full Application',
    description: 'Class, agent, and no-code GUI diagrams.',
    diagrams: ['ClassDiagram', 'AgentDiagram', 'GUINoCodeDiagram'],
  },
  {
    key: 'quantum',
    label: 'Quantum',
    description: 'Quantum circuit diagrams only.',
    diagrams: ['QuantumCircuitDiagram'],
  },
  {
    key: 'all',
    label: 'Show All',
    description: 'Every supported perspective.',
    diagrams: [...ALL_DIAGRAM_TYPES],
  },
];

/**
 * True when `preset.diagrams` is exactly the set of currently-enabled
 * perspectives (used to mark the matching preset button as pressed).
 */
export function isPresetActive(
  preset: PerspectiveDefinition,
  perspectives: PerspectiveSettings | undefined,
): boolean {
  const enabled = new Set(
    ALL_DIAGRAM_TYPES.filter((t) => isPerspectiveVisible(perspectives, t)),
  );
  if (enabled.size !== preset.diagrams.length) return false;
  return preset.diagrams.every((t) => enabled.has(t));
}

/** Build a `PerspectiveSettings` map enabling exactly the diagrams in `types`. */
export function perspectivesFromDiagramList(
  types: SupportedDiagramType[],
): PerspectiveSettings {
  const map = {} as PerspectiveSettings;
  const allowed = new Set(types);
  for (const t of ALL_DIAGRAM_TYPES) {
    map[t] = allowed.has(t);
  }
  return map;
}
