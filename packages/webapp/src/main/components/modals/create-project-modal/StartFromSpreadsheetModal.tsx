import React, { useState, useRef } from 'react';
import { Button, Modal, Form, Row, Col } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useProject } from '../../../hooks/useProject';
import { isUMLModel } from '../../../types/project';
import { useAppDispatch } from '../../store/hooks';
import { loadDiagram } from '../../../services/diagram/diagramSlice';
import { useNavigate } from 'react-router-dom';
import { useImportDiagramToProject } from '../../../services/import/useImportDiagram';
import { BACKEND_URL } from '../../../constant';

const DropZone = styled.div<{ $isDragOver: boolean }>`
  border: 2px dashed ${props => props.$isDragOver ? '#667eea' : '#dee2e6'};
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  background: ${props => props.$isDragOver ? 'rgba(102, 126, 234, 0.05)' : '#f8f9fa'};
  transition: all 0.3s ease;
  cursor: pointer;
  &:hover {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.05);
  }
`;

export const StartFromSpreadsheetModal: React.FC<ModalContentProps> = ({ close }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    owner: '',
    description: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const { createProject, loading, error } = useProject();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const importDiagramToProject = useImportDiagramToProject();

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error('Please select at least one CSV file to generate the class diagram.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create the project first
      const project = await createProject(
        formData.name.trim(),
        formData.description.trim() || 'New project',
        formData.owner.trim() || 'User'
      );

      // 2. Send CSV files to backend to get domain model JSON
      const formDataObj = new FormData();
      selectedFiles.forEach(file => {
        formDataObj.append('files', file);
      });

      const response = await fetch(`${BACKEND_URL}/csv-to-domain-model`, {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error('Failed to generate domain model from CSV files');
      }
      const diagramJson = await response.json();

      // 3. Import/replace the class diagram in the current project
      // Convert the JSON to a File object for compatibility
      const diagramFile = new File([
        JSON.stringify(diagramJson)
      ], `${formData.name.trim()}_class_diagram.json`, { type: 'application/json' });

      await importDiagramToProject(diagramFile);

      toast.success(`Project "${formData.name}" created and class diagram imported from CSV!`);
      close();
      navigate('/');
    } catch (error) {
      console.error('Error creating project or importing diagram:', error);
      toast.error('Failed to create project or import diagram. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
    setSelectedFiles(files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Start Project from Spreadsheet</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Project Name *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Owner</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Project owner"
                  value={formData.owner}
                  onChange={e => handleInputChange('owner', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Project description (optional)"
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
            />
          </Form.Group>
        </Form>
        <DropZone
          $isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          {selectedFiles.length > 0 ? (
            <div>
              <h5 className="mb-2">Selected files:</h5>
              <ul className="mb-0">
                {selectedFiles.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ul>
              <small className="text-success">✓ File(s) selected</small>
            </div>
          ) : (
            <div>
              <h5 className="mb-2">Drop CSV files here or click to browse</h5>
              <p className="text-muted mb-0">You can select one or more CSV files to generate your initial class diagram.</p>
            </div>
          )}
        </DropZone>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
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
