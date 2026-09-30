import {
  FULL_PROJECT_DIAGRAM_TYPE,
  SoftwarePatternCategory,
  SoftwarePatternTemplate,
  SoftwarePatternType,
} from './software-pattern/software-pattern-types';
import { UMLDiagramType, isV4Format, normalizeV4Model } from '@besser/wme';
import { migrateUMLModelV3ToV4 } from '../../../shared/services/storage/migrate-uml-v3-to-v4';
import { isV3UMLModel } from '../../../shared/types/project';
import libraryCompleteModel from '../../../templates/pattern/structural/Library_Complete.json';
import libraryOclModel from '../../../templates/pattern/structural/Library_OCL.json';
import teamOclModel from '../../../templates/pattern/structural/team_player_ocl.json';
import dppModel from '../../../templates/pattern/structural/dpp.json';
import aiSandboxModel from '../../../templates/pattern/structural/ai_sandbox.json';
import nexaCrmModel from '../../../templates/pattern/structural/nexacrm.json';
import greetingagent from '../../../templates/pattern/agent/greetingagent.json';
import dbagent from '../../../templates/pattern/agent/dbagent.json';
import gymagent from '../../../templates/pattern/agent/gymagent.json';
import faqRagAgent from '../../../templates/pattern/agent/faqragagent.json';
import chatbotAgent from '../../../templates/pattern/agent/chatbotagent.json';
import libraryAgent from '../../../templates/pattern/agent/libraryagent.json';
import traficlightModel from '../../../templates/pattern/statemachine/traficlight.json';
import nnTutorialExample from '../../../templates/pattern/nn/tutorial_example.json';
import nnAlexnet from '../../../templates/pattern/nn/alexnet_nn.json';
import nnLstm from '../../../templates/pattern/nn/lstm_nn.json';
import bpmnCarWash from '../../../templates/pattern/bpmn/car_wash.json';
import bpmnParallelReview from '../../../templates/pattern/bpmn/parallel_review.json';
import bpmnPizzaStore from '../../../templates/pattern/bpmn/pizza_store.json';
import libraryFullStackProject from '../../../templates/pattern/project/library_full_stack.json';
import personalizedGymAgentProject from '../../../templates/pattern/project/personalized_gym_agent.json';
import { EXAMPLE_CIRCUITS } from '../../editors/quantum/exampleCircuits';
import { serializeCircuit } from '../../editors/quantum/utils';

// Helper function to convert example circuit to QuantumCircuitData format
const getQuantumCircuitData = (circuitName: string) => {
  const example = EXAMPLE_CIRCUITS.find((c) => c.name === circuitName);
  if (!example) {
    // Return empty circuit as fallback
    return { cols: [], gates: [], gateMetadata: {}, version: '1.0.0' };
  }
  const serialized = serializeCircuit(example.circuit);
  return { ...serialized, version: '1.0.0' };
};
/**
 * Safety net applied to every UML template on instantiation: the bundled JSON
 * is lifted to canonical v4 exactly as the editor would on load (v3 → v4
 * migration, then `normalizeV4Model`), so a template that is instantiated but
 * never opened (e.g. generated or deployed straight away) reaches the backend
 * in its final shape. Works on a deep copy — the imported JSON module is
 * shared and must never be mutated. A template that cannot be lifted is
 * returned as a copy, unchanged.
 */
export const canonicalizeTemplateModel = <T>(model: T): T => {
  if (!model || typeof model !== 'object') return model;
  const copy = structuredClone(model) as unknown;
  try {
    if (isV4Format(copy)) return normalizeV4Model(copy) as T;
    if (isV3UMLModel(copy)) return migrateUMLModelV3ToV4(copy) as T;
  } catch (error) {
    console.warn('[TemplateFactory] Could not canonicalize template model; using it as-is.', error);
  }
  return copy as T;
};

// Could also be a static method on Template, which would be nicer.
// However, because of circular dependency we decided to create a separate factory instead
export class TemplateFactory {
  static createSoftwarePattern(softwarePatternType: SoftwarePatternType): SoftwarePatternTemplate {
    const template = TemplateFactory.buildSoftwarePattern(softwarePatternType);
    if (template.isUMLDiagram) {
      template.diagram = canonicalizeTemplateModel(template.diagram);
    }
    return template;
  }

  private static buildSoftwarePattern(softwarePatternType: SoftwarePatternType): SoftwarePatternTemplate {
    switch (softwarePatternType) {
      case SoftwarePatternType.LIBRARY:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          libraryCompleteModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.LIBRARY_OCL:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          libraryOclModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.TEAMOCL:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          teamOclModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.DPP:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          dppModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.AISANDBOX:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          aiSandboxModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.NEXACRM:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          nexaCrmModel as any,
          SoftwarePatternCategory.STRUCTURAL,
        );
      case SoftwarePatternType.GREET_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          greetingagent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.DB_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          dbagent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.GYM_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          gymagent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.FAQ_RAG_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          faqRagAgent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.CHATBOT_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          chatbotAgent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.LIBRARY_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          libraryAgent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.TRAFIC_LIGHT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.StateMachineDiagram,
          traficlightModel as any,
          SoftwarePatternCategory.STATE_MACHINE,
        );
      case SoftwarePatternType.NN_TUTORIAL_EXAMPLE:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.NNDiagram,
          nnTutorialExample as any,
          SoftwarePatternCategory.NN,
        );
      case SoftwarePatternType.NN_ALEXNET:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.NNDiagram,
          nnAlexnet as any,
          SoftwarePatternCategory.NN,
        );
      case SoftwarePatternType.NN_LSTM:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.NNDiagram,
          nnLstm as any,
          SoftwarePatternCategory.NN,
        );
      // BPMN templates
      case SoftwarePatternType.BPMN_CAR_WASH:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.BPMN,
          bpmnCarWash as any,
          SoftwarePatternCategory.BPMN,
        );
      case SoftwarePatternType.BPMN_PARALLEL_REVIEW:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.BPMN,
          bpmnParallelReview as any,
          SoftwarePatternCategory.BPMN,
        );
      case SoftwarePatternType.BPMN_PIZZA_STORE:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.BPMN,
          bpmnPizzaStore as any,
          SoftwarePatternCategory.BPMN,
        );
      // Quantum Circuit templates
      case SoftwarePatternType.QUANTUM_EMPTY:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Empty Circuit'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false, // Not a UML diagram
        );
      case SoftwarePatternType.QUANTUM_SINGLE_GATES:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Single Qubit Gates'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_SUPERPOSITION:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Superposition'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_BELL_STATE:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Bell State (|Φ+⟩)'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_GHZ_STATE:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('GHZ State (3 qubits)'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_TELEPORTATION:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Quantum Teleportation'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_GROVER:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Grover Search (2 qubit)'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      case SoftwarePatternType.QUANTUM_QFT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          'QuantumCircuitDiagram',
          getQuantumCircuitData('Quantum Fourier Transform (3 qubit)'),
          SoftwarePatternCategory.QUANTUM_CIRCUIT,
          false,
        );
      // Full-project templates: ``diagram`` carries the entire V2 export envelope
      // (``{ project, exportedAt, version }``); the dialog routes these through
      // the JSON import flow to materialize a brand-new project.
      case SoftwarePatternType.LIBRARY_FULL_STACK:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          FULL_PROJECT_DIAGRAM_TYPE,
          libraryFullStackProject as object,
          SoftwarePatternCategory.FULL_PROJECT,
          false,
        );
      case SoftwarePatternType.PERSONALIZED_GYM_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          FULL_PROJECT_DIAGRAM_TYPE,
          personalizedGymAgentProject as object,
          SoftwarePatternCategory.FULL_PROJECT,
          false,
        );
      default:
        throw Error(`Cannot create SoftwarePatternTemplate for type ${softwarePatternType}`);
    }
  }
}
