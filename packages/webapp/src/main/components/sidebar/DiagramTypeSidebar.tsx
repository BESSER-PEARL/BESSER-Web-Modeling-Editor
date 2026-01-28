import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  Diagram3,
  Diagram2,
  Robot,
  ArrowRepeat,
  Gear,
  PencilSquare,
  House,
  Cpu,
  Person
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

const AgentItemWrapper = styled.div<{ $isExpanded: boolean }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: ${props => props.$isExpanded ? 'var(--apollon-primary)' : 'transparent'};
  border-radius: ${props => props.$isExpanded ? '12px' : '0'};
  padding: ${props => props.$isExpanded ? '6px 0 8px 0' : '0'};
  margin-bottom: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

const SidebarButton = styled(Button) <{ $isActive: boolean; $isExpanded?: boolean }>`
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
  
  background-color: ${props => {
    if (props.$isExpanded) return 'rgba(255, 255, 255, 0.2)';
    return props.$isActive ? 'var(--apollon-primary)' : 'transparent';
  }};
  color: ${props => {
    if (props.$isExpanded) return 'var(--apollon-background)';
    return props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-secondary)';
  }};
  
  &:hover {
    background-color: ${props => {
      if (props.$isExpanded) return 'rgba(255, 255, 255, 0.3)';
      return props.$isActive ? 'var(--apollon-primary)' : 'var(--apollon-background-variant)';
    }};
    color: ${props => {
      if (props.$isExpanded) return 'var(--apollon-background)';
      return props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-primary-contrast)';
    }};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &:active, &:focus {
    background-color: ${props => {
      if (props.$isExpanded) return 'rgba(255, 255, 255, 0.2)';
      return props.$isActive ? 'var(--apollon-primary)' : 'var(--apollon-background-variant)';
    }};
    border: none;
    box-shadow: none;
  }
`;

const SubItemsContainer = styled.div<{ $isExpanded: boolean }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-height: ${props => props.$isExpanded ? '500px' : '0'};
  opacity: ${props => props.$isExpanded ? '1' : '0'};
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: ${props => props.$isExpanded ? '4px 8px 0 8px' : '0 8px'};
`;

const SubItemButton = styled(Button)<{ $isActive: boolean }>`
  margin-bottom: 0;
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  
  background-color: ${props => props.$isActive
    ? 'var(--apollon-primary)'
    : 'rgba(255, 255, 255, 0.85)'};
  color: ${props => props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-secondary)'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background-color: ${props => props.$isActive ? 'var(--apollon-primary)' : 'var(--apollon-background)'};
    color: ${props => props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-primary)'};
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  &:active, &:focus {
    background-color: ${props => props.$isActive ? 'var(--apollon-primary)' : 'var(--apollon-background)'};
    color: ${props => props.$isActive ? 'var(--apollon-background)' : 'var(--apollon-primary)'};
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

const sidebarItems: SidebarItem[] = [
  // { type: 'home', label: 'Home', icon: <House size={20} />, path: '/' },
  { type: UMLDiagramType.ClassDiagram, label: 'Class Diagram', icon: <Diagram3 size={20} /> },
  { type: UMLDiagramType.ObjectDiagram, label: 'Object Diagram', icon: <Diagram2 size={20} /> },
  { type: UMLDiagramType.StateMachineDiagram, label: 'State Machine', icon: <ArrowRepeat size={20} /> },
  { type: UMLDiagramType.AgentDiagram, label: 'Agent Diagram', icon: <Robot size={20} /> },
  { type: UMLDiagramType.UserDiagram, label: 'User Diagram', icon: <Person size={20} /> },
  { type: 'graphical-ui-editor', label: 'Graphical UI', icon: <PencilSquare size={20} />, path: '/graphical-ui-editor' },
  { type: 'quantum-editor', label: 'Quantum Circuit', icon: <Cpu size={20} />, path: '/quantum-editor' },
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
    if (item.type === UMLDiagramType.AgentDiagram) {
      try {
        switchDiagramType(UMLDiagramType.AgentDiagram);
        if (location.pathname !== '/') {
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to switch diagram type:', error);
      }
      return;
    }
    
    // Handle navigation items (home, settings, graphical-ui-editor, agent-config, quantum-editor)
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

  const handleAgentSubItemClick = (path: string) => {
    navigate(path);
  };

  const isAgentRelated = () => {
    return toUMLDiagramType(currentDiagramType) === UMLDiagramType.AgentDiagram || 
           location.pathname === '/agent-config' ||
           location.pathname === '/agent-personalization-2';
  };

  const isItemActive = (item: SidebarItem): boolean => {
    // Handle items with explicit paths
    if (item.path) {
      return location.pathname === item.path;
    }

    // For Agent Diagram, only active if on main editor AND agent diagram type
    if (item.type === UMLDiagramType.AgentDiagram) {
      return location.pathname === '/' && toUMLDiagramType(currentDiagramType) === UMLDiagramType.AgentDiagram;
    }

    if (item.type === 'home') {
      return location.pathname === '/';
    }

    // For other diagram types, check if we're on main editor and this is the active type
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
        const isAgentItem = item.type === UMLDiagramType.AgentDiagram;
        const showAgentSubItems = isAgentItem && isAgentRelated();

        return (
          <React.Fragment key={item.type}>
            {isAgentItem ? (
              <AgentItemWrapper $isExpanded={showAgentSubItems}>
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
                    $isExpanded={showAgentSubItems}
                    onClick={() => handleItemClick(item)}
                    title={item.label}
                  >
                    {item.icon}
                  </SidebarButton>
                </OverlayTrigger>
                
                {/* Agent sub-items with smooth animation */}
                <SubItemsContainer $isExpanded={showAgentSubItems}>
                  <OverlayTrigger
                    placement="right"
                    overlay={<Tooltip id="tooltip-agent-config">Agent Configuration</Tooltip>}
                  >
                    <SubItemButton
                      variant="link"
                      $isActive={location.pathname === '/agent-config'}
                      onClick={() => handleAgentSubItemClick('/agent-config')}
                      title="Agent Configuration"
                    >
                      <Gear size={16} />
                    </SubItemButton>
                  </OverlayTrigger>
                  <OverlayTrigger
                    placement="right"
                    overlay={<Tooltip id="tooltip-agent-personalization-2">Agent Personalization</Tooltip>}
                  >
                    <SubItemButton
                      variant="link"
                      $isActive={location.pathname === '/agent-personalization-2'}
                      onClick={() => handleAgentSubItemClick('/agent-personalization-2')}
                      title="Agent Personalization 2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                        <path fill="#020101" d="M19.235 13.234H4.765v3.494L0 11.964l4.765-4.765v3.494h14.47V7.199L24 11.964l-4.765 4.765z" />
                      </svg>
                    </SubItemButton>
                  </OverlayTrigger>
                </SubItemsContainer>
              </AgentItemWrapper>
            ) : (
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
            )}
            
            {isDividerAfter && <Divider />}
          </React.Fragment>
        );
      })}
    </SidebarContainer>
  );
};
