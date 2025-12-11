import {
  SoftwarePatternCategory,
  SoftwarePatternTemplate,
  SoftwarePatternType,
} from './software-pattern/software-pattern-types';
import { UMLDiagramType } from '@besser/wme';
import libraryModel from '../../../templates/pattern/structural/Library.json';
import teamOclModel from '../../../templates/pattern/structural/team_player_ocl.json';
import dppModel from '../../../templates/pattern/structural/dpp.json';
import aiSandboxModel from '../../../templates/pattern/structural/ai_sandbox.json';
import commandModel from '../../../templates/pattern/behavioral/command.json';
import factoryModel from '../../../templates/pattern/creational/factory.json';
import observerModel from '../../../templates/pattern/behavioral/observer.json';
import greetingagent from '../../../templates/pattern/agent/greetingagent.json';
import traficlightModel from '../../../templates/pattern/statemachine/traficlight.json';
// Could also be a static method on Template, which would be nicer.
// However, because of circular dependency we decided to create a separate factory instead
export class TemplateFactory {
  static createSoftwarePattern(softwarePatternType: SoftwarePatternType): SoftwarePatternTemplate {
    switch (softwarePatternType) {
      case SoftwarePatternType.LIBRARY:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          libraryModel as any,
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
      case SoftwarePatternType.COMMAND:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          commandModel as any,
          SoftwarePatternCategory.BEHAVIORAL,
        );
      case SoftwarePatternType.FACTORY:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          factoryModel as any,
          SoftwarePatternCategory.CREATIONAL,
        );
      case SoftwarePatternType.OBSERVER:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.ClassDiagram,
          observerModel as any,
          SoftwarePatternCategory.BEHAVIORAL,
        );
        case SoftwarePatternType.GREET_AGENT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.AgentDiagram,
          greetingagent as any,
          SoftwarePatternCategory.AGENT,
        );
      case SoftwarePatternType.TRAFIC_LIGHT:
        return new SoftwarePatternTemplate(
          softwarePatternType,
          UMLDiagramType.StateMachineDiagram,
          traficlightModel as any,
          SoftwarePatternCategory.STATE_MACHINE,
        );
      default:
        throw Error(`Cannot create SoftwarePatternTemplate for type ${softwarePatternType}`);
    }
  }
}
