import { describe, expect, it } from 'vitest';
import { PERSPECTIVES, isAgenticModeEnabled, perspectivesFromDiagramList } from '../perspectives';
import { ALL_DIAGRAM_TYPES } from '../types/project';

const preset = (key: string) => PERSPECTIVES.find((p) => p.key === key)!.diagrams;

describe('isAgenticModeEnabled', () => {
  it('is on with the Multi-Agent and Show All presets', () => {
    expect(isAgenticModeEnabled(perspectivesFromDiagramList(preset('agenticSwarm')))).toBe(true);
    expect(isAgenticModeEnabled(perspectivesFromDiagramList([...ALL_DIAGRAM_TYPES]))).toBe(true);
  });

  it('is off as soon as one Multi-Agent diagram type is hidden', () => {
    expect(isAgenticModeEnabled(perspectivesFromDiagramList(['BPMN', 'AgentDiagram', 'ComponentDiagram']))).toBe(
      false,
    );
    expect(isAgenticModeEnabled(perspectivesFromDiagramList(preset('data')))).toBe(false);
  });
});
