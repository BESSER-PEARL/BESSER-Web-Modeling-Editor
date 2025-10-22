import React, { useState, useRef } from 'react';
import { Button, Modal, Form, Alert, ProgressBar } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { BesserProject } from '../../../types/project';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText } from 'react-bootstrap-icons';
import styled from 'styled-components';
import { importProject } from '../../../services/import/useImportProject';
import { useProject } from '../../../hooks/useProject';

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

const FileIcon = styled.div`
  font-size: 3rem;
  color: #6c757d;
  margin-bottom: 1rem;
`;

const ImportButton = styled(Button)`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
`;

export const ImportProjectModal: React.FC<ModalContentProps> = ({ close }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { loadProject } = useProject();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
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
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const isValidFile = (file: File): boolean => {
    const validExtensions = ['.json', '.py'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import');
      return;
    }

    if (!isValidFile(selectedFile)) {
      setError('Please select a valid JSON or Python (.py) file');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      setImportProgress(25);

      let importedProject: BesserProject;

      if (selectedFile.name.toLowerCase().endsWith('.json')) {
        importedProject = await importProject(selectedFile);
      } else if (selectedFile.name.toLowerCase().endsWith('.py')) {
        importedProject = await importProject(selectedFile);
      } else {
        throw new Error('Unsupported file type');
      }

      setImportProgress(75);
      await loadProject(importedProject.id);
      setImportProgress(100);

      toast.success(`Project "${importedProject.name}" imported successfully!`);

      close();
      navigate('/');
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Import failed: ${errorMessage}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload />;
    return <FileText />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Import Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>

        <DropZone
          $isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <FileIcon>
            {getFileIcon()}
          </FileIcon>
          
          {selectedFile ? (
            <div>
              <h5 className="mb-2">{selectedFile.name}</h5>
              <p className="text-muted mb-0">
                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
              </p>
              <small className="text-success">✓ File selected</small>
            </div>
          ) : (
            <div>
              <h5 className="mb-2">Drop files here or click to browse</h5>
            </div>
          )}
        </DropZone>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.py"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}

        {isImporting && (
          <div className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small className="text-muted">Importing project...</small>
              <small className="text-muted">{importProgress}%</small>
            </div>
            <ProgressBar now={importProgress} animated />
          </div>
        )}

        <div className="mt-4">
          <h6>Supported Formats:</h6>
          <ul className="small text-muted">
            <li><strong>JSON format</strong> (.json file)</li>
            <li><strong>B-UML format</strong> (.py file)</li>
          </ul>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close} disabled={isImporting}>
          Cancel
        </Button>
        <ImportButton 
          variant="primary" 
          onClick={handleImport} 
          disabled={!selectedFile || isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Project'}
        </ImportButton>
      </Modal.Footer>
    </>
  );
};
