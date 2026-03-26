/**
 * Quantum Circuit Diagram Converter
 * Converts simplified quantum circuit specifications to Apollon-compatible format.
 *
 * Quantum circuits are structurally different from UML diagrams — they consist of
 * qubit wires and gate operations placed on a grid.  The converter maps a gate-list
 * spec into positioned elements that the editor can render.
 */

import { DiagramConverter, DiagramPosition, PositionGenerator, generateUniqueId } from './base';

/** Supported quantum gate types */
type QuantumGateKind = 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'CZ' | 'SWAP' | 'T' | 'S' | 'RX' | 'RY' | 'RZ' | 'Measure' | string;

interface QuantumGateSpec {
  gate: QuantumGateKind;
  /** Zero-based qubit indices the gate operates on */
  qubits: number[];
  /** Column index (time step) on the circuit grid */
  column?: number;
  /** Optional parameters (rotation angles, etc.) */
  params?: Record<string, number>;
}

interface QuantumCircuitSpec {
  circuitName?: string;
  /** Number of qubits (wires) */
  numQubits?: number;
  /** Ordered gate operations */
  gates?: QuantumGateSpec[];
  /** Initial qubit states (|0⟩ by default) */
  initialStates?: string[];
}

const GATE_WIDTH = 60;
const GATE_HEIGHT = 60;
const WIRE_SPACING_Y = 80;
const GATE_SPACING_X = 90;
const WIRE_START_X = 80;
const WIRE_START_Y = 60;

export class QuantumCircuitConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'QuantumCircuitDiagram' as const;
  }

  /**
   * Convert a single gate specification into editor elements.
   */
  convertSingleElement(spec: any, position?: DiagramPosition) {
    const pos = position || this.positionGenerator.getNextPosition();
    const gateId = generateUniqueId('qgate');
    const gateSpec = spec as Partial<QuantumGateSpec>;

    return {
      state: {
        id: gateId,
        name: gateSpec.gate || 'H',
        type: 'QuantumGate',
        owner: null,
        bounds: { x: pos.x, y: pos.y, width: GATE_WIDTH, height: GATE_HEIGHT },
        qubits: gateSpec.qubits ?? [0],
        params: gateSpec.params ?? {},
      },
    };
  }

  /**
   * Convert a complete quantum circuit specification (qubits + gates) into
   * an element / relationship map that can be merged into the editor model.
   */
  convertCompleteSystem(spec: any) {
    const circuitSpec = spec as Partial<QuantumCircuitSpec>;
    const numQubits = circuitSpec.numQubits ?? this.inferQubitCount(circuitSpec);
    const gates = circuitSpec.gates ?? [];

    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};

    // 1. Create qubit wire elements
    for (let q = 0; q < numQubits; q++) {
      const wireId = generateUniqueId('qwire');
      elements[wireId] = {
        id: wireId,
        name: circuitSpec.initialStates?.[q] ?? `q${q}`,
        type: 'QuantumWire',
        owner: null,
        bounds: {
          x: WIRE_START_X - 60,
          y: WIRE_START_Y + q * WIRE_SPACING_Y,
          width: WIRE_START_X + (gates.length + 1) * GATE_SPACING_X,
          height: 20,
        },
        qubitIndex: q,
      };
    }

    // 2. Place gates on the grid
    gates.forEach((gate, colIndex) => {
      const col = gate.column ?? colIndex;
      const qubits = gate.qubits ?? [0];

      qubits.forEach((qubitIdx) => {
        const gateId = generateUniqueId('qgate');
        elements[gateId] = {
          id: gateId,
          name: gate.gate,
          type: 'QuantumGate',
          owner: null,
          bounds: {
            x: WIRE_START_X + col * GATE_SPACING_X,
            y: WIRE_START_Y + qubitIdx * WIRE_SPACING_Y - GATE_HEIGHT / 2 + 10,
            width: GATE_WIDTH,
            height: GATE_HEIGHT,
          },
          qubits: gate.qubits,
          params: gate.params ?? {},
        };
      });

      // For multi-qubit gates, add a control/target relationship
      if (qubits.length > 1) {
        const relId = generateUniqueId('qlink');
        const sortedQubits = [...qubits].sort((a, b) => a - b);
        relationships[relId] = {
          id: relId,
          type: 'QuantumGateLink',
          name: gate.gate,
          source: { element: `q${sortedQubits[0]}_col${col}`, direction: 'Down' },
          target: { element: `q${sortedQubits[sortedQubits.length - 1]}_col${col}`, direction: 'Up' },
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          path: [],
          isManuallyLayouted: false,
        };
      }
    });

    return {
      elements,
      relationships,
      size: {
        width: Math.max(800, WIRE_START_X + (gates.length + 2) * GATE_SPACING_X),
        height: Math.max(400, WIRE_START_Y + numQubits * WIRE_SPACING_Y + 60),
      },
    };
  }

  /** Infer the number of qubits from the gate list */
  private inferQubitCount(spec: Partial<QuantumCircuitSpec>): number {
    const gates = spec.gates ?? [];
    let maxQubit = 0;
    gates.forEach((g) => {
      (g.qubits ?? []).forEach((q) => {
        if (q > maxQubit) maxQubit = q;
      });
    });
    return Math.max(1, maxQubit + 1);
  }
}
