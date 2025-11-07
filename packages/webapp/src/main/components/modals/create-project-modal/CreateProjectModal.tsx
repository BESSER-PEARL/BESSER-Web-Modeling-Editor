import React, { useState } from 'react';
import { Button, FormControl, InputGroup, Modal, Form, Row, Col, Card, Badge } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { UMLDiagramType } from '@besser/wme';
import { loadDiagram } from '../../../services/diagram/diagramSlice';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import { 
  Diagram3, 
  Diagram2, 
  Robot, 
  ArrowRepeat, 
  Check2Circle,
  InfoCircle,
  Person,
  FileText,
  Tag,
  Grid3x3Gap
} from 'react-bootstrap-icons';
import { useProject } from '../../../hooks/useProject';
import { isUMLModel } from '../../../types/project';
import { toUMLDiagramType } from '../../../types/project';

// Legacy project type (kept for compatibility)
export interface BesserProject {
  id: string;
  type: 'Project';
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  models: string[];
  settings?: {
    defaultDiagramType?: UMLDiagramType;
    autoSave?: boolean;
    collaborationEnabled?: boolean;
  };
}

const DIAGRAM_ICONS = {
  [UMLDiagramType.ClassDiagram]: Diagram3,
  [UMLDiagramType.ObjectDiagram]: Diagram2,
  [UMLDiagramType.AgentDiagram]: Robot,
  [UMLDiagramType.StateMachineDiagram]: ArrowRepeat,
  'GUI': Grid3x3Gap,
};

export const CreateProjectModal: React.FC<ModalContentProps> = ({ close }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    defaultDiagramType: UMLDiagramType.ClassDiagram,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { createProject, loading, error } = useProject();

  const handleInputChange = (field: string, value: string | UMLDiagramType) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create project using the new architecture
      const project = await createProject(
        formData.name.trim(),
        formData.description.trim() || 'New project',
        formData.owner.trim() || 'User'
      );

      // Load the default diagram type in the editor
      const currentDiagram = project.diagrams[project.currentDiagramType];
      if (isUMLModel(currentDiagram?.model)) {
        // Convert to legacy Diagram format for compatibility with current editor
        const legacyDiagram = {
          id: currentDiagram.id,
          title: currentDiagram.title,
          model: isUMLModel(currentDiagram.model) ? currentDiagram.model : undefined,
          lastUpdate: currentDiagram.lastUpdate,
          description: currentDiagram.description,
        };
        dispatch(loadDiagram(legacyDiagram));
      }

      toast.success(`Project "${formData.name}" created successfully with all diagram types!`);
      close();
      navigate('/');
      
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Create New Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Project Name *</Form.Label>
                <FormControl
                  type="text"
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Owner</Form.Label>
                <FormControl
                  type="text"
                  placeholder="Project owner"
                  value={formData.owner}
                  onChange={(e) => handleInputChange('owner', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <FormControl
              as="textarea"
              rows={3}
              placeholder="Project description (optional)"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Default Diagram Type</Form.Label>
            <Form.Select
              value={formData.defaultDiagramType}
              onChange={(e) => handleInputChange('defaultDiagramType', e.target.value as UMLDiagramType)}
            >
              <option value={UMLDiagramType.ClassDiagram}>Class Diagram</option>
              <option value={UMLDiagramType.ObjectDiagram}>Object Diagram</option>
              <option value={UMLDiagramType.StateMachineDiagram}>State Machine Diagram</option>
              <option value={UMLDiagramType.AgentDiagram}>Agent Diagram</option>
              <option value="GUI">Graphical UI Editor (GUI)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              This will be the active view when you first open the project.
            </Form.Text>
          </Form.Group>

          <Card className="bg-light border-0">
            <Card.Body>
              <div className="d-flex align-items-center mb-2">
                <Check2Circle className="text-success me-2" size={20} />
                <strong>What's included in your project:</strong>
              </div>
              <Row>
                <Col md={6}>
                  <div className="d-flex align-items-center mb-2">
                    <Diagram3 className="text-primary me-2" size={16} />
                    <span className="small">Class Diagram</span>
                  </div>
                  <div className="d-flex align-items-center mb-2">
                    <Diagram2 className="text-success me-2" size={16} />
                    <span className="small">Object Diagram</span>
                  </div>
                  <div className="d-flex align-items-center mb-2">
                    <ArrowRepeat className="text-warning me-2" size={16} />
                    <span className="small">State Machine Diagram</span>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="d-flex align-items-center mb-2">
                    <Robot className="text-info me-2" size={16} />
                    <span className="small">Agent Diagram</span>
                  </div>
                  <div className="d-flex align-items-center mb-2">
                    <Grid3x3Gap className="text-purple me-2" size={16} />
                    <span className="small">Graphical UI Editor</span>
                  </div>
                </Col>
              </Row>
              <div className="mt-2">
                <small className="text-muted">
                  <InfoCircle className="me-1" size={14} />
                  All diagram types and GUI editor are always available. Switch between them anytime.
                </small>
              </div>
            </Card.Body>
          </Card>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close} disabled={isLoading || loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleCreateProject} 
          disabled={!formData.name.trim() || isLoading || loading}
        >
          {(isLoading || loading) ? 'Creating Project...' : 'Create Project'}
        </Button>
      </Modal.Footer>
    </>
  );
};
