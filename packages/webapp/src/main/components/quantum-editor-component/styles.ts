import styled from 'styled-components';
import { COLORS } from './layout-constants';

export const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: ${COLORS.BACKGROUND};
  font-family: sans-serif;
`;

export const Toolbar = styled.div`
  padding: 10px;
  background-color: ${COLORS.TOOLBOX_BACKGROUND};
  border-bottom: 1px solid #aaa;
  display: flex;
  gap: 10px;
`;

export const Workspace = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

export const PaletteContainer = styled.div`
  width: 250px;
  background-color: ${COLORS.TOOLBOX_BACKGROUND};
  border-right: 1px solid #aaa;
  overflow-y: auto;
  padding: 10px;
`;

export const CircuitContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
  position: relative;
`;

export const SaveStatus = styled.div<{ $status: 'saved' | 'saving' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${props => {
    switch (props.$status) {
      case 'saved': return '#27ae60';
      case 'saving': return '#3498db';
      case 'error': return '#e74c3c';
    }
  }};
`;

export const ToolbarButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'success' | 'info' }>`
  padding: 8px 16px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  background-color: ${props => {
    switch (props.$variant) {
      case 'primary': return '#28a745';
      case 'secondary': return '#ffc107';
      case 'success': return '#4CAF50';
      case 'info': return '#2196F3';
      default: return '#6c757d';
    }
  }};

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const UndoRedoButton = styled.button<{ $disabled?: boolean }>`
  padding: 5px 10px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.5 : 1};
`;

export const DragGhost = styled.div<{ $x: number; $y: number; $offsetX: number; $offsetY: number }>`
  position: fixed;
  left: ${props => props.$x - props.$offsetX}px;
  top: ${props => props.$y - props.$offsetY}px;
  pointer-events: none;
  z-index: 1000;
`;
