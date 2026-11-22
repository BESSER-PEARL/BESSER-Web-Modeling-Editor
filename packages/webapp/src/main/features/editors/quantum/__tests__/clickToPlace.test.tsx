import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CircuitEditor } from '../components/CircuitEditor';
import { useCircuitDragDrop } from '../hooks/useCircuitDragDrop';
import { Circuit } from '../types';

const emptyCircuit = (): Circuit => ({ columns: [], qubitCount: 2, initialStates: ['|0⟩', '|0⟩'] });

describe('click-to-place gates', () => {
  it('arms a palette gate on click and places it on the clicked cell', () => {
    const onCircuitChange = vi.fn();
    const { container } = render(<CircuitEditor initialCircuit={emptyCircuit()} onCircuitChange={onCircuitChange} />);

    const firstGate = container.querySelector('button[aria-pressed]') as HTMLButtonElement;
    fireEvent.click(firstGate);
    expect(firstGate).toHaveAttribute('aria-pressed', 'true');

    // jsdom rects are all zero, so (70, 70) is the centre of column 0 / row 0 (margins 50, cell 40).
    const grid = container.querySelector('.cursor-crosshair') as HTMLElement;
    fireEvent.click(grid, { clientX: 70, clientY: 70 });

    const calls = onCircuitChange.mock.calls;
    const latest: Circuit = calls[calls.length - 1][0];
    expect(latest.columns[0]?.gates[0]?.type).toBe('MEASURE');
    expect(firstGate).toHaveAttribute('aria-pressed', 'false');
  });

  it('disarms on Escape without placing anything', () => {
    const onCircuitChange = vi.fn();
    const { container } = render(<CircuitEditor initialCircuit={emptyCircuit()} onCircuitChange={onCircuitChange} />);

    const firstGate = container.querySelector('button[aria-pressed]') as HTMLButtonElement;
    fireEvent.click(firstGate);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(firstGate).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.cursor-crosshair')).toBeNull();
  });

  describe('main editor placement (useCircuitDragDrop)', () => {
    const setup = () => {
      let circuit = emptyCircuit();
      const setCircuit = vi.fn((updater: (prev: Circuit) => Circuit) => {
        circuit = updater(circuit);
      });
      const grid = document.createElement('div');
      grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect;
      const { result } = renderHook(() =>
        useCircuitDragDrop({ circuit, setCircuit, circuitGridRef: { current: grid } }),
      );
      return { result, getCircuit: () => circuit };
    };

    it('places a gate at a clicked point', () => {
      const { result, getCircuit } = setup();
      // LEFT_MARGIN = TOP_MARGIN = 50, cell = 40px: (70, 110) is column 0, row 1.
      act(() => {
        expect(result.current.placeGateAt('H', 70, 110)).toBe(true);
      });
      expect(getCircuit().columns[0].gates[1]?.type).toBe('H');
    });

    it('still drops a dragged gate at the same cell (shared drop logic)', () => {
      const { result, getCircuit } = setup();
      const source = document.createElement('div');
      source.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40 }) as DOMRect;
      act(() => {
        result.current.handleDragStart('H', { currentTarget: source, clientX: 10, clientY: 10, stopPropagation: () => {} } as any);
      });
      // Gate centre = 60 - 10 + 20 = 70 -> column 0, row 0.
      act(() => {
        result.current.handleMouseUp({ clientX: 60, clientY: 60 } as any);
      });
      expect(getCircuit().columns[0].gates[0]?.type).toBe('H');
    });
  });
});
