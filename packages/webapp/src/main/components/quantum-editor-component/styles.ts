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

export const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`;

export const DropdownButton = styled.button<{ $isOpen?: boolean }>`
  padding: 8px 16px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  background-color: #9c27b0;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    opacity: 0.9;
  }

  &::after {
    content: '▼';
    font-size: 10px;
    transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0)'};
    transition: transform 0.2s;
  }
`;

export const DropdownMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 280px;
  max-height: 400px;
  overflow-y: auto;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: ${props => props.$isOpen ? 'block' : 'none'};
  margin-top: 4px;
`;

export const DropdownCategory = styled.div`
  padding: 8px 12px;
  font-size: 11px;
  font-weight: bold;
  color: #666;
  background-color: #f5f5f5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #eee;
`;

export const DropdownItem = styled.button`
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background-color: #e8f4fd;
  }

  &:last-child {
    border-bottom: none;
  }
`;

export const DropdownItemTitle = styled.span`
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

export const DropdownItemDescription = styled.span`
  font-size: 11px;
  color: #888;
`;

export const DropdownOverlay = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'block' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
`;

