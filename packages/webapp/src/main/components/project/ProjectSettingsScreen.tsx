import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { Download, Trash, Plus } from 'react-bootstrap-icons';
import styled from 'styled-components';
import { settingsService } from '@besser/wme';
import { useProject } from '../../hooks/useProject';
import { SupportedDiagramType } from '../../types/project';

const PageContainer = styled.div`
  padding: 40px 20px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const ProjectCard = styled(Card)`
  width: 100%;
  max-width: 900px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 16px;
  overflow: hidden;
  background-color: var(--apollon-background);
`;

const CardHeader = styled(Card.Header)`
  background: var(--apollon-primary);
  color: var(--apollon-primary-contrast);
  border: none;
  padding: 24px 32px;
  
  h3 {
    margin: 0;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--apollon-primary-contrast);
  }
`;

const CardBody = styled(Card.Body)`
  padding: 32px;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const SectionTitle = styled.h5`
  color: var(--apollon-primary-contrast);
  margin-bottom: 20px;
  font-weight: 600;
  border-bottom: 2px solid var(--apollon-switch-box-border-color);
  padding-bottom: 8px;
`;

const ActionButton = styled(Button)`
  border-radius: 8px;
  font-weight: 500;
  padding: 8px 16px;
  
  &.btn-outline-danger:hover {
    background-color: #dc3545;
    border-color: #dc3545;
  }
`;

const DiagramItem = styled(ListGroup.Item)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--apollon-switch-box-border-color);
  background-color: var(--apollon-list-group-color);
  color: var(--apollon-primary-contrast);
  
  &:hover {
    background-color: var(--apollon-background-variant);
  }
`;

const getDiagramTypeColor = (type: SupportedDiagramType): string => {
  const colors: Record<SupportedDiagramType, string> = {
    'ClassDiagram': 'primary',
    'ObjectDiagram': 'success',
    'StateMachineDiagram': 'warning',
    'AgentDiagram': 'info',
    'GUINoCodeDiagram': 'dark',
  };
  return colors[type] || 'secondary';
};

export const ProjectSettingsScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showInstancedObjects, setShowInstancedObjects] = useState(false);
  const [showAssociationNames, setShowAssociationNames] = useState(false);
  
  // Use the new project hook
  const {
    currentProject,
    updateProject,
    exportProject,
    loading,
    error
  } = useProject();

  // Initialize settings on component mount
  useEffect(() => {
    const instancedObjectsSetting = settingsService.shouldShowInstancedObjects();
    setShowInstancedObjects(instancedObjectsSetting);
    
    const associationNamesSetting = settingsService.shouldShowAssociationNames();
    setShowAssociationNames(associationNamesSetting);
  }, []);

  const handleShowInstancedObjectsToggle = (checked: boolean) => {
    setShowInstancedObjects(checked);
    settingsService.updateSetting('showInstancedObjects', checked);
    toast.success(`Instanced objects ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleShowAssociationNamesToggle = (checked: boolean) => {
    setShowAssociationNames(checked);
    settingsService.updateSetting('showAssociationNames', checked);
    toast.success(`Association names ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleProjectUpdate = (field: string, value: string) => {
    if (!currentProject) return;
    
    try {
      updateProject({ [field]: value } as any);
      // toast.success('Project updated successfully!');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const handleExportProject = async () => {
    if (!currentProject) return;
    
    try {
      setIsLoading(true);
      
      // Force GrapesJS to save before exporting (if editor is active)
      const GraphicalUIEditor = (window as any).editor;
      if (GraphicalUIEditor && currentProject.currentDiagramType === 'GUINoCodeDiagram') {
        console.log('[Export] Forcing GrapesJS save before export...');
        
        // Wait for the store operation to complete
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('GrapesJS save timeout'));
          }, 5000);
          
          GraphicalUIEditor.store((result: any) => {
            clearTimeout(timeout);
            console.log('[Export] GrapesJS save completed');
            // Add a longer delay to ensure storage writes complete to localStorage
            setTimeout(() => resolve(), 300);
          });
        });
      }
      
      // Export with force refresh to get the latest data from localStorage
      await exportProject(currentProject.id, true);
      toast.success('Project exported successfully!');
    } catch (error) {
      console.error('Error exporting project:', error);
      toast.error(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <ProjectCard>
          <CardHeader>
            <h3>Project Settings</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center text-muted">
              <p>Loading project...</p>
            </div>
          </CardBody>
        </ProjectCard>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ProjectCard>
          <CardHeader>
            <h3>Project Settings</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center text-danger">
              <p>Error: {error}</p>
            </div>
          </CardBody>
        </ProjectCard>
      </PageContainer>
    );
  }

  if (!currentProject) {
    return (
      <PageContainer>
        <ProjectCard>
          <CardHeader>
            <h3>Project Settings</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center text-muted">
              <p>No project found. Please create a new project first.</p>
            </div>
          </CardBody>
        </ProjectCard>
      </PageContainer>
    );
  }

  // Get all diagrams from the current project
  const diagrams = Object.entries(currentProject.diagrams).map(([type, diagram]) => ({
    ...diagram,
    type
  }));

  return (
    <PageContainer>
      <ProjectCard>
        <CardHeader>
          <h3>Project Settings</h3>
        </CardHeader>
        <CardBody>
          <Form>
            <SectionTitle>General Information</SectionTitle>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Project Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentProject.name}
                    onChange={(e) => handleProjectUpdate('name', e.target.value)}
                    placeholder="Enter project name"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Owner</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentProject.owner}
                    onChange={(e) => handleProjectUpdate('owner', e.target.value)}
                    placeholder="Project owner"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={currentProject.description}
                onChange={(e) => handleProjectUpdate('description', e.target.value)}
                placeholder="Project description"
              />
            </Form.Group>

            <SectionTitle>Project Diagrams ({diagrams.length})</SectionTitle>
            <ListGroup className="mb-4">
              {diagrams.map((diagram) => (
                <DiagramItem key={diagram.type}>
                  <div>
                    <strong>{diagram.title}</strong>
                    <div className="small text-muted">
                      Last updated: {new Date(diagram.lastUpdate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg={getDiagramTypeColor(diagram.type as SupportedDiagramType)}>
                      {diagram.type.replace('Diagram', '')}
                    </Badge>
                    {/* Note: In V2 architecture, diagrams are always part of project and cannot be deleted individually */}
                    <span className="small text-muted">Built-in diagram</span>
                  </div>
                </DiagramItem>
              ))}
            </ListGroup>

            <SectionTitle>Project Information</SectionTitle>
            <Row>
              <Col md={6}>
                <div className="mb-3">
                  <strong>Created:</strong> {new Date(currentProject.createdAt).toLocaleDateString()}
                </div>
                <div className="mb-3">
                  <strong>Project ID:</strong> <code>{currentProject.id}</code>
                </div>
              </Col>
              <Col md={6}>
                <div className="mb-3">
                  <strong>Diagrams Count:</strong> {diagrams.length}
                </div>
                <div className="mb-3">
                  <strong>Current Diagram:</strong> {currentProject.currentDiagramType.replace('Diagram', '')}
                </div>
              </Col>
            </Row>

            <SectionTitle>Display Settings</SectionTitle>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="show-instanced-objects"
                label="Show Instanced Objects"
                checked={showInstancedObjects}
                onChange={(e) => handleShowInstancedObjectsToggle(e.target.checked)}
              />
              <Form.Text className="text-muted">
                Toggle the visibility of instanced objects in diagrams
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="switch"
                id="show-association-names"
                label="Show Association Names"
                checked={showAssociationNames}
                onChange={(e) => handleShowAssociationNamesToggle(e.target.checked)}
              />
              <Form.Text className="text-muted">
                Toggle the visibility of association names in class diagrams
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-3 mt-4">
              <ActionButton
                variant="outline-primary"
                onClick={handleExportProject}
                disabled={isLoading}
                className="d-flex align-items-center gap-2"
              >
                <Download size={16} />
                {isLoading ? 'Exporting...' : 'Export Project'}
              </ActionButton>
            </div>
          </Form>
        </CardBody>
      </ProjectCard>
    </PageContainer>
  );
};
