import React, { useRef, useState, useEffect } from 'react';
import { Nav, Badge } from 'react-bootstrap';
import { Upload, CheckCircle, XCircle } from 'react-bootstrap-icons';
import { diagramBridge, UMLDiagramType } from '@besser/wme';
import { useAppSelector } from '../../../store/hooks';
import { LocalStorageRepository } from '../../../services/local-storage/local-storage-repository';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const ClassDiagramInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  margin-right: 15px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const ImportButton = styled(Nav.Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px !important;
  border-radius: 8px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9) !important;
  font-weight: 500;
  font-size: 0.9rem;
  
  &:hover {
    color: #fff !important;
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const CloseButton = styled(Badge)`
  cursor: pointer;
  background: rgba(255, 255, 255, 0.15) !important;
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(239, 68, 68, 0.2) !important;
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const StatusIndicator = styled.div<{ $hasData: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${props => props.$hasData ? '#4ade80' : '#f87171'};
  font-weight: 500;
  transition: color 0.3s ease;
`;

export const ClassDiagramImporter: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasClassData, setHasClassData] = useState(false);
  const [classDiagramTitle, setClassDiagramTitle] = useState<string>('');
  const currentType = useAppSelector((state) => state.diagram.editorOptions.type);

  // Check for class diagram data on component mount and when diagram type changes
  useEffect(() => {
    updateClassDiagramStatus();
  }, [currentType]);

  const updateClassDiagramStatus = () => {
    const hasData = diagramBridge.hasClassDiagramData();
    setHasClassData(hasData);

    if (hasData) {
      // Try to get the class diagram title from localStorage
      const classDiagram = LocalStorageRepository.loadDiagramByType(UMLDiagramType.ClassDiagram);
      if (classDiagram?.title) {
        setClassDiagramTitle(classDiagram.title);      } else {
        // Fallback: use default title since class diagram data doesn't contain title
        setClassDiagramTitle('Class Diagram');
      }
    } else {
      setClassDiagramTitle('');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;    try {
      const fileContent = await file.text();
      const diagramData = JSON.parse(fileContent);

      // Validate that this is a class diagram
      // Check both the root level type and model.type for compatibility
      const diagramType = diagramData.type || diagramData.model?.type;
      if (diagramType !== UMLDiagramType.ClassDiagram) {
        toast.error('Please select a valid Class Diagram file');
        return;
      }

      // Store the class diagram in localStorage for persistence
      LocalStorageRepository.storeDiagramByType(UMLDiagramType.ClassDiagram, diagramData);

      // Update the bridge service
      if (diagramData.model) {
        diagramBridge.setClassDiagramData(diagramData.model);
        setClassDiagramTitle(diagramData.title || 'Imported Class Diagram');
        setHasClassData(true);
        
        toast.success(`Class diagram "${diagramData.title || 'Untitled'}" imported successfully!`);
      } else {
        toast.error('Invalid class diagram format');
      }
    } catch (error) {
      console.error('Error importing class diagram:', error);
      toast.error('Failed to import class diagram. Please check the file format.');
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearClassDiagram = () => {
    diagramBridge.clearDiagramData();
    LocalStorageRepository.removeDiagramByType(UMLDiagramType.ClassDiagram);
    setHasClassData(false);
    setClassDiagramTitle('');
    toast.info('Class diagram data cleared');
  };

  // Only show when working with object diagrams
  if (currentType !== UMLDiagramType.ObjectDiagram) {
    return null;
  }

  return (
    <>
      <Nav.Item>
        <ImportButton onClick={handleImportClick} title="Import Class Diagram for Object Modeling">
          <Upload size={16} />
          Import Class
        </ImportButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileImport}
        />
      </Nav.Item>
      
      {hasClassData && (
        <ClassDiagramInfo>
          <StatusIndicator $hasData={hasClassData}>
            <CheckCircle size={16} />
            <span>Class: {classDiagramTitle}</span>
          </StatusIndicator>
          <CloseButton 
            onClick={clearClassDiagram}
            title="Clear class diagram data"
          >
            ×
          </CloseButton>
        </ClassDiagramInfo>
      )}
      
      {!hasClassData && currentType === UMLDiagramType.ObjectDiagram && (
        <ClassDiagramInfo>
          <StatusIndicator $hasData={false}>
            <XCircle size={16} />
            <span>No Class Diagram</span>
          </StatusIndicator>
        </ClassDiagramInfo>
      )}
    </>
  );
};
