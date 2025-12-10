import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Circuit, Gate, InitialState } from '../types';
import { CircuitGrid } from './CircuitGrid';
import { GatePalette } from './GatePalette';
import { COLORS, GATE_SIZE, WIRE_SPACING } from '../layout-constants';
import { trimCircuit } from '../utils';
import { GATES } from '../constants';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 85vw;
  max-width: 1400px;
  min-width: 900px;
  max-height: 85vh;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 2px solid ${COLORS.STROKE};
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f5f5f5;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const NameInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: ${COLORS.HIGHLIGHTED_GATE_FILL};
    box-shadow: 0 0 0 2px rgba(255, 255, 170, 0.2);
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow: auto;
  flex: 1;
  display: flex;
  gap: 20px;
`;

const ModalFooter = styled.div`
  padding: 16px 20px;
  border-top: 2px solid ${COLORS.STROKE};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #f5f5f5;
`;

const QubitControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
`;

const QubitButton = styled.button`
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: #999;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: ${props => props.$primary ? COLORS.HIGHLIGHTED_GATE_FILL : '#e0e0e0'};
  color: ${props => props.$primary ? '#000' : '#333'};

  &:hover {
    background-color: ${props => props.$primary ? '#FFA' : '#d0d0d0'};
  }

  &:active {
    transform: translateY(1px);
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #666;

  &:hover {
    background-color: #e0e0e0;
    color: #000;
  }
`;

const PaletteContainer = styled.div`
  min-width: 220px;
  max-width: 220px;
  border-right: 2px solid ${COLORS.STROKE};
  padding-right: 20px;
  overflow-y: auto;
`;

const CircuitContainer = styled.div`
  flex: 1;
  overflow: auto;
  min-height: 500px;
  min-width: 600px;
`;

interface NestedCircuitModalProps {
  gate: Gate;
  onClose: () => void;
  onSave: (circuit: Circuit, name?: string, color?: string) => void;
}

export function NestedCircuitModal({ gate, onClose, onSave }: NestedCircuitModalProps): JSX.Element {
  const [gateName, setGateName] = useState<string>(gate.label || '');
  const [gateColor, setGateColor] = useState<string>(gate.backgroundColor || '#FFE8CC');
  const [circuit, setCircuit] = useState<Circuit>(() => {
    //console.log('[NestedCircuitModal] Initial gate:', gate);
    //console.log('[NestedCircuitModal] Initial nested circuit:', gate.nestedCircuit);
    return gate.nestedCircuit || {
      columns: [],
      qubitCount: gate.height || 2,
      initialStates: Array(gate.height || 2).fill('|0⟩'),
    };
  });

  // Sync with gate prop changes (when reopening modal with updated gate)
  useEffect(() => {
    //console.log('[NestedCircuitModal] useEffect - Gate changed:', gate);
    //console.log('[NestedCircuitModal] useEffect - Gate nestedCircuit:', gate.nestedCircuit);
    //console.log('[NestedCircuitModal] useEffect - Gate label:', gate.label);
    
    setGateName(gate.label || '');
    setGateColor(gate.backgroundColor || '#FFE8CC');
    
    if (gate.nestedCircuit) {
      //console.log('[NestedCircuitModal] useEffect - Setting circuit from gate.nestedCircuit');
      setCircuit(gate.nestedCircuit);
    } else {
      //console.log('[NestedCircuitModal] useEffect - No nestedCircuit, creating empty circuit');
      setCircuit({
        columns: [],
        qubitCount: gate.height || 2,
        initialStates: Array(gate.height || 2).fill('|0⟩'),
      });
    }
  }, [gate]);

  const circuitGridRef = useRef<HTMLDivElement>(null);
  
  // Drag and drop state
  const [draggedGate, setDraggedGate] = useState<{ gate: string; offset: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [previewPosition, setPreviewPosition] = useState<{ col: number; row: number; isValid: boolean } | null>(null);

  const handleDragStart = useCallback((gateType: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDraggedGate({
      gate: gateType,
      offset: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedGate || !circuitGridRef.current) return;
    
    const rect = circuitGridRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left + circuitGridRef.current.scrollLeft;
    const relativeY = e.clientY - rect.top + circuitGridRef.current.scrollTop;
    
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    
    // Calculate preview position accounting for margins
    const LEFT_MARGIN = 60;
    const TOP_MARGIN = 20;
    const col = Math.floor((relativeX - LEFT_MARGIN) / (GATE_SIZE + 4));
    const row = Math.floor((relativeY - TOP_MARGIN) / WIRE_SPACING);
    
    // Get gate definition to check height
    const gateDefinition = GATES.find((g) => g.type === draggedGate.gate);
    const gateHeight = gateDefinition?.height || 1;
    
    // Check if position is valid
    const isValid = col >= 0 && 
                   row >= 0 && 
                   row + gateHeight <= circuit.qubitCount;
    
    setPreviewPosition({
      col: Math.max(0, col),
      row: Math.max(0, row),
      isValid,
    });
  }, [draggedGate, circuit.qubitCount]);

  const handleMouseUp = useCallback(() => {
    if (!draggedGate || !previewPosition || !previewPosition.isValid) {
      setDraggedGate(null);
      setPreviewPosition(null);
      return;
    }

    const gateDefinition = GATES.find((g) => g.type === draggedGate.gate);
    if (!gateDefinition) {
      setDraggedGate(null);
      setPreviewPosition(null);
      return;
    }

    setCircuit((prev) => {
      const newColumns = [...prev.columns];
      const gateHeight = gateDefinition.height || 1;
      
      // Check if gate fits in available qubits
      if (previewPosition.row + gateHeight > prev.qubitCount) {
        console.warn('Gate does not fit in available qubits');
        return prev;
      }
      
      // Ensure column exists
      while (newColumns.length <= previewPosition.col) {
        newColumns.push({ gates: Array(prev.qubitCount).fill(null) });
      }

      // Check if cells are already occupied
      const targetColumn = newColumns[previewPosition.col];
      const newGates = [...targetColumn.gates];
      
      for (let i = 0; i < gateHeight; i++) {
        if (newGates[previewPosition.row + i] !== null) {
          console.warn('Cannot place gate: cells already occupied');
          return prev;
        }
      }
      
      // Create new gate by spreading the full gate definition to preserve all properties
      // including isControl, drawer, symbol, etc.
      const newGate: Gate = {
        ...gateDefinition,
        id: `${draggedGate.gate}-${Date.now()}`,
      };
      
      newGates[previewPosition.row] = newGate;

      // Mark occupied cells for multi-qubit gates
      for (let i = 1; i < gateHeight; i++) {
        if (previewPosition.row + i < newGates.length) {
          newGates[previewPosition.row + i] = { 
            type: 'OCCUPIED', 
            id: `${newGate.id}-occupied-${i}`, 
            label: '',
          } as Gate;
        }
      }

      newColumns[previewPosition.col] = { gates: newGates };
      return trimCircuit({ ...prev, columns: newColumns });
    });

    setDraggedGate(null);
    setPreviewPosition(null);
  }, [draggedGate, previewPosition]);

  const handleSave = useCallback(() => {
    //console.log('[NestedCircuitModal] handleSave called!');
    //console.log('[NestedCircuitModal] Saving circuit:', circuit);
    //console.log('[NestedCircuitModal] Circuit columns:', circuit.columns);
    //console.log('[NestedCircuitModal] Gate name:', gateName);
    //console.log('[NestedCircuitModal] Gate color:', gateColor);
    onSave(circuit, gateName, gateColor);
    // Don't call onClose here - onSave already handles closing
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
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent onClick={(e) => e.stopPropagation()} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        <ModalHeader>
          <HeaderRow>
            <ModalTitle>
              Edit Function Gate
            </ModalTitle>
            <CloseButton onClick={onClose} title="Close">
              ×
            </CloseButton>
          </HeaderRow>
          <NameInput
            type="text"
            placeholder="Enter gate name (e.g., Bell State, QFT)"
            value={gateName}
            onChange={(e) => setGateName(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>Gate Color:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['#FFE8CC', '#E8F4FF', '#E8FFE8', '#FFE8E8', '#F0E8FF', '#FFF8E8', '#E8FFFF', '#FFE8F4'].map((color) => (
                <button
                  key={color}
                  onClick={() => setGateColor(color)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: gateColor === color ? '2px solid #333' : '1px solid #ccc',
                    backgroundColor: color,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={gateColor}
                onChange={(e) => setGateColor(e.target.value)}
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                title="Custom color"
              />
            </div>
          </div>
        </ModalHeader>
        
        <ModalBody>
          <PaletteContainer>
            <h3 style={{ marginTop: 0, fontSize: 14, color: '#666' }}>Gate Palette</h3>
            <GatePalette onDragStart={handleDragStart} />
          </PaletteContainer>
          
          <CircuitContainer>
            <CircuitGrid
              ref={circuitGridRef}
              circuit={circuit}
              onGateDrop={() => {}}
              draggedGate={draggedGate ? { gate: draggedGate.gate, x: mousePos.x, y: mousePos.y } : null}
              onDragStart={handleDragStart}
              onGateResize={(col: number, row: number, newHeight: number) => {
                setCircuit((prev) => {
                  const newColumns = [...prev.columns];
                  if (newColumns[col]) {
                    const newGates = [...newColumns[col].gates];
                    const gateItem = newGates[row];
                    if (gateItem && gateItem.canResize) {
                      newGates[row] = { ...gateItem, height: newHeight };
                      newColumns[col] = { gates: newGates };
                    }
                  }
                  return { ...prev, columns: newColumns };
                });
              }}
              onGateSelect={() => {}}
              onInitialStateChange={(row: number) => {
                setCircuit((prev) => {
                  const currentStates = prev.initialStates || Array(prev.qubitCount).fill('|0⟩');
                  const INITIAL_STATES = ['|0⟩', '|1⟩', '|+⟩', '|−⟩', '|i⟩', '|−i⟩'];
                  const currentState = currentStates[row] || '|0⟩';
                  const currentIndex = INITIAL_STATES.indexOf(currentState);
                  const nextIndex = (currentIndex + 1) % INITIAL_STATES.length;
                  const newStates = [...currentStates];
                  newStates[row] = INITIAL_STATES[nextIndex];
                  return { ...prev, initialStates: newStates };
                });
              }}
              selectedGate={null}
              previewPosition={previewPosition}
            />
          </CircuitContainer>
        </ModalBody>
        
        <ModalFooter>
          <QubitControls>
            <span>Qubits: {circuit.qubitCount}</span>
            <QubitButton onClick={handleRemoveQubit} disabled={circuit.qubitCount <= 1} title="Remove qubit">
              −
            </QubitButton>
            <QubitButton onClick={handleAddQubit} title="Add qubit">
              +
            </QubitButton>
          </QubitControls>
          <ButtonGroup>
            <Button onClick={onClose}>Cancel</Button>
            <Button $primary onClick={handleSave}>Save Circuit</Button>
          </ButtonGroup>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
}
