import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '../../../constants/z-index';
import { Circuit, Gate, InitialState } from '../types';
import { CircuitEditor } from './CircuitEditor';

interface NestedCircuitModalProps {
  gate: Gate;
  onClose: () => void;
  onSave: (circuit: Circuit, name?: string, color?: string) => void;
}

export function NestedCircuitModal({ gate, onClose, onSave }: NestedCircuitModalProps): JSX.Element {
  const [gateName, setGateName] = useState<string>(gate.label || '');
  const [gateColor, setGateColor] = useState<string>(gate.backgroundColor || '#FFE8CC');
  const [circuit, setCircuit] = useState<Circuit>(() => {
    return gate.nestedCircuit || {
      columns: [],
      qubitCount: gate.height || 2,
      initialStates: Array(gate.height || 2).fill('|0⟩'),
    };
  });

  // Sync with gate prop changes (when reopening modal with updated gate)
  useEffect(() => {
    setGateName(gate.label || '');
    setGateColor(gate.backgroundColor || '#FFE8CC');

    if (gate.nestedCircuit) {
      setCircuit(gate.nestedCircuit);
    } else {
      setCircuit({
        columns: [],
        qubitCount: gate.height || 2,
        initialStates: Array(gate.height || 2).fill('|0⟩'),
      });
    }
  }, [gate]);

  const handleCircuitChange = useCallback((newCircuit: Circuit) => {
    setCircuit(newCircuit);
  }, []);

  const handleSave = useCallback(() => {
    onSave(circuit, gateName, gateColor);
  }, [circuit, gateName, gateColor, onSave]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleAddQubit = useCallback(() => {
    setCircuit((prev) => {
      const newQubitCount = prev.qubitCount + 1;
      const newColumns = prev.columns.map(col => ({
        gates: [...col.gates, null],
      }));
      const newInitialStates: InitialState[] = [...(prev.initialStates || []), '|0⟩'];
      return {
        ...prev,
        qubitCount: newQubitCount,
        columns: newColumns,
        initialStates: newInitialStates,
      };
    });
  }, []);

  const handleRemoveQubit = useCallback(() => {
    if (circuit.qubitCount <= 1) return;

    setCircuit((prev) => {
      const newQubitCount = prev.qubitCount - 1;
      const newColumns = prev.columns.map(col => ({
        gates: col.gates.slice(0, -1),
      }));
      const newInitialStates: InitialState[] = (prev.initialStates || []).slice(0, -1) as InitialState[];
      return {
        ...prev,
        qubitCount: newQubitCount,
        columns: newColumns,
        initialStates: newInitialStates,
      };
    });
  }, [circuit.qubitCount]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-5"
      style={{ zIndex: Z_INDEX.MODAL }}
      onClick={handleOverlayClick}
    >
      <div
        className="bg-[var(--quantum-editor-bg,#ffffff)] text-[var(--quantum-editor-text,#0f172a)] border border-[var(--quantum-editor-border,#d5dde8)] rounded-lg shadow-[var(--quantum-editor-tooltip-shadow,0_12px_28px_rgba(2,6,23,0.18))] w-[85vw] max-w-[1400px] min-w-[900px] max-h-[85vh] min-h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--quantum-editor-border,#d5dde8)] flex flex-col gap-3 bg-[var(--quantum-editor-surface,#f8fafc)]">
          <div className="flex justify-between items-center">
            <h2 className="m-0 text-lg font-semibold text-[var(--quantum-editor-text,#0f172a)]">
              Edit Function Gate
            </h2>
            <button
              className="bg-transparent border border-transparent text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded text-[var(--quantum-editor-muted-text,#64748b)] hover:border-[var(--quantum-editor-border,#d5dde8)] hover:bg-[var(--quantum-editor-surface,#f8fafc)] hover:text-[var(--quantum-editor-text,#0f172a)]"
              onClick={onClose}
              aria-label="Close modal"
              title="Close"
            >
              ×
            </button>
          </div>
          <input
            type="text"
            className="w-full px-3 py-2 border border-[var(--quantum-editor-border,#d5dde8)] rounded text-sm font-[inherit] text-[var(--quantum-editor-text,#0f172a)] bg-[var(--quantum-editor-bg,#ffffff)] placeholder:text-[var(--quantum-editor-muted-text,#64748b)] focus:outline-none focus:border-[var(--quantum-editor-primary,#0284c7)] focus:shadow-[0_0_0_3px_var(--quantum-editor-primary-soft,rgba(2,132,199,0.16))]"
            placeholder="Enter gate name (e.g., Bell State, QFT)"
            value={gateName}
            onChange={(e) => setGateName(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--quantum-editor-muted-text,#64748b)]">Gate Color:</span>
            <div className="flex gap-1.5">
              {['#FFE8CC', '#E8F4FF', '#E8FFE8', '#FFE8E8', '#F0E8FF', '#FFF8E8', '#E8FFFF', '#FFE8F4'].map((color) => (
                <button
                  key={color}
                  onClick={() => setGateColor(color)}
                  className={cn(
                    'w-6 h-6 p-0 rounded cursor-pointer',
                    gateColor === color
                      ? 'border-2 border-[var(--quantum-editor-text,#0f172a)]'
                      : 'border border-[var(--quantum-editor-border,#d5dde8)]'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select gate color ${color}`}
                  title={color}
                />
              ))}
              <input
                type="color"
                className="w-6 h-6 p-0 border border-[var(--quantum-editor-border,#d5dde8)] rounded cursor-pointer bg-[var(--quantum-editor-bg,#ffffff)]"
                value={gateColor}
                onChange={(e) => setGateColor(e.target.value)}
                title="Custom color"
              />
            </div>
          </div>
        </div>

        <div className="p-5 overflow-auto flex-1 flex gap-5 bg-[var(--quantum-editor-bg,#ffffff)]">
          <CircuitEditor
            initialCircuit={circuit}
            onCircuitChange={handleCircuitChange}
            isActive={true}
            keyboardCapturePhase={true}
            compactPalette={true}
            style={{ flex: 1, minHeight: '400px' }}
          />
        </div>

        <div className="px-5 py-4 border-t border-[var(--quantum-editor-border,#d5dde8)] flex justify-between items-center gap-3 bg-[var(--quantum-editor-surface,#f8fafc)]">
          <div className="flex items-center gap-2 text-sm text-[var(--quantum-editor-text,#0f172a)]">
            <span>Qubits: {circuit.qubitCount}</span>
            <button
              className="px-3 py-1 border border-[var(--quantum-editor-border,#d5dde8)] rounded text-sm cursor-pointer text-[var(--quantum-editor-text,#0f172a)] bg-[var(--quantum-editor-bg,#ffffff)] transition-all duration-200 hover:enabled:bg-[var(--quantum-editor-surface,#f8fafc)] hover:enabled:border-[var(--quantum-editor-muted-text,#64748b)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRemoveQubit}
              disabled={circuit.qubitCount <= 1}
              aria-label="Remove qubit"
              title="Remove qubit"
            >
              −
            </button>
            <button
              className="px-3 py-1 border border-[var(--quantum-editor-border,#d5dde8)] rounded text-sm cursor-pointer text-[var(--quantum-editor-text,#0f172a)] bg-[var(--quantum-editor-bg,#ffffff)] transition-all duration-200 hover:enabled:bg-[var(--quantum-editor-surface,#f8fafc)] hover:enabled:border-[var(--quantum-editor-muted-text,#64748b)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddQubit}
              aria-label="Add qubit"
              title="Add qubit"
            >
              +
            </button>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 border border-[var(--quantum-editor-border,#d5dde8)] rounded text-sm font-medium cursor-pointer transition-colors duration-200 bg-[var(--quantum-editor-muted-surface,#f1f5f9)] text-[var(--quantum-editor-text,#0f172a)] hover:bg-[var(--quantum-editor-surface,#f8fafc)] active:translate-y-px"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 border border-transparent rounded text-sm font-medium cursor-pointer transition-colors duration-200 bg-[var(--quantum-editor-primary,#0284c7)] text-white hover:bg-[#0ea5e9] active:translate-y-px"
              onClick={handleSave}
            >
              Save Circuit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
