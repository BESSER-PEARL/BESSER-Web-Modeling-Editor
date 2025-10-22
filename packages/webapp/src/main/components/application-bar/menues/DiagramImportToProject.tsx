import React, { useRef } from 'react';
import { Nav, Button } from 'react-bootstrap';
import { Upload, CheckCircle } from 'react-bootstrap-icons';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useImportDiagramToProjectWorkflow } from '../../../services/import/useImportDiagram';
import { useProject } from '../../../hooks/useProject';

const ImportButton = styled(Button)`
  background: none;
  border: none;
  color: var(--apollon-primary-text);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  
  &:hover {
    background: var(--apollon-background-primary);
    color: var(--apollon-primary-text);
    border: none;
  }
  
  &:focus {
    background: var(--apollon-background-primary);
    color: var(--apollon-primary-text);
    border: none;
    box-shadow: none;
  }
`;

const StatusIndicator = styled.div<{ $hasSuccess: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: ${props => props.$hasSuccess ? 'var(--bs-success)' : 'var(--apollon-primary-text)'};
  padding: 8px 12px;
  border-radius: 4px;
  background: ${props => props.$hasSuccess ? 'rgba(25, 135, 84, 0.1)' : 'transparent'};
`;

export const DiagramImportToProject: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentProject } = useProject();
  const handleImportDiagramToProject = useImportDiagramToProjectWorkflow();

  const handleImportClick = () => {
    if (!currentProject) {
      toast.error('No project is open. Please create or open a project first.');
      return;
    }
    
    // Trigger the import workflow
    handleImportDiagramToProject()
      .then((result) => {
        toast.success(result.message);
        // Optionally, you could also show which type of diagram was imported
        toast.info(`Imported diagram type: ${result.diagramType}`);
      })
      .catch((error) => {
        // Error handling is already done in the workflow function
        console.error('Import failed:', error);
      });
  };

  // Only show when a project is active
  if (!currentProject) {
    return null;
  }

  return (
    <Nav.Item>
      <ImportButton 
        onClick={handleImportClick} 
        title="Import a single diagram JSON file into the current project"
      >
        <Upload size={16} />
        Import Diagram to Project
      </ImportButton>
    </Nav.Item>
  );
};
