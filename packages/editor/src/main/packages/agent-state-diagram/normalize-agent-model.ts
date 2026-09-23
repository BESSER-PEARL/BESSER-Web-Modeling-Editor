import * as Apollon from '../../typings';
import { UMLModel, UMLModelComponent, UMLRelationship } from '../../typings';
import { UMLDiagramType } from '../diagram-type';
import { AgentComponentType, AgentRelationshipType } from './index';
import { AgentStateTransition } from './agent-state-transition/agent-state-transition';

/**
 * Normalize every agent transition in a model to the canonical nested shape.
 *
 * Agent transitions historically came in two JSON shapes: a legacy *flat* shape
 * (top-level ``condition`` + ``conditionValue``) and the canonical *nested* shape
 * (``transitionType`` + ``predefined`` / ``custom`` blocks). The Apollon editor
 * upgrades flat → nested whenever a diagram is loaded, but models that bypass the
 * editor — e.g. an ``agentBaseModels`` snapshot bundled in an imported project and
 * written straight to localStorage — keep the flat shape. The backend agent
 * processor only understands the nested shape and silently collapses flat
 * transitions to ``when_no_intent_matched``, so any model persisted outside the
 * editor must be normalized first.
 *
 * This reuses the single canonical normalizer — ``AgentStateTransition`` — by
 * round-tripping each transition through its constructor and ``serialize()``, so
 * there is no second flat→nested mapper to keep in sync. Geometry (source/target/
 * path/bounds) and the relationship id are preserved. The function is pure
 * (returns a clone) and idempotent on already-nested input.
 */
export function normalizeAgentModel(model: UMLModel): UMLModel {
  if (!model) {
    return model;
  }

  const clone: UMLModel = JSON.parse(JSON.stringify(model));
  for (const [id, relationship] of Object.entries(clone.relationships || {})) {
    if (relationship?.type !== AgentRelationshipType.AgentStateTransition) {
      continue;
    }
    // Mirror the editor's load path exactly: instantiate empty, then
    // deserialize(). deserialize() seeds geometry (via super.deserialize) and
    // performs the full flat→nested upgrade, including mapping the flat
    // ``conditionValue`` onto intentName / fileType / variable-operation fields.
    const transition = new AgentStateTransition();
    transition.deserialize(relationship as Apollon.AgentStateTransition);
    clone.relationships[id] = { ...(transition.serialize() as UMLRelationship), id };
  }

  return clone;
}

const COMPONENT_TYPES: ReadonlySet<string> = new Set<string>(Object.values(AgentComponentType));

const toComponent = (element: { bounds?: unknown } & Record<string, any>): UMLModelComponent => {
  // Components are off-canvas: they carry no position (matches what the agent components panel writes).
  const { bounds: _bounds, ...rest } = element;
  return rest as UMLModelComponent;
};

/**
 * Move agent components into ``model.components``.
 *
 * Agent components (LLMs, intents and their training-sentence bodies, RAG databases, tools,
 * skills, workspaces, GUIs) used to live on the canvas, i.e. in ``model.elements``, and for a
 * while in a top-level ``agentComponents`` map. They are now off-canvas data edited in the
 * webapp's agent components panel and stored in ``model.components`` (keyed by id, no bounds).
 *
 * This migrates both legacy locations into ``components``: component-typed entries are removed
 * from ``elements`` (bounds stripped) and ``agentComponents`` is folded in and dropped. Entries
 * already in ``components`` win over legacy copies with the same id.
 *
 * Pure (never mutates its input), idempotent, and a no-op (same reference returned) for
 * non-agent models or agent models that have nothing to migrate.
 */
export function normalizeAgentComponents(model: UMLModel): UMLModel {
  if (!model || model.type !== UMLDiagramType.AgentDiagram) {
    return model;
  }

  const elements = model.elements || {};
  const movedIds = new Set(Object.keys(elements).filter((id) => COMPONENT_TYPES.has(elements[id]?.type)));
  const legacy = model.agentComponents;
  if (movedIds.size === 0 && legacy === undefined) {
    return model;
  }

  const components: { [id: string]: UMLModelComponent } = {};
  for (const id of movedIds) {
    components[id] = toComponent(elements[id]);
  }
  for (const [id, component] of Object.entries(legacy || {})) {
    components[id] = toComponent(component);
  }
  Object.assign(components, model.components || {});

  const remaining: UMLModel['elements'] = {};
  for (const [id, element] of Object.entries(elements)) {
    if (!movedIds.has(id)) {
      remaining[id] = element;
    }
  }

  const { agentComponents: _legacy, ...rest } = model;
  return { ...rest, elements: remaining, components };
}
