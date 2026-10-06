import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentOptions, getClassOptions, getEndsByClassId, getInheritedEndsByClassId } from '../diagram-helpers';
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

  /**
   * Build a v4 ClassDiagram (`{nodes, edges}`) from compact v3-style element /
   * relationship maps: classes become `class` nodes (name on `data.name`), end
   * roles / `navigable` flags move to `edge.data.{source,target}{Role,Navigable}`
   * (docs/source/migrations/uml-v4-shape.md).
   */
  function v4ClassModel(elements: Record<string, any>, relationships: Record<string, any>) {
    return {
      version: '4.0.0',
      type: 'ClassDiagram',
      nodes: Object.values(elements).map((e: any) => ({
        id: e.id,
        type: e.type === 'Class' ? 'class' : e.type,
        position: { x: 0, y: 0 },
        width: 160,
        height: 100,
        data: e.type === 'Class'
          ? { name: e.name, attributes: [], methods: [] }
          : { name: e.name, constraint: e.constraint },
      })),
      edges: Object.values(relationships).map((r: any) => {
        const data: Record<string, unknown> = { points: [] };
        if (r.source?.role !== undefined) data.sourceRole = r.source.role;
        if (r.target?.role !== undefined) data.targetRole = r.target.role;
        if (typeof r.source?.navigable === 'boolean') data.sourceNavigable = r.source.navigable;
        if (typeof r.target?.navigable === 'boolean') data.targetNavigable = r.target.navigable;
        return {
          id: r.id,
          type: r.type,
          source: r.source.element,
          target: r.target.element,
          sourceHandle: 'Right',
          targetHandle: 'Left',
          data,
        };
      }),
    };
  }

  // Mirrors the hotel-booking benchmark model: Guest and Employee inherit from
  // Person; Person has a real association to Booking, an OCL constraint attached
  // via ClassOCLLink, and a non-association ClassLinkRel.
  function setHotelLikeProject() {
    const model = v4ClassModel(
      {
        person: { id: 'person', type: 'Class', name: 'Person' },
        guest: { id: 'guest', type: 'Class', name: 'Guest' },
        employee: { id: 'employee', type: 'Class', name: 'Employee' },
        booking: { id: 'booking', type: 'Class', name: 'Booking' },
        admin: { id: 'admin', type: 'Class', name: 'Admin' },
        ocl1: { id: 'ocl1', type: 'ClassOCLConstraint', name: '', constraint: 'context Person inv: self.age >= 0' },
      },
      {
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
    );
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

  // Per-end navigability: the `navigable` flags on each end decide the ends,
  // not the relationship type.
  function setNavigabilityProject() {
    const model = v4ClassModel(
      {
        order: { id: 'order', type: 'Class', name: 'Order' },
        customer: { id: 'customer', type: 'Class', name: 'Customer' },
        line: { id: 'line', type: 'Class', name: 'OrderLine' },
        product: { id: 'product', type: 'Class', name: 'Product' },
      },
      {
        // Only the target (Customer) end is navigable: Order -> Customer.
        oneWay: {
          id: 'oneWay',
          type: 'ClassBidirectional',
          source: { element: 'order', role: 'orders', navigable: false },
          target: { element: 'customer', role: 'customer', navigable: true },
        },
        // Only the source end is navigable: Product -> OrderLine, drawn the other way round.
        reversed: {
          id: 'reversed',
          type: 'ClassBidirectional',
          source: { element: 'line', role: 'lines', navigable: true },
          target: { element: 'product', role: 'product', navigable: false },
        },
        // Composition whose whole (target, Order) end is not navigable.
        parts: {
          id: 'parts',
          type: 'ClassComposition',
          source: { element: 'line', role: 'items', navigable: true },
          target: { element: 'order', role: 'order', navigable: false },
        },
      },
    );
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.ClassDiagram = [
      { id: 'cd1', title: 'Classes', model: model as any, lastUpdate: new Date().toISOString() },
    ];
    setCurrentProject(project);
  }

  it('follows explicit navigable flags on a ClassBidirectional association', () => {
    setNavigabilityProject();
    expect(getEndsByClassId('order', false)).toEqual([
      { value: 'customer', label: 'customer' },
      { value: 'line', label: 'items' },
    ]);
    // Customer cannot navigate back to Order.
    expect(getEndsByClassId('customer', false)).toEqual([]);
  });

  it('navigates from the target class when only the source end is navigable', () => {
    setNavigabilityProject();
    expect(getEndsByClassId('product', false)).toEqual([{ value: 'line', label: 'lines' }]);
    // OrderLine reaches neither Product nor the non-navigable whole end of the composition.
    expect(getEndsByClassId('line', false)).toEqual([]);
  });
});

// The library writes ClassType casing ('Abstract'); an exact lowercase compare
// dropped every editor-authored abstract class from the GUI binding pickers.
describe('getClassOptions', () => {
  beforeEach(() => {
    localStorage.clear();
    ProjectStorageRepository.revision = 0;
    (ProjectStorageRepository as any).changeListeners = [];
    (ProjectStorageRepository as any).suppressDepth = 0;
  });

  it('lists plain and abstract classes (any casing) but not interfaces or enumerations', () => {
    const project = createDefaultProject('Test', '', 'user');
    const node = (id: string, stereotype?: string) => ({
      id,
      type: 'class',
      position: { x: 0, y: 0 },
      data: { name: id, attributes: [], methods: [], ...(stereotype && { stereotype }) },
    });
    project.diagrams.ClassDiagram[0].model = {
      version: '4.0.0',
      id: 'cd',
      title: 'cd',
      type: 'ClassDiagram',
      nodes: [
        node('Plain'),
        node('Shape', 'Abstract'),
        node('Legacy', 'abstract'),
        node('Named', 'Interface'),
        node('Color', 'Enumeration'),
      ],
      edges: [],
    } as any;
    setCurrentProject(project);

    expect(getClassOptions().map((o) => o.label)).toEqual(['Plain', 'Shape', 'Legacy']);
  });
});
