import { describe, expect, it } from 'vitest';
import {
  diffDiagramModel,
  elementsMatchedByName,
  isTraceableType,
  snapshotApollonModel,
  snapshotDiagramModel,
  snapshotKnowledgeGraph,
  snapshotQuantumModel,
} from '../diagramModelDiff';
import { diffSnapshots } from '../modelDiff';
import type { Snapshot } from '../modelDiff';
import type { ApollonModelLike } from '../diagramModelDiff';

const el = (id: string, type: string, name = '', extra: Record<string, unknown> = {}) => ({
  id, type, name, owner: null as string | null, bounds: { x: 0, y: 0, width: 10, height: 10 }, ...extra,
});
const rel = (id: string, type: string, source: string, target: string, extra: Record<string, unknown> = {}) => ({
  id, type, name: '', source: { element: source, direction: 'Up' }, target: { element: target, direction: 'Down' },
  path: [{ x: 0, y: 0 }], bounds: { x: 0, y: 0, width: 0, height: 0 }, ...extra,
});
type Row = { id: string } & Record<string, unknown>;
const model = (elements: Row[], relationships: Row[] = []): ApollonModelLike => ({
  elements: Object.fromEntries(elements.map((e) => [e.id, e])),
  relationships: Object.fromEntries(relationships.map((r) => [r.id, r])),
}) as ApollonModelLike;
const summary = (snapshots: Map<string, Snapshot>) =>
  [...snapshots].map(([id, s]) => [id, s.elementType, s.name, s.parentElementId]);

describe('the generic Apollon snapshot', () => {
  it('names object-diagram elements by their B-UML metaclass and files attributes under their object', () => {
    const objects = model(
      [el('o1', 'ObjectName', 'b : Book'), el('a1', 'ObjectAttribute', 'title = "Dune"', { owner: 'o1' }), el('i1', 'ObjectIcon', '', { owner: 'o1' })],
      [rel('l1', 'ObjectLink', 'o1', 'o1')],
    );
    expect(summary(snapshotApollonModel('ObjectDiagram', objects))).toEqual([
      ['o1', 'Object', 'b : Book', null],
      ['a1', 'AttributeLink', 'title = "Dune"', 'o1'],
      // The icon is layout: not traced.
      ['l1', 'Link', 'b : Book → b : Book', null],
    ]);
  });

  it('ignores layout: moving or recolouring an element is no change', () => {
    const before = model([el('s1', 'State', 'Idle')], [rel('t1', 'StateTransition', 's1', 's1')]);
    const after = model(
      [{ ...el('s1', 'State', 'Idle'), bounds: { x: 50, y: 50, width: 99, height: 9 }, fillColor: '#f00' }],
      [{ ...rel('t1', 'StateTransition', 's1', 's1'), path: [{ x: 5, y: 5 }], isManuallyLayouted: true }],
    );
    expect(diffDiagramModel('StateMachineDiagram', before, after, 'sm')).toEqual([]);
  });

  it('records no change when the editor marks a loaded template’s NN edge ends navigable', () => {
    // Live: AlexNet template, then 28 "source/target.navigable '' → true" edits by the user a second later.
    const layers = [el('l1', 'Conv2DLayer', 'conv1'), el('l2', 'Conv2DLayer', 'conv2')];
    const template = model(layers, [rel('e1', 'NNNext', 'l1', 'l2')]);
    const loaded = model(layers, [{ ...rel('e1', 'NNNext', 'l1', 'l2'), source: { element: 'l1', direction: 'Up', navigable: true }, target: { element: 'l2', direction: 'Down', navigable: true } }]);
    expect(diffDiagramModel('NNDiagram', template, loaded, 'nn')).toEqual([]);
    // Turning an end off is still recorded.
    const off = model(layers, [{ ...rel('e1', 'NNNext', 'l1', 'l2'), target: { element: 'l2', direction: 'Down', navigable: false } }]);
    expect(diffDiagramModel('NNDiagram', loaded, off, 'nn').map((c) => c.feature)).toEqual(['target.navigable']);
  });

  it('records a state machine edit as a change of the state and its transition', () => {
    const before = model([el('s1', 'State', 'Idle'), el('s2', 'State', 'Busy')], [rel('t1', 'StateTransition', 's1', 's2')]);
    const after = model(
      [el('s1', 'State', 'Waiting'), el('s2', 'State', 'Busy'), el('b1', 'StateBody', 'print()', { owner: 's2' })],
      [rel('t1', 'StateTransition', 's1', 's2', { name: 'go' })],
    );
    const changes = diffDiagramModel('StateMachineDiagram', before, after, 'sm');
    // A state's body names a code block: it is part of the state (the backend builds no element for it).
    expect(changes.map((c) => [c.kind, c.elementType, c.elementId, c.feature ?? null, c.newValue ?? null])).toEqual([
      ['UPDATED', 'State', 's1', 'name', 'Waiting'],
      ['UPDATED', 'State', 's2', 'body', 'print()'],
      ['UPDATED', 'Transition', 't1', 'name', 'go'],
    ]);
  });

  it('folds agent intent training sentences into their intent, and reads off-canvas components', () => {
    const agent = {
      ...model([el('i1', 'AgentIntent', 'greet'), el('b2', 'AgentIntentBody', 'hi', { owner: 'i1' }), el('b1', 'AgentIntentBody', 'hello', { owner: 'i1' })]),
      components: { r1: el('r1', 'AgentRagElement', 'docs') },
    } as ApollonModelLike;
    const snapshots = snapshotApollonModel('AgentDiagram', agent);
    expect(snapshots.get('i1')).toMatchObject({ elementType: 'Intent' });
    expect(snapshots.get('i1')!.features.trainingSentences.key).toBe('hello\nhi'); // ordered by id
    expect(snapshots.has('b1')).toBe(false);
    expect(snapshots.get('r1')).toMatchObject({ elementType: 'RAG', name: 'docs' });
  });

  it('folds an NN layer’s attribute elements into features of the layer', () => {
    const nn = model([
      el('L', 'Conv2DLayer', 'conv'),
      el('k', 'KernelDimAttributeConv2D', 'kernel_dim = 3', { owner: 'L', attributeName: 'kernel_dim', value: '3' }),
    ]);
    const before = snapshotApollonModel('NNDiagram', nn);
    expect(before.get('L')).toMatchObject({ elementType: 'Conv2D' });
    const after = model([
      el('L', 'Conv2DLayer', 'conv'),
      el('k', 'KernelDimAttributeConv2D', 'kernel_dim = 5', { owner: 'L', attributeName: 'kernel_dim', value: '5' }),
    ]);
    const changes = diffDiagramModel('NNDiagram', nn, after, 'nn');
    expect(changes).toEqual([expect.objectContaining({ kind: 'UPDATED', elementId: 'L', feature: 'kernel_dim', oldValue: '3', newValue: '5' })]);
  });

  it('types a BPMN flow by its kind, and maps component and deployment elements', () => {
    const bpmn = model([el('t', 'BPMNTask', 'Pay'), el('p', 'BPMNPool', 'Shop')], [rel('f', 'BPMNFlow', 't', 'p', { flowType: 'message' })]);
    expect(summary(snapshotApollonModel('BPMN', bpmn)).map((s) => s[1])).toEqual(['Task', 'Participant', 'MessageFlow']);
    const components = model([el('c', 'Component', 'API'), el('i', 'ComponentInterface', 'REST')], [rel('p', 'ComponentInterfaceProvided', 'c', 'i')]);
    expect(summary(snapshotApollonModel('ComponentDiagram', components)).map((s) => s[1])).toEqual(['Component', 'Interface', 'InterfaceProvided']);
    const deployment = model(
      [el('n', 'DeploymentNode', 'Server'), el('m', 'DeploymentNode', 'DB'), el('a', 'DeploymentArtifact', 'app.jar')],
      [rel('x', 'DeploymentAssociation', 'n', 'm'), rel('y', 'DeploymentAssociation', 'a', 'n')],
    );
    expect(summary(snapshotApollonModel('DeploymentDiagram', deployment)).map((s) => s[1]))
      .toEqual(['Node', 'Node', 'Artifact', 'CommunicationPath', 'DeploymentRelation']);
    const user = model([el('u', 'UserModelName', 'me : User'), el('ua', 'UserModelAttribute', 'age = 3', { owner: 'u' })]);
    expect(summary(snapshotApollonModel('UserDiagram', user)).map((s) => s[1])).toEqual(['Object', 'AttributeLink']);
  });

  it('dispatches by diagram type (a GUI is left to its own recorder)', () => {
    expect(snapshotDiagramModel('GUINoCodeDiagram', { pages: [] }, 'g').size).toBe(0);
    expect(snapshotDiagramModel('ClassDiagram', { elements: { c: { id: 'c', type: 'Class', name: 'Book' } } }, 'cd').get('c'))
      .toMatchObject({ elementType: 'Class' });
  });
});

describe('metaclasses as the backend builds them', () => {
  const types = (diagramType: Parameters<typeof snapshotApollonModel>[0], m: ApollonModelLike) =>
    Object.fromEntries([...snapshotApollonModel(diagramType, m)].map(([id, s]) => [id, s.elementType]));

  it('types an agent’s reasoning state, folds its actions into it, and marks the initial state', () => {
    const agent = model(
      [
        el('init', 'StateInitialNode'), el('s', 'AgentState', 'Greet'), el('r', 'AgentState', 'Think', { stateType: 'reasoning' }),
        el('r2', 'AgentReasoningState', 'Plan'),
        el('b1', 'AgentStateBody', 'Hello', { owner: 's', replyType: 'text' }),
        el('f1', 'AgentStateFallbackBody', 'Sorry', { owner: 's', replyType: 'text' }),
      ],
      [rel('t0', 'AgentStateTransitionInit', 'init', 's'), rel('t1', 'AgentStateTransition', 's', 'r')],
    );
    expect(types('AgentDiagram', agent)).toEqual({ s: 'AgentState', r: 'ReasoningState', r2: 'ReasoningState', t1: 'Transition' });
    const greet = snapshotApollonModel('AgentDiagram', agent).get('s')!;
    expect(greet.features.actions.key).toBe('Hello (replyType=text)');
    expect(greet.features.fallbackActions.key).toBe('Sorry (replyType=text)');
    expect(greet.features.initial.key).toBe('true');
    // Editing an action is a change of its state, which is what code is linked to.
    const edited = model(
      [...Object.values(agent.elements!).filter((e) => e.id !== 'b1') as Row[], el('b1', 'AgentStateBody', 'Hi there', { owner: 's', replyType: 'text' })],
      Object.values(agent.relationships!) as Row[],
    );
    expect(diffDiagramModel('AgentDiagram', agent, edited, 'ag').map((c) => [c.kind, c.elementId, c.feature])).toEqual([['UPDATED', 's', 'actions']]);
  });

  it('marks a state machine’s initial and final states instead of recording the pseudo-states', () => {
    const sm = model(
      [el('i', 'StateInitialNode'), el('a', 'State', 'A'), el('f', 'StateFinalNode'), el('k', 'StateForkNode', 'fork')],
      [rel('t0', 'StateTransition', 'i', 'a'), rel('t1', 'StateTransition', 'a', 'f')],
    );
    const snapshots = snapshotApollonModel('StateMachineDiagram', sm);
    expect(types('StateMachineDiagram', sm)).toEqual({ a: 'State', k: 'ForkNode' });
    expect([snapshots.get('a')!.features.initial.key, snapshots.get('a')!.features.final.key]).toEqual(['true', 'true']);
  });

  it('types agentic BPMN elements and data associations', () => {
    const bpmn = model(
      [el('t', 'BPMNTask', 'Review', { isAgentic: true }), el('g', 'BPMNGateway', 'Decide', { isAgentic: true }),
        el('l', 'BPMNSwimlane', 'Bots', { isAgentic: true }), el('p', 'BPMNTask', 'Pay'), el('d', 'BPMNDataObject', 'Order')],
      [rel('a', 'BPMNFlow', 'd', 'p', { flowType: 'data association' })],
    );
    expect(types('BPMN', bpmn)).toEqual({ t: 'AgenticTask', g: 'AgenticGateway', l: 'AgenticLane', p: 'Task', d: 'DataObject', a: 'DataAssociation' });
  });

  it('types agentic components and edges by their stereotype, as the backend reads it', () => {
    const components = model(
      [el('a', 'Component', 'Planner', { stereotype: '«supervision»' }), el('s', 'Component', 'Search', { stereotype: 'skill' }),
        el('d', 'Component', 'Store', { stereotype: '«db»' }), el('c', 'Component', 'API', { stereotype: '«component»' })],
      [rel('e', 'ComponentDependency', 'a', 's', { stereotype: 'has {permission: repo:read}' }), rel('u', 'ComponentDependency', 'c', 'd', { stereotype: '«use»' })],
    );
    expect(types('ComponentDiagram', components)).toEqual({ a: 'AgenticComponent', s: 'Skill', d: 'Database', c: 'Component', e: 'AgenticEdge', u: 'ComponentDependency' });
  });

  it('knows which metaclasses can never be linked to code', () => {
    for (const untraceable of ['LLMWrapper', 'Qubit', 'Configuration', 'NNReference', 'LayerOrder', 'NNAssociation', 'ForkNode', 'FieldColumn', 'ControlState']) {
      expect(isTraceableType(untraceable)).toBe(false);
    }
    for (const traceable of ['Class', 'AgentState', 'ReasoningState', 'HadamardGate', 'NN', 'Task', 'Association']) expect(isTraceableType(traceable)).toBe(true);
  });
});

describe('the quantum circuit snapshot', () => {
  it('records qubits and gates by their cell, with the column’s controls as a feature of its gates', () => {
    const circuit = { cols: [['H', 1], ['•', 'X']], gates: [], initialStates: ['0', '1'] };
    const snapshots = snapshotQuantumModel(circuit, 'qc');
    expect(summary(snapshots)).toEqual([
      ['qc:qubit:0', 'Qubit', 'q0', null],
      ['qc:qubit:1', 'Qubit', 'q1', null],
      ['qc:gate:0:0', 'HadamardGate', 'H', 'qc:qubit:0'],
      ['qc:gate:1:1', 'PauliXGate', 'X', 'qc:qubit:1'],
    ]);
    expect(snapshots.get('qc:gate:1:1')!.features.controls.key).toBe('q0 •');
    const changes = diffDiagramModel('QuantumCircuitDiagram', circuit, { ...circuit, cols: [['H', 'Z'], ['•', 'X']] }, 'qc');
    expect(changes.map((c) => [c.kind, c.elementType])).toEqual([['CREATED', 'PauliZGate']]);
    // Adding a control changes the gate it controls.
    const controlled = diffDiagramModel('QuantumCircuitDiagram', circuit, { ...circuit, cols: [['H', 1], ['◦', 'X']] }, 'qc');
    expect(controlled.map((c) => [c.kind, c.elementId, c.feature])).toEqual([['UPDATED', 'qc:gate:1:1', 'controls']]);
  });

  it('records no change when the editor fills in the default initial states of a loaded template', () => {
    // Live: Bell State template, then "initialState 0 → |0⟩" on q0 and q1 by the user a second later.
    const template = { cols: [['H', 1], ['•', 'X']], gates: [] };
    expect(diffDiagramModel('QuantumCircuitDiagram', template, { ...template, initialStates: ['|0⟩', '|0⟩'] }, 'qc')).toEqual([]);
  });

  it('records a gate over several wires once, at its first wire, under the backend’s metaclass', () => {
    const circuit = {
      cols: [['Swap', 'Swap', 'S'], ['RZZ', 1, 'RZZ'], ['__FUNC__f', '__FUNC__f', 'Measure'], ['QFT', 'Rx(0.5)', 'mystery']],
      gateMetadata: { '2_0': { label: 'f', isFunctionGate: true, height: 2, nestedCircuit: { cols: [] } } },
    };
    expect(summary(snapshotQuantumModel(circuit, 'qc')).filter((s) => s[1] !== 'Qubit').map((s) => [s[0], s[1]])).toEqual([
      ['qc:gate:0:0', 'SwapGate'],
      ['qc:gate:0:2', 'SGate'],
      ['qc:gate:1:0', 'RZZGate'],
      ['qc:gate:2:0', 'FunctionGate'],
      ['qc:gate:2:2', 'Measurement'],
      ['qc:gate:3:0', 'QFTGate'],
      ['qc:gate:3:1', 'RXGate'],
      ['qc:gate:3:2', 'CustomGate'],
    ]);
    expect(snapshotQuantumModel(circuit, 'qc').get('qc:gate:0:0')!.features.wires.key).toBe('q0, q1');
  });
});

describe('the knowledge graph snapshot', () => {
  it('records nodes and edges, not their position or the view settings', () => {
    const graph = {
      nodes: [
        { id: 'n1', nodeType: 'class', label: 'Book', iri: 'ex:Book', position: { x: 1, y: 1 } },
        { id: 'n2', nodeType: 'property', label: 'title' },
      ],
      edges: [{ id: 'e1', source: 'n2', target: 'n1', label: 'domain' }],
      settings: { visibleIds: ['n1'] },
    };
    expect(summary(snapshotKnowledgeGraph(graph)).map((s) => s[1])).toEqual(['KGClass', 'KGProperty', 'KGEdge']);
    const moved = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, position: { x: 9, y: 9 } })), settings: { visibleIds: [] } };
    expect(diffDiagramModel('KnowledgeGraphDiagram', graph, moved, 'kg')).toEqual([]);
  });

  it('matches a converted class diagram’s classes and attributes to the graph’s nodes by name', () => {
    const graph = { nodes: [{ id: 'n1', nodeType: 'class', label: 'Book' }, { id: 'n2', nodeType: 'property', label: 'title' }], edges: [] };
    const classes = {
      elements: {
        c: { id: 'c', type: 'Class', name: 'Book' },
        a: { id: 'a', type: 'ClassAttribute', name: 'title', owner: 'c' },
        x: { id: 'x', type: 'Class', name: 'Other' },
      },
    };
    expect(elementsMatchedByName(
      { diagramType: 'KnowledgeGraphDiagram', model: graph, id: 'kg' },
      { diagramType: 'ClassDiagram', model: classes, id: 'cd' },
    )).toEqual({ c: 'n1', a: 'n2' });
  });
});

describe('diffSnapshots', () => {
  const snap = (features: Record<string, string>): Map<string, Snapshot> =>
    new Map([['e', {
      elementType: 'X', name: 'e', parentElementId: null, rank: 0,
      features: Object.fromEntries(Object.entries(features).map(([k, v]) => [k, { key: v, display: v }])),
    }]]);

  it('records a feature set for the first time, and one cleared', () => {
    expect(diffSnapshots(snap({}), snap({ guard: 'x > 1' }))).toEqual([
      expect.objectContaining({ kind: 'UPDATED', feature: 'guard', oldValue: '', newValue: 'x > 1' }),
    ]);
    expect(diffSnapshots(snap({ guard: 'x > 1' }), snap({}))).toEqual([
      expect.objectContaining({ kind: 'UPDATED', feature: 'guard', oldValue: 'x > 1', newValue: '' }),
    ]);
    expect(diffSnapshots(snap({}), snap({ guard: '' }))).toEqual([]);
  });
});
