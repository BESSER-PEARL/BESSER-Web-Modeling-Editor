import * as Apollon from '../../typings';
import { UMLModel, UMLRelationship } from '../../typings';
import { AgentRelationshipType } from './index';
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
  if (!model || !model.relationships) {
    return model;
  }

  const clone: UMLModel = JSON.parse(JSON.stringify(model));
  for (const [id, relationship] of Object.entries(clone.relationships)) {
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
