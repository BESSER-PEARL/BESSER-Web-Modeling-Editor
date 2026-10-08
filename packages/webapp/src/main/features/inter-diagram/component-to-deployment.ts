import type { BesserNode, UMLModel } from '@besser/wme';
import { UMLDiagramType } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { DiagramBuilder, ModelIndex, nodeName, type Box, type Side } from './diagram-builder';
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
 *     • a DeploymentComponent *above* the Node (no parent)
 *     • a DeploymentArtifact *inside* the Node (parent = the Node)
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
  model: UMLModel,
  // sourceComponentElementId → swarm size (N). Resolved by the caller from
  // the lineage chain (Component → BPMN lane → multiplicity). Optional + defaulted
  // so every model-only caller/test is unaffected; a missing or ≤1 entry yields a
  // single ExecutionEnvironment with no `_i` suffix.
  multiplicityByComponentId: Record<string, number> = {},
): DeploymentDerivationResult {
  const warnings: DeploymentDerivationWarning[] = [];

  if (model.type !== UMLDiagramType.ComponentDiagram) {
    return { ok: false, reason: 'not-a-component-diagram', warnings };
  }
  const component = new ModelIndex(model);

  const components = collectComponents(component);
  if (components.length === 0) {
    return { ok: false, reason: 'no-components', warnings };
  }

  const subsystems = component.nodes('componentSubsystem');
  const out = new DiagramBuilder();
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
  const componentsBySubsystemId = new Map<string, BesserNode[]>();
  const orphanComponents: BesserNode[] = [];
  const aliveSubsystemIds = new Set<string>();
  for (const c of components) {
    const parentSub = immediateSubsystemParent(component, c);
    if (parentSub) {
      const arr = componentsBySubsystemId.get(parentSub.id) ?? [];
      arr.push(c);
      componentsBySubsystemId.set(parentSub.id, arr);
      for (const ancestor of component.ancestors(c)) {
        if (isSubsystem(ancestor)) aliveSubsystemIds.add(ancestor.id);
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
  const dependencies = (model.edges ?? []).filter((e) => e.type === 'ComponentDependency');
  const endpointSubsystemIds = new Set<string>();
  for (const dependency of dependencies) {
    for (const endpoint of [dependency.source, dependency.target]) {
      if (isSubsystem(component.get(endpoint))) endpointSubsystemIds.add(endpoint);
    }
  }

  // Per-Subsystem subtree.
  for (const sub of subsystems) {
    const subComps = componentsBySubsystemId.get(sub.id) ?? [];
    // Skip Subsystems whose entire subtree held only capability Components.
    if (subComps.length === 0 && !aliveSubsystemIds.has(sub.id) && !endpointSubsystemIds.has(sub.id)) continue;
    const { outerNodeId, bounds, execEnvByCompId } = emitGroupSubtree(
      out,
      nodeName(sub),
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
  for (const dependency of dependencies) {
    const srcId = resolveToExecEnvOrNodeId(
      component, dependency.source, execEnvIdByCompId, nodeIdByCompId, nodeIdBySubsystemId,
    );
    const tgtId = resolveToExecEnvOrNodeId(
      component, dependency.target, execEnvIdByCompId, nodeIdByCompId, nodeIdBySubsystemId,
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
    elementMapping[edgeId] = dependency.id; // DeploymentAssociation ← source ComponentDependency
  }

  // Open the generated diagram centred in the user's view.
  out.recenter();

  return { ok: true, model: out.build(UMLDiagramType.DeploymentDiagram), warnings, elementMapping };
}

// ── Collection helpers ──────────────────────────────────────────────

/** Capability/resource stereotype tokens — these Components represent hosted
 *  services (LLM API, DB, RAG store, skill modules), not deployable containers.
 *  Keep in sync with _CAP_TOKENS in BESSER docker_compose_generator.py and
 *  CAPABILITY_TOKENS in agentic-tokens.ts. */
const CAPABILITY_STEREOTYPES = new Set(['skill', 'tool', 'llm', 'db', 'rag']);

/** The fields read from a `component` / `componentSubsystem` node's data. */
type ComponentData = {
  name?: string;
  stereotype?: string;
  agentModelRef?: string;
  isComponentHeaderShown?: boolean;
  isComponentSubsystemHeaderShown?: boolean;
};

const dataOf = (node: BesserNode): ComponentData => node.data as ComponentData;
const isSubsystem = (node: BesserNode | undefined): node is BesserNode => node?.type === 'componentSubsystem';

function collectComponents(model: ModelIndex): BesserNode[] {
  return model
    .nodes('component')
    .filter((c) => !CAPABILITY_STEREOTYPES.has((dataOf(c).stereotype ?? '').toLowerCase().trim()));
}

/**
 * Nested Subsystems flatten. We don't walk to the root — we
 * stop at the first Subsystem ancestor. If a Component has *no*
 * Subsystem ancestor, returns null (orphan → catch-all Node).
 */
function immediateSubsystemParent(model: ModelIndex, node: BesserNode): BesserNode | null {
  return model.ancestors(node).find(isSubsystem) ?? null;
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
  model: ModelIndex,
  elementId: string,
  nodeIdByCompId: Map<string, string>,
  nodeIdBySubsystemId: Map<string, string>,
): string | undefined {
  const direct = nodeIdByCompId.get(elementId);
  if (direct) return direct;
  const el = model.get(elementId);
  if (!el) return undefined;
  if (isSubsystem(el)) return nodeIdBySubsystemId.get(elementId);
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
  model: ModelIndex,
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
function isNestedIn(out: DiagramBuilder, nodeId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let parent = out.parentId(nodeId);
  while (parent && !seen.has(parent)) {
    if (parent === ancestorId) return true;
    seen.add(parent);
    parent = out.parentId(parent);
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

// The logical DeploymentComponent row sits below the outer node (no parent).
const COMPONENT_ROW_GAP = 48; // px between the outer node bottom and the Component row

// Horizontal gap between top-level groups.
const GROUP_GAP = 64;

// ── Emit helpers ────────────────────────────────────────────────────

// Swarm multiplicity. Stamp the deployment **Artifact** name with the
// UML `[N]` multiplicity suffix when the source agent-lane's swarm size > 1.
// N==1 (the default) emits no suffix — absence means "single instance".
// The ExecEnv and DeploymentComponent names stay plain (the count belongs only
// on the physical packaging unit, not the container or the logical type).
const appendMultiplicity = (base: string, n: number): string => (n > 1 ? `${base} [${n}]` : base);

/** A `deploymentNode` with its stereotype and header switch. */
function addDeploymentNode(
  out: DiagramBuilder,
  name: string,
  bounds: Box,
  stereotype: string,
  isComponentHeaderShown: boolean,
  parentId?: string,
): string {
  return out.addNode('deploymentNode', bounds, { name, isComponentHeaderShown, stereotype }, parentId);
}

/**
 * Emit one group's full nested deployment subtree and return the outer node
 * id (the Phase-3 association anchor) plus its bounds (so the caller can advance
 * the horizontal cursor).
 *
 * With a Subsystem (`outerSource` non-null):
 *   Subsystem node (root) › Docker Host (parent = Subsystem node) › N ExecEnvs.
 * Orphan bucket (`outerSource` null): the Docker Host IS the top-level node.
 *
 * Per replica: an ExecutionEnvironment «executionEnvironment» wrapping a
 * DeploymentArtifact, plus a logical DeploymentComponent in a row below the outer
 * node (no parent), joined to its Artifact by a dashed manifest edge
 * (UML 2.5 § 19.4). Bounds are absolute; the builder stores them relative to
 * the parent.
 */
function emitGroupSubtree(
  out: DiagramBuilder,
  outerName: string,
  outerSource: BesserNode | null,
  agents: BesserNode[],
  multiplicityByComponentId: Record<string, number>,
  originX: number,
  originY: number,
  elementMapping: ElementLineageMap,
): { outerNodeId: string; bounds: Box; execEnvByCompId: Map<string, string> } {
  const outerHeaderShown = outerSource ? (dataOf(outerSource).isComponentSubsystemHeaderShown ?? true) : true;

  // Nested-subsystem placeholder: a Subsystem kept alive only by a
  // descendant child Subsystem has no agents of its own — emit a bare node.
  if (agents.length === 0) {
    const bounds: Box = { x: originX, y: originY, width: EMPTY_NODE_WIDTH, height: EMPTY_NODE_HEIGHT };
    const id = addDeploymentNode(out, outerName, bounds, 'node', outerHeaderShown);
    return { outerNodeId: id, bounds, execEnvByCompId: new Map() };
  }

  // Per agent: the Artifact sized to its name (with the `[N]` suffix), the
  // ExecutionEnvironment sized to the Artifact and its own header text, the
  // logical Component sized to its name and stereotype.
  const columns = agents.map((comp) => {
    const name = nodeName(comp) || 'Agent';
    const multiplicity = Math.max(1, Math.floor(multiplicityByComponentId[comp.id] ?? 1));
    const artifactName = appendMultiplicity(name, multiplicity);
    const artifactWidth = nameBoxWidth(artifactName, ARTIFACT_WIDTH);
    const eeWidth = Math.max(artifactWidth + EXECENV_PAD_X * 2, nodeWidthForText(name, EXECENV_STEREOTYPE));
    const componentStereotype = dataOf(comp).stereotype ?? 'component';
    const componentWidth = componentBoxWidth(name, componentStereotype);
    return { comp, name, artifactName, artifactWidth, eeWidth, componentStereotype, componentWidth };
  });
  const count = agents.length;
  const hostInnerWidth = columns.reduce((sum, c) => sum + c.eeWidth, 0) + (count - 1) * EXECENV_GAP;
  const hostWidth = HOST_PAD_X * 2 + hostInnerWidth;
  const hostHeight = HOST_HEADER + EXECENV_HEIGHT + HOST_PAD_BOTTOM;

  // ── Outer node (kept Subsystem) + Docker Host placement ──
  let outerNodeId: string | undefined;
  let outerBounds: Box;
  let hostX: number;
  let hostY: number;

  if (outerSource) {
    const subWidth = SUB_PAD_X * 2 + hostWidth;
    const subHeight = SUB_HEADER + hostHeight + SUB_PAD_BOTTOM;
    outerBounds = { x: originX, y: originY, width: subWidth, height: subHeight };
    // Kept Subsystem nodes always render «node».
    outerNodeId = addDeploymentNode(out, outerName, outerBounds, 'node', outerHeaderShown);
    hostX = originX + SUB_PAD_X;
    hostY = originY + SUB_HEADER;
  } else {
    // Orphan bucket — the Docker Host is the top-level node.
    outerBounds = { x: originX, y: originY, width: hostWidth, height: hostHeight };
    hostX = originX;
    hostY = originY;
  }

  // ── Docker Host node ──
  const hostId = addDeploymentNode(
    out,
    'Docker Host',
    { x: hostX, y: hostY, width: hostWidth, height: hostHeight },
    'docker host',
    true,
    outerNodeId,
  );
  outerNodeId ??= hostId;

  // ── One ExecutionEnvironment (+ Artifact + Component + manifest edge) per agent ──
  // Collect the ExecEnv id per source Component so Phase 3 can
  // connect agent-to-agent pairs via their individual container nodes.
  const execEnvByCompId = new Map<string, string>();
  let eeX = hostX + HOST_PAD_X;
  for (const { comp, name, artifactName, artifactWidth, eeWidth, componentStereotype, componentWidth } of columns) {
    const eeY = hostY + HOST_HEADER;

    const eeId = addDeploymentNode(
      out,
      name,
      { x: eeX, y: eeY, width: eeWidth, height: EXECENV_HEIGHT },
      EXECENV_STEREOTYPE,
      true,
      hostId,
    );
    execEnvByCompId.set(comp.id, eeId); // Source Component → its ExecEnv node

    // Artifact INSIDE the ExecutionEnvironment (parent = ExecEnv).
    // Carry the agent-diagram UUID onto the Artifact so BESSER's
    // deployment generator can resolve Artifact → Agent diagram by exact id.
    // Absent when the source Component was never linked.
    const agentModelRef = dataOf(comp).agentModelRef;
    const artifactId = out.addNode(
      'deploymentArtifact',
      { x: eeX + (eeWidth - artifactWidth) / 2, y: eeY + EXECENV_HEADER, width: artifactWidth, height: ARTIFACT_HEIGHT },
      {
        name: artifactName, // Artifact carries [N]; ExecEnv and Component names stay plain.
        // Artifact.manifests (UML 2.5 § 19.4): the cross-diagram id of the
        // source Component this artifact manifests.
        manifests: [comp.id],
        ...(agentModelRef ? { agentModelRef } : {}),
      },
      eeId,
    );

    // Logical DeploymentComponent BELOW the outer node (no parent), aligned under
    // this ExecutionEnvironment's column.
    const componentId = out.addNode(
      'deploymentComponent',
      {
        x: eeX + (eeWidth - componentWidth) / 2,
        y: outerBounds.y + outerBounds.height + COMPONENT_ROW_GAP,
        width: componentWidth,
        height: COMPONENT_HEIGHT,
      },
      { name, isComponentHeaderShown: dataOf(comp).isComponentHeaderShown ?? true, stereotype: componentStereotype },
    );
    elementMapping[componentId] = comp.id; // logical projection ← source Component

    emitManifestDependency(out, artifactId, componentId);
    eeX += eeWidth + EXECENV_GAP;
  }

  return { outerNodeId, bounds: outerBounds, execEnvByCompId };
}

function emitManifestDependency(out: DiagramBuilder, artifactId: string, componentId: string): void {
  // Emit as DeploymentDependency so the renderer paints it
  // dashed with an arrow at the target end. Source = Artifact,
  // target = Component → arrow lands at the Component (UML 2.5: arrow
  // points at the manifested element). No `stereotype` field: the
  // dashed arrow alone IS the UML 2.5 signal.
  //
  // The Component sits BELOW the Node, so the edge runs from the
  // Artifact's bottom to the Component's top.
  out.addEdge('DeploymentDependency', artifactId, componentId, ['bottom', 'top']);
}

/**
 * Handles on the sides of two nodes that face each other. The editor routes
 * the association from them; handles facing away (e.g. right → left when the
 * source is the right-hand node) send the path around both nodes and out past
 * their container's border.
 */
function facingHandles(src: Box, tgt: Box): [Side, Side] {
  const dx = tgt.x + tgt.width / 2 - (src.x + src.width / 2);
  const dy = tgt.y + tgt.height / 2 - (src.y + src.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function emitDeploymentAssociation(out: DiagramBuilder, srcNodeId: string, tgtNodeId: string): string {
  // Agentic edge stereotypes are not carried over.
  return out.addEdge(
    'DeploymentAssociation',
    srcNodeId,
    tgtNodeId,
    facingHandles(out.box(srcNodeId), out.box(tgtNodeId)),
  );
}
