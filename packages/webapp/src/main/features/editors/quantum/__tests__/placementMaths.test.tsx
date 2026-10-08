import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCircuitEditor } from '../hooks/useCircuitEditor';
import { GATE_SIZE, LEFT_MARGIN, TOP_MARGIN, WIRE_SPACING, cellAt } from '../layout-constants';
import { Circuit } from '../types';

// Centre of cell (row, col) exactly as CircuitGrid renders it: left = LEFT_MARGIN + col * WIRE_SPACING.
const centreOf = (row: number, col: number) => ({
  x: LEFT_MARGIN + col * WIRE_SPACING + GATE_SIZE / 2,
  y: TOP_MARGIN + row * WIRE_SPACING + GATE_SIZE / 2,
});

const CELLS: Array<[number, number]> = [[0, 0], [1, 2], [3, 5], [2, 9]];

// trimCircuit drops leading empty columns, so anchor column 0 with a gate on a row the test doesn't use.
const setup = (targetRow: number) => {
  const anchorRow = targetRow === 0 ? 3 : 0;
  const gates: Circuit['columns'][number]['gates'] = Array(4).fill(null);
  gates[anchorRow] = { id: 'anchor', type: 'X', label: 'X' } as any;
  const circuit: Circuit = { columns: [{ gates }], qubitCount: 4, initialStates: Array(4).fill('|0⟩') };
  const grid = document.createElement('div');
  grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 400 }) as DOMRect;
  const gridRef = { current: grid };
  const { result } = renderHook(() => useCircuitEditor({ initialCircuit: circuit }));
  return { result, gridRef };
};

describe('nested circuit placement maths', () => {
  it.each(CELLS)('cellAt maps the centre of row %i, col %i back to that cell', (row, col) => {
    const { x, y } = centreOf(row, col);
    expect(cellAt(x, y)).toEqual({ row, col });
  });

  it.each(CELLS)('click-to-place at the centre of row %i, col %i lands there', (row, col) => {
    const { result, gridRef } = setup(row);
    const { x, y } = centreOf(row, col);
    act(() => {
      expect(result.current.placeGateAt('H', x, y, gridRef)).toBe(true);
    });
    expect(result.current.circuit.columns[col]?.gates[row]?.type).toBe('H');
  });

  it.each(CELLS)('dropping a gate centred on row %i, col %i lands there', (row, col) => {
    const { result, gridRef } = setup(row);
    const source = document.createElement('div');
    source.getBoundingClientRect = () => ({ left: 0, top: 0, width: GATE_SIZE, height: GATE_SIZE }) as DOMRect;
    const grab = 10; // cursor 10px into the gate
    act(() => {
      result.current.handleDragStart('H', { currentTarget: source, clientX: grab, clientY: grab } as any);
    });

    const { x, y } = centreOf(row, col);
    const cursor = { clientX: x - GATE_SIZE / 2 + grab, clientY: y - GATE_SIZE / 2 + grab };
    act(() => {
      result.current.handleMouseMove(cursor as any, gridRef);
    });
    expect(result.current.previewPosition).toMatchObject({ row, col, isValid: true });

    act(() => {
      result.current.handleMouseUp();
    });
    expect(result.current.circuit.columns[col]?.gates[row]?.type).toBe('H');
  });
});
