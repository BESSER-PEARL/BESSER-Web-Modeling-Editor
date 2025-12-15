import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Circuit, Gate, InitialState } from '../types';
import { CircuitEditor } from './CircuitEditor';
import { COLORS } from '../layout-constants';

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
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
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
          <CircuitEditor
            initialCircuit={circuit}
            onCircuitChange={handleCircuitChange}
            isActive={true}
            keyboardCapturePhase={true}
            compactPalette={true}
            style={{ flex: 1, minHeight: '400px' }}
          />
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
