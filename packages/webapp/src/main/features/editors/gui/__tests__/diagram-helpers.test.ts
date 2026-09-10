import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentOptions, getEndsByClassId, getInheritedEndsByClassId } from '../diagram-helpers';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { BesserProject, createDefaultProject, ProjectDiagram } from '../../../../shared/types/project';

// react-toastify is pulled in transitively via localStorageQuota; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

function makeAgentDiagram(id: string, title: string): ProjectDiagram {
  return {
    id,
    title,
    model: { version: '4.0.0', id, title, type: 'AgentDiagram', nodes: [], edges: [] } as any,
    lastUpdate: new Date().toISOString(),
  };
}

function setCurrentProject(project: BesserProject) {
  // saveProject() also writes localStorageLatestProject so getCurrentProject() resolves.
  ProjectStorageRepository.saveProject(project);
}

describe('getAgentOptions', () => {
  beforeEach(() => {
    localStorage.clear();
    ProjectStorageRepository.revision = 0;
    (ProjectStorageRepository as any).changeListeners = [];
    (ProjectStorageRepository as any).suppressDepth = 0;
  });

  it('returns an empty list when no project is loaded', () => {
    expect(getAgentOptions()).toEqual([]);
  });

  it('returns an empty list when the project has no agent diagrams', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [];
    setCurrentProject(project);
    expect(getAgentOptions()).toEqual([]);
  });

  it('returns a single entry when the project has one agent diagram', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [makeAgentDiagram('a1', 'Alpha')];
    setCurrentProject(project);

    expect(getAgentOptions()).toEqual([{ value: 'Alpha', label: 'Alpha' }]);
  });

  it('returns every agent diagram for multi-agent projects', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [
      makeAgentDiagram('a1', 'Alpha'),
      makeAgentDiagram('a2', 'Beta'),
      makeAgentDiagram('a3', 'Gamma'),
    ];
    setCurrentProject(project);

    expect(getAgentOptions()).toEqual([
      { value: 'Alpha', label: 'Alpha' },
      { value: 'Beta', label: 'Beta' },
      { value: 'Gamma', label: 'Gamma' },
    ]);
  });

  it('filters out agent diagrams missing a title', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [
      makeAgentDiagram('a1', 'Alpha'),
      { ...makeAgentDiagram('a2', ''), title: '' },
    ];
    setCurrentProject(project);

    const options = getAgentOptions();
    expect(options).toEqual([{ value: 'Alpha', label: 'Alpha' }]);
  });
});

describe('getEndsByClassId / getInheritedEndsByClassId', () => {
  beforeEach(() => {
    localStorage.clear();
    ProjectStorageRepository.revision = 0;
    (ProjectStorageRepository as any).changeListeners = [];
    (ProjectStorageRepository as any).suppressDepth = 0;
  });

  // Mirrors the hotel-booking benchmark model: Guest and Employee inherit from
  // Person; Person has a real association to Booking, an OCL constraint attached
  // via ClassOCLLink, and a non-association ClassLinkRel.
  function setHotelLikeProject() {
    const model = {
      version: '3.0.0',
      type: 'ClassDiagram',
      elements: {
        person: { id: 'person', type: 'Class', name: 'Person' },
        guest: { id: 'guest', type: 'Class', name: 'Guest' },
        employee: { id: 'employee', type: 'Class', name: 'Employee' },
        booking: { id: 'booking', type: 'Class', name: 'Booking' },
        admin: { id: 'admin', type: 'Class', name: 'Admin' },
        ocl1: { id: 'ocl1', type: 'ClassOCLConstraint', name: '', constraint: 'context Person inv: self.age >= 0' },
      },
      relationships: {
        inh1: { id: 'inh1', type: 'ClassInheritance', source: { element: 'guest' }, target: { element: 'person' } },
        inh2: { id: 'inh2', type: 'ClassInheritance', source: { element: 'employee' }, target: { element: 'person' } },
        assoc1: {
          id: 'assoc1',
          type: 'ClassBidirectional',
          source: { element: 'person', role: 'holder' },
          target: { element: 'booking', role: 'bookings' },
        },
        oclLink: { id: 'oclLink', type: 'ClassOCLLink', source: { element: 'ocl1' }, target: { element: 'person' } },
        linkRel: { id: 'linkRel', type: 'ClassLinkRel', source: { element: 'person' }, target: { element: 'admin' } },
        uni1: {
          id: 'uni1',
          type: 'ClassUnidirectional',
          source: { element: 'admin', role: '' },
          target: { element: 'person', role: 'managedPersons' },
        },
      },
    };
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.ClassDiagram = [
      { id: 'cd1', title: 'Classes', model: model as any, lastUpdate: new Date().toISOString() },
    ];
    setCurrentProject(project);
  }

  it('returns direct association ends without OCL constraints', () => {
    setHotelLikeProject();
    const ends = getEndsByClassId('person', false);
    expect(ends).toEqual([{ value: 'booking', label: 'bookings' }]);
  });

  it('does not leak OCL links attached to a parent class into children (hotel-booking bug)', () => {
    setHotelLikeProject();
    const inherited = getInheritedEndsByClassId('guest');
    expect(inherited.map((e) => e.value)).not.toContain('ocl1');
    expect(inherited).toEqual([{ value: 'booking', label: 'bookings' }]);
  });

  it('does not leak non-association relationships of a parent into children', () => {
    setHotelLikeProject();
    const ends = getEndsByClassId('employee');
    // ClassLinkRel and the incoming ClassUnidirectional (not navigable from
    // target) must not surface; only the inherited Booking association does.
    expect(ends).toEqual([{ value: 'booking', label: 'bookings' }]);
  });

  it('keeps unidirectional navigability when the class is the source', () => {
    setHotelLikeProject();
    const ends = getEndsByClassId('admin', false);
    expect(ends).toEqual([{ value: 'person', label: 'managedPersons' }]);
  });
});
