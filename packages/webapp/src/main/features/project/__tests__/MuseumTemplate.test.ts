import { beforeEach, describe, expect, it } from 'vitest';
import { TemplateFactory } from '../create-diagram-from-template-modal/template-factory';
import {
  FULL_PROJECT_DIAGRAM_TYPE,
  SoftwarePatternCategory,
  SoftwarePatternType,
} from '../create-diagram-from-template-modal/software-pattern/software-pattern-types';
import { importProjectFromJson } from '../../../shared/services/project-import/projectImport';
import bundle from '../../../templates/pattern/project/museum_agent_gui.json';

describe('Museum Agent and GUI template', () => {
  beforeEach(() => localStorage.clear());

  it('registers and imports a project containing its agent, GUI, and class diagram', async () => {
    const template = TemplateFactory.createSoftwarePattern(SoftwarePatternType.MUSEUM_AGENT_GUI);
    expect(template.diagramType).toBe(FULL_PROJECT_DIAGRAM_TYPE);
    expect(template.softwarePatternCategory).toBe(SoftwarePatternCategory.FULL_PROJECT);
    expect(template.diagram).toBe(bundle);

    const file = new File([JSON.stringify(bundle)], 'museum_agent_gui.json', { type: 'application/json' });
    const project = await importProjectFromJson(file);
    expect(project.name).toBe('Museum Agent and GUI');
    expect(project.diagrams.AgentDiagram).toHaveLength(1);
    expect(project.diagrams.GUINoCodeDiagram).toHaveLength(1);
    expect(project.diagrams.ClassDiagram).toHaveLength(1);
    expect(project.diagrams.AgentDiagram[0]).toEqual(bundle.project.diagrams.AgentDiagram[0]);
    expect(project.diagrams.GUINoCodeDiagram[0]).toEqual(bundle.project.diagrams.GUINoCodeDiagram[0]);
  });
});
