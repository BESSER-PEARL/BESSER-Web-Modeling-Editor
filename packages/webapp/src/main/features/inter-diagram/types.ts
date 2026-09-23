import type { UMLModel } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';

/**
 * Outcome of `bpmnModelToComponentModel`.
 *
 * The transform never throws on user-content issues — it returns
 * structured warnings so the calling UI can surface them as a toast
 * or a "Generated with N warnings" hint.
 *
 * `model` is `null` when the input is unusable (e.g. a flat BPMN with
 * no pool / lane structure).
 *
 * `elementMapping`: derived element id → source BPMN element
 * id. Synthetic emissions (external Components) have no entry.
 */
export type DerivationResult =
  | { ok: true; model: UMLModel; warnings: DerivationWarning[]; elementMapping: ElementLineageMap }
  | { ok: false; reason: DerivationRefusalReason; warnings: DerivationWarning[] };

export type DerivationRefusalReason = 'no-pools' | 'no-lanes-in-any-pool' | 'not-a-bpmn-diagram';

export type DerivationWarning =
  | { kind: 'multi-hop-gateway'; sourceTaskId: string; targetGatewayId: string }
  | { kind: 'flow-skipped-non-agentic-source'; flowId: string }
  | { kind: 'dropped-task-in-non-agentic-lane'; taskId: string }
  | { kind: 'inferred-external-component'; messageFlowId: string }
  // An agentic lane resolves to more than CAPABILITY_WARN_THRESHOLD distinct
  // capabilities; its has/uses edges fan out and the grouped diagram gets
  // busy. Advisory only — every capability is still emitted. `count` is the
  // deduped total.
  | { kind: 'capability-heavy-agent'; laneId: string; count: number }
  // Per-zone: a single grouped zone (Skills or Tools) holds more than
  // CAPABILITY_ZONE_WARN_THRESHOLD unique capability boxes; the zone is
  // crowded even if no single agent is heavy. Advisory only.
  | { kind: 'capability-heavy-zone'; zone: string; count: number }
  // A task in an agentic lane links an Agent diagram that is not in the
  // project (deleted, or a cross-project paste with a dangling ref). Its
  // tools/skills are skipped silently; this surfaces the skip so the user
  // learns why the capabilities didn't appear.
  // Warn-only — nothing about the skip changes. `taskName` pinpoints the
  // offending BPMN task (the dead ref UUID is not surfaced — it resolves to
  // nothing the user recognises); `taskId` is the stable console id.
  | { kind: 'dangling-agent-ref'; taskId: string; taskName: string };

/**
 * Outcome of `componentModelToDeploymentModel`.
 *
 * Mirrors `DerivationResult` but for the Component → Deployment
 * derivation. Kept as a sibling type (not a generic) to avoid
 * overloading the BPMN-side discriminated union — the calling UI
 * code only ever handles one direction at a time.
 */
export type DeploymentDerivationResult =
  | { ok: true; model: UMLModel; warnings: DeploymentDerivationWarning[]; elementMapping: ElementLineageMap }
  | { ok: false; reason: DeploymentDerivationRefusalReason; warnings: DeploymentDerivationWarning[] };

export type DeploymentDerivationRefusalReason =
  /** The input model.type is not ComponentDiagram. Defensive guard. */
  | 'not-a-component-diagram'
  /** The Component model has zero Component elements (empty diagram). */
  | 'no-components';

/**
 * Intra-Subsystem dependency drops and agentic-edge stereotype
 * drops are *not* warnings — they're correct behaviour from the
 * Deployment view's perspective. The only thing we surface is
 * `flat-scaffold`: the input had no Subsystems, so the result is one
 * synthetic `Default Host` Node — likely a surprise on a structured
 * diagram, worth flagging.
 */
export type DeploymentDerivationWarning = { kind: 'flat-scaffold' };

/**
 * Outcome of `laneToAgentModel(bpmn, laneId)`. Mirrors `DerivationResult`
 * but for the BPMN-lane → Agent-diagram derivation. `model` is a populated
 * AgentDiagram UMLModel; `elementMapping` maps derived AgentState id → source
 * BPMN task id (lineage).
 */
export type AgentDerivationResult =
  | { ok: true; model: UMLModel; warnings: AgentDerivationWarning[]; elementMapping: ElementLineageMap }
  | { ok: false; reason: AgentDerivationRefusalReason; warnings: AgentDerivationWarning[] };

export type AgentDerivationRefusalReason =
  | 'not-a-bpmn-diagram'
  | 'lane-not-found'
  | 'lane-not-agentic'
  | 'no-tasks-in-lane';

// Cross-lane I/O boundary states. A crossing flow whose in-lane endpoint
// can't be resolved to a specific task is still acknowledged, attached to the
// entry state, and surfaced here (never silently dropped).
export type AgentDerivationWarning =
  | { kind: 'io-attached-to-entry'; flowId: string }
  // A governed merging gateway owned by this lane has no in-lane
  // producing task feeding it (resp. no in-lane successor). The merge state is
  // STILL emitted (BESSER must bind governance to it), but it lacks a guarded
  // inbound (resp. an outbound) — surfaced so the user can wire it manually.
  | { kind: 'merge-no-producers'; gatewayId: string }
  | { kind: 'merge-no-successors'; gatewayId: string };
