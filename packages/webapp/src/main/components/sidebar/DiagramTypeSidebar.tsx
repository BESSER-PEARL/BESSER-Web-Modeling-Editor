import React, { useEffect, useState } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  Diagram3,
  Diagram2,
  Robot,
  ArrowRepeat,
  Gear,
  PencilSquare,
  House,
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
  { type: UMLDiagramType.UserDiagram, label: 'User Diagram', icon: <Person size={20} /> },
  { type: 'graphical-ui-editor', label: 'Graphical UI', icon: <PencilSquare size={20} />, path: '/graphical-ui-editor' },
  { type: 'settings', label: 'Project Settings', icon: <Gear size={20} />, path: '/project-settings' },

];

export const DiagramTypeSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAgentMenu, setShowAgentMenu] = useState(false);

  // Use the new project-based state management
  const {
    currentProject,
    currentDiagram,
    currentDiagramType,
    switchDiagramType
  } = useProject();

  useEffect(() => {
    if (!showAgentMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('agent-menu-modal');
      if (menu && !menu.contains(event.target as Node)) {
        setShowAgentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showAgentMenu]);


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
      setShowAgentMenu(true);
      return;
    }
    // Handle navigation items (home, settings, agent-config)
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

  const handleAgentMenuSelect = (choice: 'diagram' | 'config' | 'personalization') => {
    setShowAgentMenu(false);
    if (choice === 'diagram') {
      // Switch to Agent Diagram as usual
      try {
        switchDiagramType(UMLDiagramType.AgentDiagram);
        if (location.pathname !== '/') {
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to switch diagram type:', error);
      }
    } else if (choice === 'config') {
      // Navigate to agent config editor (replace with your actual path)
      navigate('/agent-config');
    } else if (choice === 'personalization') {
      // Navigate to agent personalization editor (replace with your actual path)
      navigate('/agent-personalization');
    }
  };

  const isItemActive = (item: SidebarItem): boolean => {
    // Only highlight Agent Diagram if not on /agent-config
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

      {/* Agent menu modal/dropdown */}
      {showAgentMenu && (
        <>
          {/* Overlay to block interaction with other elements */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.15)',
              zIndex: 9999,
            }}
          />
          <div
            id="agent-menu-modal"
            style={{
              position: 'fixed',
              left: 70,
              top: 100,
              zIndex: 10000,
              background: 'var(--apollon-background)',
              border: '1px solid var(--apollon-switch-box-border-color)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '16px 24px',
              minWidth: 250,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Choose Agent View</div>
            <Button
              variant={location.pathname === '/' ? 'primary' : 'outline-primary'}
              style={{ width: '100%', marginBottom: 8 }}
              onClick={() => handleAgentMenuSelect('diagram')}
            >
              Agent Diagram
            </Button>
            <Button
              variant={location.pathname === '/agent-config' ? 'primary' : 'outline-primary'}
              style={{ width: '100%' }}
              onClick={() => handleAgentMenuSelect('config')}
            >
              Agent Configuration
            </Button>
            <Button
              variant={location.pathname === '/agent-personalization' ? 'primary' : 'outline-primary'}
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => handleAgentMenuSelect('personalization')}
            >
              Agent Personalization
            </Button>
            <Button
              variant="link"
              style={{ width: '100%', marginTop: 8, color: '#888' }}
              onClick={() => setShowAgentMenu(false)}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </SidebarContainer>
  );
};
