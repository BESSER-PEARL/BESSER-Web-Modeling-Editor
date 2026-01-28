import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  Diagram3,
  Diagram2,
  Robot,
  Gear,
  PencilSquare,
  ArrowRepeat,
  House,
  Cpu
} from 'react-bootstrap-icons';
import { UMLDiagramType } from '@besser/wme';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useProject } from '../../hooks/useProject';
import { toUMLDiagramType } from '../../types/project';

const SidebarContainer = styled.div`
  width: 60px;
  background: var(--apollon-background);
  border-right: 1px solid var(--apollon-switch-box-border-color);
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  position: fixed;
  left: 0;
  top: 60px;
  z-index: 100;
  backdrop-filter: blur(10px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
`;

const SidebarButton = styled(Button) <{ $isActive: boolean }>`
  margin-bottom: 8px;
  border: none;
  border-radius: 12px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  
  background-color: ${props => props.$isActive
    ? 'var(--apollon-primary)'
    : 'transparent'};
  color: ${props => props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-secondary)'};
  
  &:hover {
    background-color: ${props => props.$isActive
    ? 'var(--apollon-primary)'
    : 'var(--apollon-background-variant)'};
    color: ${props => props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-primary-contrast)'};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &:active, &:focus {
    background-color: ${props => props.$isActive
    ? 'var(--apollon-primary)'
    : 'var(--apollon-background-variant)'};
    border: none;
    box-shadow: none;
  }
`;

const Divider = styled.hr`
  width: 30px;
  border: 0;
  border-top: 1px solid var(--apollon-switch-box-border-color);
  margin: 12px 0;
`;

const GIcon = styled.span`
  font-size: 20px;
  font-weight: bold;
  font-family: 'Arial', sans-serif;
`;

type SidebarItemType = UMLDiagramType | 'home' | 'settings' | 'graphical-ui-editor' | 'quantum-editor';

interface SidebarItem {
  type: SidebarItemType;
  label: string;
  icon: React.ReactNode;
  path?: string;
}

const QuantumSVG = (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 256 256" enableBackground="new 0 0 256 256" xmlSpace="preserve" width="24" height="24">
    <g><g><path fill="currentColor" d="M13.2,191.6c6.2,10.8,20.3,16.5,40.5,16.5l0,0c9.1,0,19.1-1.3,29.6-3.5c10.1,30.8,26.2,50.6,44.7,50.6c18.5,0,34.6-19.7,44.7-50.6c10.5,2.2,20.5,3.5,29.6,3.5l0,0c20.3,0,34.3-5.7,40.5-16.5c8.1-14,0.9-37.5-23.6-63.6c24.5-26.1,31.7-49.6,23.6-63.6c-6.3-10.8-20.3-16.5-40.5-16.5c-9.1,0-19.1,1.3-29.6,3.5C162.6,20.5,146.5,0.7,128,0.7c-18.5,0-34.6,19.7-44.7,50.6c-10.5-2.2-20.5-3.5-29.6-3.5c-20.3,0-34.3,5.7-40.5,16.5c-8.1,14-0.9,37.6,23.6,63.6C12.3,154.1,5.1,177.6,13.2,191.6z M128,247.3c-14.6,0-28-17.5-36.8-44.4c11.9-3,24.4-7.3,36.8-12.7c12.4,5.4,24.9,9.7,36.8,12.7C156,229.8,142.6,247.3,128,247.3z M80.3,128c0-9.3,0.5-18.3,1.4-27c7.1-5,14.6-9.8,22.5-14.4c7.8-4.5,15.8-8.6,23.9-12.2c8,3.6,16,7.7,23.9,12.2c7.9,4.6,15.4,9.4,22.5,14.4c0.8,8.7,1.3,17.7,1.3,27c0,9.2-0.5,18.3-1.3,27c-7.1,5-14.6,9.8-22.5,14.3c-7.8,4.5-15.8,8.6-23.9,12.2c-8-3.6-16.1-7.7-23.9-12.2c-7.9-4.6-15.4-9.4-22.5-14.3C80.8,146.3,80.3,137.3,80.3,128z M73.1,148.9C64,142,55.7,135,48.6,128c7.2-7,15.4-14,24.5-20.9c-0.5,6.8-0.8,13.7-0.8,20.9C72.3,135.1,72.6,142.1,73.1,148.9z M82.8,90.5c1.5-10.7,3.5-20.7,6.1-29.9c9.5,2.4,19.4,5.7,29.3,9.7c-6.1,2.9-12.1,6-18.1,9.5C94,83.3,88.3,86.9,82.8,90.5z M137.8,70.3c9.9-4,19.8-7.3,29.3-9.7c2.5,9.1,4.6,19.2,6.1,29.9c-5.5-3.6-11.2-7.2-17.3-10.7C149.9,76.4,143.9,73.3,137.8,70.3z M182.9,107.1c9.1,6.9,17.4,13.9,24.5,20.9c-7.2,7-15.4,14-24.5,20.9c0.5-6.8,0.8-13.7,0.8-20.9C183.7,120.9,183.4,113.9,182.9,107.1z M173.2,165.5c-1.5,10.7-3.5,20.7-6.1,29.9c-9.5-2.4-19.4-5.7-29.3-9.7c6.1-2.9,12.1-6,18.1-9.4C162,172.7,167.7,169.1,173.2,165.5z M100.2,176.2c5.9,3.4,12,6.5,18.1,9.4c-9.9,4-19.8,7.3-29.3,9.7c-2.6-9.1-4.6-19.2-6.1-29.9C88.3,169.1,94,172.7,100.2,176.2z M235.9,187.7c-4.7,8.1-16.6,12.6-33.6,12.6c-8.4,0-17.6-1.2-27.3-3.1c3.1-11.3,5.5-23.9,7-37.4c12.3-8.6,22.7-17.2,31.4-25.7C233.4,155.3,243,175.5,235.9,187.7z M202.3,55.8c17,0,29,4.5,33.6,12.6c7,12.2-2.5,32.4-22.6,53.7c-8.7-8.4-19-17.1-31.4-25.7c-1.5-13.5-3.8-26.1-7-37.4C184.6,56.9,193.9,55.8,202.3,55.8z M128,8.7c14.6,0,28,17.5,36.8,44.4c-12,3-24.4,7.3-36.8,12.7c-12.4-5.4-24.9-9.7-36.8-12.7C100,26.2,113.4,8.7,128,8.7z M20.1,68.3c4.7-8.1,16.6-12.6,33.7-12.6c8.4,0,17.6,1.2,27.3,3.1c-3.1,11.3-5.5,23.9-7,37.4C61.8,105,51.4,113.6,42.7,122C22.6,100.7,13.1,80.5,20.1,68.3z M42.7,133.9c8.7,8.4,19,17.1,31.4,25.7c1.5,13.5,3.8,26.1,7,37.4c-9.7,2-18.9,3.1-27.3,3.1l0,0c-17,0-29-4.5-33.7-12.6C13.1,175.5,22.6,155.3,42.7,133.9z"/><path fill="currentColor" d="M128,147.9c11,0,19.9-8.9,19.9-19.9c0-11-8.9-19.9-19.9-19.9c-11,0-19.9,8.9-19.9,19.9C108.1,139,117,147.9,128,147.9z M128,116.1c6.6,0,11.9,5.4,11.9,11.9c0,6.6-5.4,11.9-11.9,11.9c-6.6,0-11.9-5.4-11.9-11.9C116.1,121.4,121.4,116.1,128,116.1z"/></g></g>
  </svg>
);

const sidebarItems: SidebarItem[] = [
  // { type: 'home', label: 'Home', icon: <House size={20} />, path: '/' },
  { type: UMLDiagramType.ClassDiagram, label: 'Class Diagram', icon: <Diagram3 size={20} /> },
  { type: UMLDiagramType.ObjectDiagram, label: 'Object Diagram', icon: <Diagram2 size={20} /> },
  { type: UMLDiagramType.StateMachineDiagram, label: 'State Machine', icon: <ArrowRepeat size={20} /> },
  { type: UMLDiagramType.AgentDiagram, label: 'Agent Diagram', icon: <Robot size={20} /> },
  { type: 'graphical-ui-editor', label: 'Graphical UI', icon: <PencilSquare size={20} />, path: '/graphical-ui-editor' },
  { type: 'quantum-editor', label: 'Quantum Circuit', icon: QuantumSVG, path: '/quantum-editor' },
  { type: 'settings', label: 'Project Settings', icon: <Gear size={20} />, path: '/project-settings' },
];

export const DiagramTypeSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Use the new project-based state management
  const {
    currentProject,
    currentDiagram,
    currentDiagramType,
    switchDiagramType
  } = useProject();


  const handleItemClick = (item: SidebarItem) => {
    // Handle navigation items (home, settings, graphical-ui-editor, quantum-editor)
    if (item.path) {
      navigate(item.path);
      return;
    }

    // This should not happen with current setup, but let's be safe
    if (item.type === 'home' || item.type === 'settings' || item.type === 'graphical-ui-editor' || item.type === 'quantum-editor') {
      return;
    }

    const diagramType = item.type as UMLDiagramType;

    // If we're not on the editor page, navigate there first
    if (location.pathname !== '/') {
      navigate('/');
    }

    // If it's the same type, don't do anything
    if (diagramType === toUMLDiagramType(currentDiagramType)) {
      return;
    }

    // Switch to the selected diagram type using the project hook
    try {
      switchDiagramType(diagramType);
    } catch (error) {
      console.error('Failed to switch diagram type:', error);
    }
  };

  const isItemActive = (item: SidebarItem): boolean => {
    // Handle items with explicit paths
    if (item.path) {
      return location.pathname === item.path;
    }

    // For UML diagram types, check if we're on main editor and this is the active type
    if (item.type === UMLDiagramType.AgentDiagram) {
      return location.pathname === '/' && toUMLDiagramType(currentDiagramType) === UMLDiagramType.AgentDiagram;
    }
    if (item.path) {
      return location.pathname === item.path;
    }

    if (item.type === 'home') {
      return location.pathname === '/';
    }

    if (location.pathname === '/' && item.type === toUMLDiagramType(currentDiagramType)) {
      return true;
    }

    return false;
  };

  return (
    <SidebarContainer>
      {sidebarItems.map((item, index) => {
        const isActive = isItemActive(item);
        const isDividerAfter = index === sidebarItems.length - 2; // Only before settings

        return (
          <React.Fragment key={item.type}>
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id={`tooltip-${item.type}`}>
                  {item.label}
                </Tooltip>
              }
            >
              <SidebarButton
                variant="link"
                $isActive={isActive}
                onClick={() => handleItemClick(item)}
                title={item.label}
              >
                {item.icon}
              </SidebarButton>
            </OverlayTrigger>
            {isDividerAfter && <Divider />}
          </React.Fragment>
        );
      })}
    </SidebarContainer>
  );
};
