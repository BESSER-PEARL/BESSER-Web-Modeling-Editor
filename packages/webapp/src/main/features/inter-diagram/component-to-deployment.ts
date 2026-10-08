import type {
  UMLComponentComponent,
  UMLComponentSubsystem,
  UMLDeploymentArtifact,
  UMLDeploymentAssociation,
  UMLDeploymentComponent,
  UMLDeploymentNode,
  UMLElement,
  UMLModel,
  UMLRelationship,
} from '@besser/wme';
import { Direction, UMLDiagramType } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { uuid } from '../../shared/utils/uuid';
import { recenterModelOnOrigin } from './recenter';
import { ceilToGrid, estimateTextWidth } from './text-metrics';
import type { DeploymentDerivationResult, DeploymentDerivationWarning } from './types';

/**
 * Component → Deployment derivation.
 *
 * - One DeploymentNode per *unique* Subsystem in the source that holds an
 *   agent Component or is itself a dependency endpoint (an external black-box
 *   Subsystem), sibling under the diagram root (nested Subsystems flatten).
 * - One synthetic `Default Host` Node iff any orphan Component exists.
 * - For each source Component (UML 2.5 deployment notation):
 *     • a DeploymentComponent *above* the Node (owner=null)
 *     • a DeploymentArtifact *inside* the Node (owner=nodeId)
 *     • a DeploymentDependency from Artifact → Component
 *       (dashed, arrow at Component end — the UML 2.5 manifest signal;
 *       no `«manifest»` label because the renderer doesn't paint one
 *       on DeploymentDependency and it isn't serialized anyway).
 * - One DeploymentAssociation per unique cross-Subsystem
 *   ComponentDependency, deduplicated direction-preserving.
 * - Edge stereotypes (`delegates`/`supervises`/etc.) dropped silently.
 *   No `dropped-*` warnings.
 */
export function componentModelToDeploymentModel(
  component: UMLModel,
  // sourceComponentElementId → swarm size (N). Resolved by the caller from
  // the lineage chain (Component → BPMN lane → multiplicity). Optional + defaulted
  // so every model-only caller/test is unaffected; a missing or ≤1 entry yields a
  // single ExecutionEnvironment with no `_i` suffix.
  multiplicityByComponentId: Record<string, number> = {},
): DeploymentDerivationResult {
  const warnings: DeploymentDerivationWarning[] = [];

  if (component.type !== UMLDiagramType.ComponentDiagram) {
    return { ok: false, reason: 'not-a-component-diagram', warnings };
  }

  const components = collectComponents(component);
  if (components.length === 0) {
    return { ok: false, reason: 'no-components', warnings };
  }

  const subsystems = collectSubsystems(component);
  const out = emptyDeploymentModel(component.size);
  // derivedElementId → sourceElementId. Only the outer Subsystem node
  // (← source Subsystem) and the logical DeploymentComponent (← source Component)
  // are mapped. Synthetic / physical emissions — the Docker Host wrapper, the
  // ExecutionEnvironment nodes, the Artifacts, and the manifest edges — leave no
  // entry (UML 2.5 § 19.4: an Artifact manifests a Component, it is not
  // a projection of any source element).
  const elementMapping: ElementLineageMap = {};

  // Group each agent Component under its immediate Subsystem parent or the
  // orphan bucket, and mark every ancestor Subsystem "alive" so a Subsystem whose
  // only direct children are nested Subsystems is not skipped.
  const componentsBySubsystemId = new Map<string, UMLComponentComponent[]>();
  const orphanComponents: UMLComponentComponent[] = [];
  const aliveSubsystemIds = new Set<string>();
  for (const c of components) {
    const parentSub = immediateSubsystemParent(component, c);
    if (parentSub) {
      const arr = componentsBySubsystemId.get(parentSub.id) ?? [];
      arr.push(c);
      componentsBySubsystemId.set(parentSub.id, arr);
      let ownerId = c.owner;
      while (ownerId) {
        const ownerEl: UMLElement | undefined = component.elements[ownerId];
        if (!ownerEl) break;
        if (ownerEl.type === 'Subsystem') aliveSubsystemIds.add(ownerId);
        ownerId = ownerEl.owner;
      }
    } else {
      orphanComponents.push(c);
    }
  }

  // Emit one nested subtree per group, stacking groups left-to-right.
  // `nodeIdBySubsystemId` / `nodeIdByCompId` map to the OUTER node (the kept
  // Subsystem node, or the orphan Docker Host) — used as the fallback for
  // Subsystem-level endpoints (external black-box pools) in Phase 3.
  // `execEnvIdByCompId` maps each source Component to its ExecEnv node (the
  // preferred endpoint for agent-to-agent CommunicationPath derivation).
  const nodeIdBySubsystemId = new Map<string, string>(); // subsystem.id → outer Subsystem node id
  const nodeIdByCompId = new Map<string, string>(); // sourceComponentId → outer node (fallback)
  const execEnvIdByCompId = new Map<string, string>(); // sourceComponentId → ExecEnv node id
  let cursorX = -320;
  const originY = -200;

  // A Subsystem that is itself a dependency endpoint (an external black-box
  // pool from the BPMN derivation) needs a node for its CommunicationPath.
  const endpointSubsystemIds = new Set<string>();
  for (const rel of Object.values(component.relationships)) {
    if (rel.type !== 'ComponentDependency') continue;
    for (const endpoint of [rel.source.element, rel.target.element]) {
      if (component.elements[endpoint]?.type === 'Subsystem') endpointSubsystemIds.add(endpoint);
    }
  }

  // Per-Subsystem subtree.
  for (const sub of subsystems) {
    const subComps = componentsBySubsystemId.get(sub.id) ?? [];
    // Skip Subsystems whose entire subtree held only capability Components.
    if (subComps.length === 0 && !aliveSubsystemIds.has(sub.id) && !endpointSubsystemIds.has(sub.id)) continue;
    const { outerNodeId, bounds, execEnvByCompId } = emitGroupSubtree(
      out,
      sub.name,
      sub,
      subComps,
      multiplicityByComponentId,
      cursorX,
      originY,
      elementMapping,
    );
    nodeIdBySubsystemId.set(sub.id, outerNodeId);
    elementMapping[outerNodeId] = sub.id; // DeploymentNode ← source Subsystem
    for (const comp of subComps) nodeIdByCompId.set(comp.id, outerNodeId);
    for (const [cId, eeId] of execEnvByCompId) execEnvIdByCompId.set(cId, eeId);
    cursorX = bounds.x + bounds.width + GROUP_GAP;
  }

  // Orphan bucket (no Subsystem to keep → top-level Docker Host).
  if (orphanComponents.length > 0) {
    const { outerNodeId, bounds, execEnvByCompId } = emitGroupSubtree(
      out,
      'Docker Host',
      null,
      orphanComponents,
      multiplicityByComponentId,
      cursorX,
      originY,
      elementMapping,
    );
    // Orphan Docker Host is synthetic — no elementMapping entry.
    for (const comp of orphanComponents) nodeIdByCompId.set(comp.id, outerNodeId);
    for (const [cId, eeId] of execEnvByCompId) execEnvIdByCompId.set(cId, eeId);
    cursorX = bounds.x + bounds.width + GROUP_GAP;
  }

  // `flat-scaffold` warning: input had zero Subsystems and all Components became
  // orphans under one synthetic Docker Host. (Unchanged.)
  if (subsystems.length === 0) {
    warnings.push({ kind: 'flat-scaffold' });
  }

  // ComponentDependencies → DeploymentAssociation.
  // Resolve endpoints to ExecEnv nodes (per-container specificity) first;
  // fall back to the outer node for Subsystem-level endpoints (external black-box
  // pools) that have no ExecEnv. This allows intra-pool agent-to-agent deps to emit
  // a DeploymentAssociation → CommunicationPath between their individual ExecEnv
  // containers, since ExecEnv ids are always distinct even within the same Subsystem.
  // A pair is still deduped; only a same-ExecEnv-id pair is skipped
  // (shouldn't occur for two distinct agents).
  const dedup = new Set<string>();
  for (const rel of Object.values(component.relationships)) {
    if (rel.type !== 'ComponentDependency') continue;
    const srcId = resolveToExecEnvOrNodeId(
      component, rel.source.element, execEnvIdByCompId, nodeIdByCompId, nodeIdBySubsystemId,
    );
    const tgtId = resolveToExecEnvOrNodeId(
      component, rel.target.element, execEnvIdByCompId, nodeIdByCompId, nodeIdBySubsystemId,
    );
    if (!srcId || !tgtId || srcId === tgtId) continue;
    // A node nested in the other (an agent's ExecEnv inside the Subsystem node
    // of a Subsystem-level endpoint) is already joined by containment; an
    // association between them has no geometry of its own.
    if (isNestedIn(out, srcId, tgtId) || isNestedIn(out, tgtId, srcId)) continue;
    const key = [srcId, tgtId].sort().join('\x00'); // CommunicationPath is undirected — collapse both directions
    if (dedup.has(key)) continue;
    dedup.add(key);
    const edgeId = emitDeploymentAssociation(out, srcId, tgtId);
    elementMapping[edgeId] = rel.id; // DeploymentAssociation ← source ComponentDependency
  }

  // Open the generated diagram centred in the user's view.
  recenterModelOnOrigin(out);

  return { ok: true, model: out, warnings, elementMapping };
}

// ── Collection helpers ──────────────────────────────────────────────

/** Capability/resource stereotype tokens — these Components represent hosted
 *  services (LLM API, DB, RAG store, skill modules), not deployable containers.
 *  Keep in sync with _CAP_TOKENS in BESSER docker_compose_generator.py and
 *  CAPABILITY_TOKENS in agentic-tokens.ts. */
const CAPABILITY_STEREOTYPES = new Set(['skill', 'tool', 'llm', 'db', 'rag']);

const isComponent = (e: UMLElement): e is UMLComponentComponent => e.type === 'Component';
const isSubsystem = (e: UMLElement): e is UMLComponentSubsystem => e.type === 'Subsystem';

function collectComponents(model: UMLModel): UMLComponentComponent[] {
  return Object.values(model.elements)
    .filter(isComponent)
    .filter((e) => !CAPABILITY_STEREOTYPES.has((e.stereotype ?? '').toLowerCase().trim()));
}

function collectSubsystems(model: UMLModel): UMLComponentSubsystem[] {
  return Object.values(model.elements).filter(isSubsystem);
}

/**
 * Nested Subsystems flatten. We don't walk to the root — we
 * stop at the first Subsystem ancestor. If a Component has *no*
 * Subsystem ancestor, returns null (orphan → catch-all Node).
 */
function immediateSubsystemParent(model: UMLModel, el: UMLElement): UMLElement | null {
  let cur: UMLElement | null = el;
  while (cur && cur.owner) {
    const parent: UMLElement | undefined = model.elements[cur.owner];
    if (!parent) return null;
    if (parent.type === 'Subsystem') return parent;
    cur = parent;
  }
  return null;
}

/**
 * Resolve a ComponentDependency endpoint to the
 * DeploymentNode it belongs to. Source endpoint may be:
 *   1) a tracked Component (lookup in `nodeIdByCompId` — populated in Phase 2)
 *   2) the Subsystem itself (lookup in `nodeIdBySubsystemId` — populated in Phase 1)
 *   3) any other element nested inside a Subsystem (walk up via
 *      `immediateSubsystemParent`, then look up by that Subsystem)
 * Returns undefined if no Node mapping can be derived.
 */
function resolveToNodeId(
  model: UMLModel,
  elementId: string,
  nodeIdByCompId: Map<string, string>,
  nodeIdBySubsystemId: Map<string, string>,
): string | undefined {
  const direct = nodeIdByCompId.get(elementId);
  if (direct) return direct;
  const el = model.elements[elementId];
  if (!el) return undefined;
  if (el.type === 'Subsystem') return nodeIdBySubsystemId.get(elementId);
  const sub = immediateSubsystemParent(model, el);
  if (sub) return nodeIdBySubsystemId.get(sub.id);
  return undefined;
}

/**
 * Resolve a ComponentDependency endpoint to a DeploymentNode ID,
 * preferring the agent's ExecEnv node (per-container specificity) over the
 * outer Subsystem node. Falls back to `resolveToNodeId` for Subsystem-level
 * endpoints (external black-box pools) that have no corresponding ExecEnv.
 */
function resolveToExecEnvOrNodeId(
  model: UMLModel,
  elementId: string,
  execEnvIdByCompId: Map<string, string>,
  nodeIdByCompId: Map<string, string>,
  nodeIdBySubsystemId: Map<string, string>,
): string | undefined {
  const eeId = execEnvIdByCompId.get(elementId);
  if (eeId) return eeId;
  return resolveToNodeId(model, elementId, nodeIdByCompId, nodeIdBySubsystemId);
}

/** True when `nodeId` sits (at any depth) inside `ancestorId`. */
function isNestedIn(model: UMLModel, nodeId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let owner = model.elements[nodeId]?.owner;
  while (owner && !seen.has(owner)) {
    if (owner === ancestorId) return true;
    seen.add(owner);
    owner = model.elements[owner]?.owner;
  }
  return false;
}

// ── Layout constants (per-agent ExecutionEnvironment nesting) ──
// Bottom-up nesting: Subsystem › Docker Host › ExecutionEnvironment › Artifact,
// with the logical DeploymentComponent in a row below the Subsystem.
const COMPONENT_WIDTH = 160; // minimum; grows to fit the name
const COMPONENT_HEIGHT = 60;
const ARTIFACT_WIDTH = 160; // minimum; grows to fit the name
const ARTIFACT_HEIGHT = 60;

// The Artifact and Component boxes centre their name and draw their icon in
// the top-right corner (Artifact: x = width-26 … width-7; Component: width-31
// … width-7). A centred name clears the icon when the box is at least the name
// plus twice the icon band.
const ICON_BAND = 32;
// The node's «stereotype» line is drawn at 85 % of the font size; its 3-D
// side takes 8 px of the box width.
const NODE_TEXT_PAD = 28;
const nameBoxWidth = (name: string, min: number): number =>
  Math.max(min, ceilToGrid(estimateTextWidth(name) + 2 * ICON_BAND));
const componentBoxWidth = (name: string, stereotype: string): number =>
  Math.max(
    nameBoxWidth(name, COMPONENT_WIDTH),
    ceilToGrid(estimateTextWidth(`«${stereotype}»`, { scale: 0.85 }) + 2 * ICON_BAND),
  );
const nodeWidthForText = (name: string, stereotype: string): number =>
  ceilToGrid(
    Math.max(estimateTextWidth(name), estimateTextWidth(`«${stereotype}»`, { scale: 0.85 })) + NODE_TEXT_PAD,
  );

// One ExecutionEnvironment wraps exactly one Artifact.
// Header = 60 px: WME renders «stereotype» baseline at y=22 and name baseline at y=48
// inside the node box; name bottom ≈ y=51. 60 px clears that with ~9 px breathing room.
const EXECENV_STEREOTYPE = 'executionEnvironment';
const EXECENV_HEADER = 60; // «executionEnvironment» stereotype + name band
const EXECENV_PAD_X = 20; // L/R padding around the inner Artifact
const EXECENV_PAD_BOTTOM = 20;
const EXECENV_HEIGHT = EXECENV_HEADER + ARTIFACT_HEIGHT + EXECENV_PAD_BOTTOM; // 140
const EXECENV_GAP = 32; // horizontal gap between sibling ExecEnvs

// The Docker Host wraps the row of ExecutionEnvironments.
const HOST_HEADER = 60; // «docker host» stereotype + name band (60 px — same clearance as EXECENV)
const HOST_PAD_X = 24;
const HOST_PAD_BOTTOM = 24;

// The kept Subsystem node wraps the Docker Host.
const SUB_HEADER = 60; // same 60 px clearance
const SUB_PAD_X = 24;
const SUB_PAD_BOTTOM = 24;

// A Subsystem kept alive only by a nested child Subsystem (no agents of its own)
// is emitted as a bare placeholder node at this minimum size.
const EMPTY_NODE_WIDTH = 280;
const EMPTY_NODE_HEIGHT = 120;

// The logical DeploymentComponent row sits below the outer node (owner=null).
const COMPONENT_ROW_GAP = 48; // px between the outer node bottom and the Component row

// Horizontal gap between top-level groups.
const GROUP_GAP = 64;

// ── Emit helpers ────────────────────────────────────────────────────

function emptyDeploymentModel(size: { width: number; height: number }): UMLModel {
  return {
    version: '3.0.0',
    type: UMLDiagramType.DeploymentDiagram,
    size,
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  };
}

// Swarm multiplicity. Stamp the deployment **Artifact** name with the
// UML `[N]` multiplicity suffix when the source agent-lane's swarm size > 1.
// N==1 (the default) emits no suffix — absence means "single instance".
// The ExecEnv and DeploymentComponent names stay plain (the count belongs only
// on the physical packaging unit, not the container or the logical type).
const appendMultiplicity = (base: string, n: number): string => (n > 1 ? `${base} [${n}]` : base);

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Emit one group's full nested deployment subtree and return the outer node
 * id (the Phase-3 association anchor) plus its bounds (so the caller can advance
 * the horizontal cursor).
 *
 * With a Subsystem (`outerSource` non-null):
 *   Subsystem node (owner=null) › Docker Host (owner=Subsystem) › N ExecEnvs.
 * Orphan bucket (`outerSource` null): the Docker Host IS the top-level node.
 *
 * Per replica: an ExecutionEnvironment «executionEnvironment» wrapping a
 * DeploymentArtifact, plus a logical DeploymentComponent in a row below the outer
 * node (owner=null), joined to its Artifact by a dashed manifest edge
 * (UML 2.5 § 19.4). All bounds are ABSOLUTE — the importer converts owned elements
 * to parent-relative recursively.
 */
function emitGroupSubtree(
  out: UMLModel,
  outerName: string,
  outerSource: UMLComponentSubsystem | null,
  agents: UMLComponentComponent[],
  multiplicityByComponentId: Record<string, number>,
  originX: number,
  originY: number,
  elementMapping: ElementLineageMap,
): { outerNodeId: string; bounds: Bounds; execEnvByCompId: Map<string, string> } {
  // Nested-subsystem placeholder: a Subsystem kept alive only by a
  // descendant child Subsystem has no agents of its own — emit a bare node.
  if (agents.length === 0) {
    const bounds: Bounds = { x: originX, y: originY, width: EMPTY_NODE_WIDTH, height: EMPTY_NODE_HEIGHT };
    const id = uuid();
    const node: UMLDeploymentNode = {
      id,
      name: outerName,
      type: 'DeploymentNode',
      owner: null,
      bounds,
      stereotype: 'node',
      displayStereotype: outerSource?.displayStereotype ?? true,
    };
    out.elements[id] = node;
    return { outerNodeId: id, bounds, execEnvByCompId: new Map() };
  }

  // Per agent: the Artifact sized to its name (with the `[N]` suffix), the
  // ExecutionEnvironment sized to the Artifact and its own header text, the
  // logical Component sized to its name and stereotype.
  const columns = agents.map((comp) => {
    const name = comp.name || 'Agent';
    const multiplicity = Math.max(1, Math.floor(multiplicityByComponentId[comp.id] ?? 1));
    const artifactName = appendMultiplicity(name, multiplicity);
    const artifactWidth = nameBoxWidth(artifactName, ARTIFACT_WIDTH);
    const eeWidth = Math.max(artifactWidth + EXECENV_PAD_X * 2, nodeWidthForText(name, EXECENV_STEREOTYPE));
    const componentStereotype = comp.stereotype ?? 'component';
    const componentWidth = componentBoxWidth(name, componentStereotype);
    return { comp, name, artifactName, artifactWidth, eeWidth, componentStereotype, componentWidth };
  });
  const count = agents.length;
  const hostInnerWidth = columns.reduce((sum, c) => sum + c.eeWidth, 0) + (count - 1) * EXECENV_GAP;
  const hostWidth = HOST_PAD_X * 2 + hostInnerWidth;
  const hostHeight = HOST_HEADER + EXECENV_HEIGHT + HOST_PAD_BOTTOM;

  // ── Outer node (kept Subsystem) + Docker Host placement ──
  let outerNodeId: string;
  let outerBounds: Bounds;
  let hostX: number;
  let hostY: number;
  let hostOwner: string | null;

  if (outerSource) {
    const subWidth = SUB_PAD_X * 2 + hostWidth;
    const subHeight = SUB_HEADER + hostHeight + SUB_PAD_BOTTOM;
    outerBounds = { x: originX, y: originY, width: subWidth, height: subHeight };
    outerNodeId = uuid();
    const outerNode: UMLDeploymentNode = {
      id: outerNodeId,
      name: outerName,
      type: 'DeploymentNode',
      owner: null,
      bounds: outerBounds,
      // Kept Subsystem nodes always render «node».
      stereotype: 'node',
      displayStereotype: outerSource.displayStereotype ?? true,
    };
    out.elements[outerNodeId] = outerNode;
    hostX = originX + SUB_PAD_X;
    hostY = originY + SUB_HEADER;
    hostOwner = outerNodeId;
  } else {
    // Orphan bucket — the Docker Host is the top-level node.
    outerBounds = { x: originX, y: originY, width: hostWidth, height: hostHeight };
    hostX = originX;
    hostY = originY;
    hostOwner = null;
    outerNodeId = ''; // set to the host id below
  }

  // ── Docker Host node ──
  const hostId = uuid();
  const host: UMLDeploymentNode = {
    id: hostId,
    name: 'Docker Host',
    type: 'DeploymentNode',
    owner: hostOwner,
    bounds: { x: hostX, y: hostY, width: hostWidth, height: hostHeight },
    stereotype: 'docker host',
    displayStereotype: true,
  };
  out.elements[hostId] = host;
  if (!outerSource) outerNodeId = hostId;

  // ── One ExecutionEnvironment (+ Artifact + Component + manifest edge) per agent ──
  // Collect the ExecEnv id per source Component so Phase 3 can
  // connect agent-to-agent pairs via their individual container nodes.
  const execEnvByCompId = new Map<string, string>();
  let eeX = hostX + HOST_PAD_X;
  for (const { comp, name, artifactName, artifactWidth, eeWidth, componentStereotype, componentWidth } of columns) {
    const eeY = hostY + HOST_HEADER;

    const eeId = uuid();
    const executionEnvironment: UMLDeploymentNode = {
      id: eeId,
      name,
      type: 'DeploymentNode',
      owner: hostId,
      bounds: { x: eeX, y: eeY, width: eeWidth, height: EXECENV_HEIGHT },
      stereotype: EXECENV_STEREOTYPE,
      displayStereotype: true,
    };
    out.elements[eeId] = executionEnvironment;
    execEnvByCompId.set(comp.id, eeId); // Source Component → its ExecEnv node

    // Artifact INSIDE the ExecutionEnvironment (owner = ExecEnv).
    const artifactId = uuid();
    const artifactBounds: Bounds = {
      x: eeX + (eeWidth - artifactWidth) / 2,
      y: eeY + EXECENV_HEADER,
      width: artifactWidth,
      height: ARTIFACT_HEIGHT,
    };
    // Carry the agent-diagram UUID onto the Artifact so BESSER's
    // deployment generator can resolve Artifact → Agent diagram by exact id.
    // Absent when the source Component was never linked.
    const artifact: UMLDeploymentArtifact = {
      id: artifactId,
      name: artifactName, // Artifact carries [N]; ExecEnv and Component names stay plain.
      type: 'DeploymentArtifact',
      owner: eeId,
      bounds: artifactBounds,
      // Artifact.manifests (UML 2.5 § 19.4): the cross-diagram id of the
      // source Component this artifact manifests.
      manifests: [comp.id],
      ...(comp.agentModelRef ? { agentModelRef: comp.agentModelRef } : {}),
    };
    out.elements[artifactId] = artifact;

    // Logical DeploymentComponent BELOW the outer node (owner=null), aligned under
    // this ExecutionEnvironment's column.
    const componentId = uuid();
    const componentBounds: Bounds = {
      x: eeX + (eeWidth - componentWidth) / 2,
      y: outerBounds.y + outerBounds.height + COMPONENT_ROW_GAP,
      width: componentWidth,
      height: COMPONENT_HEIGHT,
    };
    const deploymentComponent: UMLDeploymentComponent = {
      id: componentId,
      name,
      type: 'DeploymentComponent',
      owner: null,
      bounds: componentBounds,
      stereotype: componentStereotype,
      displayStereotype: comp.displayStereotype ?? true,
    };
    out.elements[componentId] = deploymentComponent;
    elementMapping[componentId] = comp.id; // logical projection ← source Component

    // Dashed manifest edge: Artifact (source) → Component (target). (Reuses the
    // existing helper unchanged.)
    emitManifestDependency(out, artifactId, artifactBounds, componentId, componentBounds);
    eeX += eeWidth + EXECENV_GAP;
  }

  return { outerNodeId, bounds: outerBounds, execEnvByCompId };
}

function emitManifestDependency(
  out: UMLModel,
  artifactId: string,
  artifactBounds: { x: number; y: number; width: number; height: number },
  componentId: string,
  componentBounds: { x: number; y: number; width: number; height: number },
): void {
  const id = uuid();
  // Emit as DeploymentDependency so the renderer paints it
  // dashed (strokeDasharray=7) with an arrow at the target end
  // (markerEnd). Source = Artifact, target = Component → arrow lands
  // at the Component (UML 2.5: arrow points at the manifested element).
  // No `stereotype` field. The renderer gates label rendering
  // on `element.type === 'ComponentDependency'`, and
  // UMLDeploymentDependency.serialize does not persist a stereotype
  // field anyway. The dashed arrow alone IS the UML 2.5 signal.
  //
  // Component is BELOW the Node, so the edge
  // runs Artifact bottom-centre → Component top-centre (was top↔bottom
  // when Component was above). Relationship direction (source =
  // Artifact, target = Component) is unchanged — only the path coords
  // flip. Endpoint `direction` hints flip too so the editor's edge
  // router lands the connectors correctly.
  const artifactBottomCx = artifactBounds.x + artifactBounds.width / 2;
  const artifactBottomY = artifactBounds.y + artifactBounds.height;
  const componentTopCx = componentBounds.x + componentBounds.width / 2;
  const componentTopY = componentBounds.y;
  const manifest: UMLRelationship = {
    id,
    name: '',
    type: 'DeploymentDependency',
    owner: null,
    bounds: {
      x: Math.min(artifactBottomCx, componentTopCx) - 4,
      y: artifactBottomY,
      width: Math.abs(artifactBottomCx - componentTopCx) + 8,
      height: Math.max(8, componentTopY - artifactBottomY),
    },
    path: [
      { x: artifactBottomCx, y: artifactBottomY },
      { x: componentTopCx, y: componentTopY },
    ],
    source: { element: artifactId, direction: Direction.Down },
    target: { element: componentId, direction: Direction.Up },
  };
  out.relationships[id] = manifest;
}

/**
 * Ports on the sides of two nodes that face each other. The editor routes the
 * association from these on load; ports facing away (e.g. right → left when
 * the source is the right-hand node) send the path around both nodes and out
 * past their container's border.
 */
function facingPorts(src: Bounds, tgt: Bounds): [Direction, Direction] {
  const dx = tgt.x + tgt.width / 2 - (src.x + src.width / 2);
  const dy = tgt.y + tgt.height / 2 - (src.y + src.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [Direction.Right, Direction.Left] : [Direction.Left, Direction.Right];
  return dy >= 0 ? [Direction.Down, Direction.Up] : [Direction.Up, Direction.Down];
}

function emitDeploymentAssociation(out: UMLModel, srcNodeId: string, tgtNodeId: string): string {
  const id = uuid();
  const src = out.elements[srcNodeId].bounds;
  const tgt = out.elements[tgtNodeId].bounds;
  const [srcDir, tgtDir] = facingPorts(src, tgt);
  const association: UMLDeploymentAssociation = {
    id,
    name: '',
    type: 'DeploymentAssociation',
    owner: null,
    bounds: {
      x: Math.min(src.x, tgt.x),
      y: Math.min(src.y, tgt.y),
      width: Math.abs(src.x - tgt.x) + Math.max(src.width, tgt.width),
      height: Math.abs(src.y - tgt.y) + Math.max(src.height, tgt.height),
    },
    path: [
      { x: src.x + src.width / 2, y: src.y + src.height / 2 },
      { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 },
    ],
    source: { element: srcNodeId, direction: srcDir },
    target: { element: tgtNodeId, direction: tgtDir },
    // Agentic edge stereotypes are not carried over.
  };
  out.relationships[id] = association;
  return id;
}
