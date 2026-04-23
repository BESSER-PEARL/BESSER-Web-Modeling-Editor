import {
  SoftwarePatternCategory,
  SoftwarePatternTemplate,
  SoftwarePatternType,
} from './software-pattern/software-pattern-types';
import { UMLDiagramType } from '@besser/wme';
import libraryCompleteModel from '../../../templates/pattern/structural/Library_Complete.json';
import teamOclModel from '../../../templates/pattern/structural/team_player_ocl.json';
import dppModel from '../../../templates/pattern/structural/dpp.json';
import aiSandboxModel from '../../../templates/pattern/structural/ai_sandbox.json';
import nexaCrmModel from '../../../templates/pattern/structural/nexacrm.json';
import greetingagent from '../../../templates/pattern/agent/greetingagent.json';
import dbagent from '../../../templates/pattern/agent/dbagent.json';
import gymagent from '../../../templates/pattern/agent/gymagent.json';
import faqRagAgent from '../../../templates/pattern/agent/faqragagent.json';
import libraryAgent from '../../../templates/pattern/agent/libraryagent.json';
import traficlightModel from '../../../templates/pattern/statemachine/traficlight.json';
import nnTutorialExample from '../../../templates/pattern/nn/tutorial_example.json';
import { EXAMPLE_CIRCUITS } from '../../editors/quantum/exampleCircuits';
import { serializeCircuit } from '../../editors/quantum/utils';

// Helper function to convert example circuit to QuantumCircuitData format
const getQuantumCircuitData = (circuitName: string) => {
  const example = EXAMPLE_CIRCUITS.find(c => c.name === circuitName);
  if (!example) {
    // Return empty circuit as fallback
    return { cols: [], gates: [], gateMetadata: {}, version: '1.0.0' };
  }
  const serialized = serializeCircuit(example.circuit);
  return { ...serialized, version: '1.0.0' };
};
// Could also be a static method on Template, which would be nicer.
// However, because of circular dependency we decided to create a separate factory instead
export class TemplateFactory {
  static createSoftwarePattern(softwarePatternType: SoftwarePatternType): SoftwarePatternTemplate {
    switch (softwarePatternType) {
      case SoftwarePatternType.LIBRARY:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          libraryCompleteModel as any,
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
      default:
        throw Error(`Cannot create SoftwarePatternTemplate for type ${softwarePatternType}`);
    }
  }
}
