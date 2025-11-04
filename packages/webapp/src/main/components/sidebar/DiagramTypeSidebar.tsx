import React, { useEffect } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { 
  Diagram3, 
  Diagram2, 
  Robot, 
  ArrowRepeat, 
  Gear,
  PencilSquare,
  House
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

const SidebarButton = styled(Button)<{ $isActive: boolean }>`
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

type SidebarItemType = UMLDiagramType | 'home' | 'settings' | 'graphical-ui-editor';

interface SidebarItem {
  type: SidebarItemType;
  label: string;
  icon: React.ReactNode;
  path?: string;
}

const sidebarItems: SidebarItem[] = [
  // { type: 'home', label: 'Home', icon: <House size={20} />, path: '/' },
  { type: UMLDiagramType.ClassDiagram, label: 'Class Diagram', icon: <Diagram3 size={20} /> },
  { type: UMLDiagramType.ObjectDiagram, label: 'Object Diagram', icon: <Diagram2 size={20} /> },
  { type: UMLDiagramType.StateMachineDiagram, label: 'State Machine', icon: <ArrowRepeat size={20} /> },
  { type: UMLDiagramType.AgentDiagram, label: 'Agent Diagram', icon: <Robot size={20} /> },
  { type: 'graphical-ui-editor', label: 'Graphical UI', icon: <PencilSquare size={20} />, path: '/graphical-ui-editor' },
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
    // Handle navigation items (home, settings, graphical-ui-editor
    if (item.path) {
      navigate(item.path);
      return;
    }

    // This should not happen with current setup, but let's be safe
    if (item.type === 'home' || item.type === 'settings' || item.type === 'graphical-ui-editor') {
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
