import { describe, it, expect } from 'vitest';
import { DEFAULT_DIAGRAM_TITLES, nextDiagramTitle } from '../diagramTitles';
import { ALL_DIAGRAM_TYPES, createDefaultProject } from '../../types/project';

describe('nextDiagramTitle', () => {
  it('matches the first-diagram titles of a default project', () => {
    const project = createDefaultProject('P', '', '');
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(DEFAULT_DIAGRAM_TITLES[type]).toBe(project.diagrams[type][0].title);
    }
  });

  it('numbers from the default title', () => {
    expect(nextDiagramTitle('ClassDiagram', ['Class Diagram'])).toBe('Class Diagram 2');
    expect(nextDiagramTitle('StateMachineDiagram', ['State Machine Diagram'])).toBe('State Machine Diagram 2');
    expect(nextDiagramTitle('QuantumCircuitDiagram', ['Quantum Circuit'])).toBe('Quantum Circuit 2');
    expect(nextDiagramTitle('ClassDiagram', ['Class Diagram', 'Class Diagram 2'])).toBe('Class Diagram 3');
  });

  it('bumps past a taken number (case-insensitive)', () => {
    expect(nextDiagramTitle('ClassDiagram', ['Class Diagram', 'class diagram 2 '])).toBe('Class Diagram 3');
    expect(nextDiagramTitle('ClassDiagram', ['Orders', 'Class Diagram 2', 'Class Diagram 3'])).toBe('Class Diagram 4');
  });

  it('uses the bare default title for an empty type', () => {
    expect(nextDiagramTitle('ObjectDiagram', [])).toBe('Object Diagram');
  });
});
