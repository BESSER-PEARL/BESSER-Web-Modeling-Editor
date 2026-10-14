import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { TemplateLibraryDialog } from '../TemplateLibraryDialog';
import { TemplateFactory } from '../create-diagram-from-template-modal/template-factory';
import {
  FULL_PROJECT_DIAGRAM_TYPE,
  SoftwarePatternCategory,
  SoftwarePatternType,
} from '../create-diagram-from-template-modal/software-pattern/software-pattern-types';
import { workspaceReducer } from '../../../app/store/workspaceSlice';
import { importProjectFromJson } from '../../../shared/services/project-import/projectImport';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { BesserProject } from '../../../shared/types/project';
import bundle from '../../../templates/pattern/multi-agent/bug_fixing.json';

vi.mock('../../assistant/hooks/useModelInjection', () => ({ centerEditorViewport: vi.fn() }));

const project = bundle.project as unknown as BesserProject;
const templateFile = () => new File([JSON.stringify(bundle)], 'bug_fixing.json', { type: 'application/json' });
const credentialKey = /api[_-]?key|password|secret|(?:^|[_-])token$/i;
const credentialPlaceholders = [
  'YOUR-API-KEY', 'YOUR-TOKEN', 'YOUR-BOT-TOKEN',
  'YOUR-PERSONAL-TOKEN', 'YOUR-WEBHOOK-TOKEN', 'YOUR-DB-PASSWORD',
];

function checkCredentials(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(checkCredentials);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (credentialKey.test(key) && typeof item === 'string') expect(credentialPlaceholders).toContain(item);
      if ((key === 'configYaml' || key === 'agentConfigCustomYaml') && typeof item === 'string') {
        for (const line of item.split('\n')) {
          const field = line.match(/^\s*([\w-]+):\s*(.*)$/);
          if (field && credentialKey.test(field[1])) {
            expect(credentialPlaceholders).toContain(field[2].trim().replace(/^['"]|['"]$/g, ''));
          }
        }
      }
      checkCredentials(item);
    }
  }
}

describe('Multi-agent Bug Fixing template', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('registers the full project in the Multi-agent category', () => {
    const template = TemplateFactory.createSoftwarePattern(SoftwarePatternType.MULTI_AGENT_BUG_FIXING);
    expect(template.softwarePatternCategory).toBe(SoftwarePatternCategory.MULTI_AGENT);
    expect(template.diagramType).toBe(FULL_PROJECT_DIAGRAM_TYPE);
    expect(template.diagram).toBe(bundle);
    expect(project.diagrams.AgentDiagram).toHaveLength(2);
    for (const type of ['BPMN', 'ComponentDiagram', 'DeploymentDiagram'] as const) {
      expect(project.diagrams[type]).toHaveLength(1);
    }
    checkCredentials(bundle);
  });

  it('imports independent projects without losing bindings or transition priority', async () => {
    const first = await importProjectFromJson(templateFile());
    const second = await importProjectFromJson(templateFile());
    expect(first.id).not.toBe(project.id);
    expect(second.id).not.toBe(first.id);
    expect(first.currentDiagramType).toBe('BPMN');
    expect(ProjectStorageRepository.loadProject(first.id)?.name).toBe('Multi-agent Bug Fixing');
    expect(ProjectStorageRepository.loadProject(first.id)?.settings.perspectives).toEqual(project.settings.perspectives);

    for (const type of ['BPMN', 'AgentDiagram', 'ComponentDiagram', 'DeploymentDiagram'] as const) {
      expect(first.diagrams[type]).toEqual(project.diagrams[type]);
    }
    expect(first.elementLineage).toEqual(project.elementLineage);

    const coder = first.diagrams.AgentDiagram.find((diagram) => diagram.title === 'AgentCoder')!;
    const reviewer = first.diagrams.AgentDiagram.find((diagram) => diagram.title === 'AgentReviewer')!;
    const model = reviewer.model as any;
    const names = new Map(model.nodes.map((node: any) => [node.id, node.data.name]));
    // Edge order is transition priority.
    const intake = model.edges.filter((edge: any) => names.get(edge.source) === 'AgentReviewer_greet') as any[];
    expect(intake.map((edge) => names.get(edge.target))).toEqual(['Label_report', 'Address_merge_decision']);
    expect(intake[0].data.custom).toEqual({ event: 'ReceiveTextEvent', condition: [] });
    expect(intake[1].data.name).toContain(`ref=${coder.id};flow=gw-merge`);
    expect(reviewer.config?.agentPlatformUseStreamlit).toBe(true);
    expect(coder.config?.agentPlatformUseStreamlit).toBe(false);

    const nodeNamed = (diagram: any, name: string) => diagram.model.nodes.find((node: any) => node.data.name === name);
    expect(nodeNamed(first.diagrams.ComponentDiagram[0], 'AgentReviewer').data.agentModelRef).toBe(reviewer.id);
    expect(nodeNamed(first.diagrams.DeploymentDiagram[0], 'AgentCoder [2]').data.agentModelRef).toBe(coder.id);
  });

  it('shows the new section and loads its entire project from the dialog', async () => {
    const store = configureStore({ reducer: { workspace: workspaceReducer } });
    const onOpenChange = vi.fn();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <TemplateLibraryDialog open onOpenChange={onOpenChange} />
        </MemoryRouter>
      </Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Multi-agent/ }));
    expect(screen.getByText('Multi-agent Bug Fixing')).toBeInTheDocument();
    expect(screen.getByText('BPMN · Agent · Component · Deployment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load Template' }));
    await waitFor(() => expect(store.getState().workspace.project?.name).toBe('Multi-agent Bug Fixing'));
    expect(store.getState().workspace.project?.diagrams.AgentDiagram).toHaveLength(2);
    expect(store.getState().workspace.project?.settings.perspectives).toMatchObject({
      BPMN: true,
      AgentDiagram: true,
      ComponentDiagram: true,
      DeploymentDiagram: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
