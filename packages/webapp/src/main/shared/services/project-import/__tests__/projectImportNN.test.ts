/**
 * Wave-3 sweep (A4): the two `allTypes` enumerations in
 * `projectImport.ts` omitted `'NNDiagram'`, so a bare NN diagram JSON
 * imported as a project was silently dropped (raw path) and old-webapp
 * envelopes carrying an NN diagram lost it (migration path).
 */
import { importProjectFromJson } from '../projectImport';

// Mock react-toastify (imported transitively by ProjectStorageRepository's
// quota check and directly by projectImport's v3-migration notice).
const toastInfo = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: (...args: any[]) => toastInfo(...args),
  },
}));

const jsonFile = (payload: Record<string, unknown>): File =>
  new File([JSON.stringify(payload)], 'import.json', { type: 'application/json' });

/** Minimal v4 NN diagram model with one container node. */
const v4NNModel = (): Record<string, any> => ({
  version: '4.0.0',
  type: 'NNDiagram',
  size: { width: 400, height: 300 },
  nodes: [
    {
      id: 'nn-container-1',
      type: 'NNContainer',
      position: { x: 0, y: 0 },
      width: 300,
      height: 200,
      measured: { width: 300, height: 200 },
      data: { name: 'my_nn' },
    },
  ],
  edges: [],
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

describe('projectImport NNDiagram coverage (sweep A4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('imports a bare v4 NN diagram JSON into diagrams.NNDiagram[0] (raw path)', async () => {
    const bare = {
      id: 'nn-diagram-1',
      title: 'My NN',
      model: v4NNModel(),
      lastUpdate: new Date().toISOString(),
    };

    const project = await importProjectFromJson(jsonFile(bare));

    expect(project.currentDiagramType).toBe('NNDiagram');
    expect(Array.isArray(project.diagrams.NNDiagram)).toBe(true);
    expect(project.diagrams.NNDiagram).toHaveLength(1);
    const entry: any = project.diagrams.NNDiagram[0];
    expect(entry.title).toBe('My NN');
    expect(entry.model.type).toBe('NNDiagram');
    expect(entry.model.nodes).toHaveLength(1);
    expect(project.currentDiagramIndices.NNDiagram).toBe(0);
  });

  it('keeps an NN diagram when migrating an old-webapp-format project', async () => {
    const oldFormat = {
      project: {
        name: 'Old Project',
        description: '',
        owner: '',
        diagrams: {
          // Old webapp format: plain single-diagram objects, not arrays.
          NNDiagram: {
            id: 'nn-old-1',
            title: 'Old NN',
            model: v4NNModel(),
            lastUpdate: new Date().toISOString(),
          },
        },
      },
    };

    const project = await importProjectFromJson(jsonFile(oldFormat));

    expect(Array.isArray(project.diagrams.NNDiagram)).toBe(true);
    expect(project.diagrams.NNDiagram).toHaveLength(1);
    const entry: any = project.diagrams.NNDiagram[0];
    expect(entry.title).toBe('Old NN');
    expect(entry.model.nodes).toHaveLength(1);
  });
});
