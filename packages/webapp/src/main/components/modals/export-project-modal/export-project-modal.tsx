import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { useExportPNG } from '../../../services/export/useExportPng';
import { useExportSVG } from '../../../services/export/useExportSvg';
import { useAppSelector } from '../../store/hooks';
import { toast } from 'react-toastify';
import { ApollonEditorContext } from '../../apollon-editor-component/apollon-editor-context';
import { exportProjectAsSingleBUMLFile } from '../../../services/export/useExportProjectBUML';
import { useProject } from '../../../hooks/useProject';
import { exportProjectById } from '../../../services/export/useExportProjectJSON';
import { ProjectDiagram, SupportedDiagramType } from '../../../types/project';
import styled from 'styled-components';
import { FileEarmarkArrowDown, Image, FileEarmarkCode, FileEarmarkText } from 'react-bootstrap-icons';

// Styled Components - Clean grey/white design
const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  
  [data-theme="dark"] & {
    background: #2b3035;
    border-bottom-color: #495057;
  }
`;

const ModalTitle = styled.h3`
  color: #212529;
  margin: 0;
  font-weight: 600;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  
  [data-theme="dark"] & {
    color: #f8f9fa;
  }
`;

const CloseButton = styled(Button)`
  background: #fff;
  border: 1px solid #dee2e6;
  color: #6c757d;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1.5rem;
  line-height: 1;
  
  &:hover {
    background: #e9ecef;
    border-color: #adb5bd;
    color: #495057;
  }
  
  &:focus {
    background: #e9ecef;
    border-color: #adb5bd;
    color: #495057;
    box-shadow: 0 0 0 0.2rem rgba(108, 117, 125, 0.25);
  }
  
  [data-theme="dark"] & {
    background: #495057;
    border-color: #6c757d;
    color: #f8f9fa;
    
    &:hover {
      background: #6c757d;
      border-color: #adb5bd;
      color: #fff;
    }
    
    &:focus {
      background: #6c757d;
      border-color: #adb5bd;
      color: #fff;
    }
  }
`;

const ModalBody = styled.div`
  background: #ffffff;
  padding: 2rem;
  color: #212529;
  min-height: 500px;
  
  [data-theme="dark"] & {
    background: #212529;
    color: #f8f9fa;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ExportSection = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  
  [data-theme="dark"] & {
    background: #2b3035;
    border-color: #495057;
  }
`;

const SectionTitle = styled.h5`
  color: #212529;
  font-weight: 600;
  font-size: 1.2rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  [data-theme="dark"] & {
    color: #f8f9fa;
  }
`;

const DiagramSelectionBox = styled.div`
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  max-height: 200px;
  overflow-y: auto;
  
  [data-theme="dark"] & {
    background: #343a40;
    border-color: #495057;
  }
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 4px;
    
    [data-theme="dark"] & {
      background: #495057;
    }
  }
  
  &::-webkit-scrollbar-thumb {
    background: #adb5bd;
    border-radius: 4px;
    
    &:hover {
      background: #868e96;
    }
  }
  
  .form-check {
    margin-bottom: 0.75rem;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .form-check-label {
    color: #495057;
    font-weight: 500;
    font-size: 1rem;
    
    [data-theme="dark"] & {
      color: #f8f9fa;
    }
  }
  
  .form-check-input {
    [data-theme="dark"] & {
      background-color: #495057;
      border-color: #6c757d;
    }
  }
`;

const ExportButtonsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: auto;
`;

const ExportButton = styled(Button)`
  padding: 1.25rem;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 1.05rem;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const CurrentDiagramInfo = styled.div`
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  color: #6c757d;
  font-size: 1rem;
  
  strong {
    color: #212529;
  }
  
  [data-theme="dark"] & {
    background: #343a40;
    border-color: #495057;
    color: #adb5bd;
    
    strong {
      color: #f8f9fa;
    }
  }
`;

const InfoText = styled.p`
  color: #6c757d;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  line-height: 1.6;
  
  [data-theme="dark"] & {
    color: #adb5bd;
  }
`;

const ModalFooterStyled = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  padding: 1.25rem 2rem;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  
  [data-theme="dark"] & {
    background: #2b3035;
    border-top-color: #495057;
  }
`;

const FooterContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  small {
    color: #6c757d;
    font-size: 0.95rem;
    
    [data-theme="dark"] & {
      color: #adb5bd;
    }
  }
`;

const ModalContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  max-width: 900px;
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  [data-theme="dark"] & {
    background: #1a1d21;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
`;

const diagramLabels: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  GUINoCodeDiagram: 'GUI No-Code Diagram',
};

const formatsRequiringSelection = new Set(['JSON', 'BUML']);

export const ExportProjectModal: React.FC<ModalContentProps> = ({ close }) => {
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const diagram = useAppSelector((state) => state.diagram.diagram);
  
  // Use the new project system
  const { currentProject } = useProject();
  const [selectedDiagrams, setSelectedDiagrams] = useState<SupportedDiagramType[]>([]);

  const exportAsSVG = useExportSVG();
  const exportAsPNG = useExportPNG();

  const diagramEntries = useMemo<[SupportedDiagramType, ProjectDiagram][]>(
    () =>
      currentProject
        ? (Object.entries(currentProject.diagrams) as [SupportedDiagramType, ProjectDiagram][])
        : [],
    [currentProject]
  );

  useEffect(() => {
    if (diagramEntries.length > 0) {
      // Select all diagrams except GUINoCodeDiagram by default
      setSelectedDiagrams(
        diagramEntries
          .map(([type]) => type)
          .filter(type => type !== 'GUINoCodeDiagram')
      );
    } else {
      setSelectedDiagrams([]);
    }
  }, [diagramEntries]);

  const toggleDiagramSelection = (diagramType: SupportedDiagramType) => {
    setSelectedDiagrams((prev) =>
      prev.includes(diagramType)
        ? prev.filter((type) => type !== diagramType)
        : [...prev, diagramType]
    );
  };

  const handleExport = async (format: string) => {
    if (!editor) {
      toast.error('No diagram available to export');
      return;
    }
    
    if (!currentProject) {
      toast.error('No project available to export');
      return;
    }
    const requiresSelection = formatsRequiringSelection.has(format);
    if (requiresSelection && selectedDiagrams.length === 0) {
      toast.error('Select at least one diagram to export.');
      return;
    }

    try {
      switch (format) {
        case 'SVG':
          await exportAsSVG(editor, diagram.title);
          break;
        case 'PNG_WHITE':
          await exportAsPNG(editor, diagram.title, true);
          break;
        case 'PNG':
          await exportAsPNG(editor, diagram.title, false);
          break;
        case 'JSON':
          await exportProjectById(currentProject, selectedDiagrams);
          break;
        case 'BUML':
          await exportProjectAsSingleBUMLFile(currentProject, selectedDiagrams);
          break;
        default:
          toast.error('Unknown export format.');
          return;
      }
      close();
    } catch (error) {
      toast.error('Export failed.');
    }
  };

  return (
    <ModalContainer onClick={close}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <FileEarmarkArrowDown size={24} style={{ marginRight: '0.5rem' }} />
            Export Project
          </ModalTitle>
          <CloseButton onClick={close} aria-label="Close">
            ×
          </CloseButton>
        </ModalHeader>
        
        <ModalBody>
          <ContentGrid>
            {/* Project Export Section */}
            <ExportSection>
              <SectionTitle>
                <FileEarmarkCode size={24} />
                Multiple Diagrams
              </SectionTitle>
              
              <InfoText>
                Export selected diagrams as a complete project file.
              </InfoText>

              {diagramEntries.length > 0 ? (
                <>
                  <DiagramSelectionBox>
                    <div style={{ color: '#495057', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                      Select Diagrams:
                    </div>
                    {diagramEntries.map(([type, projectDiagram]) => (
                      <Form.Check
                        key={type}
                        type="checkbox"
                        id={`export-diagram-${type}`}
                        label={projectDiagram.title || diagramLabels[type]}
                        checked={selectedDiagrams.includes(type)}
                        onChange={() => toggleDiagramSelection(type)}
                      />
                    ))}
                  </DiagramSelectionBox>
                  
                  <ExportButtonsGrid>
                    <ExportButton
                      variant="primary"
                      size="lg"
                      onClick={() => handleExport('JSON')}
                    >
                      <FileEarmarkText size={22} />
                      Export as JSON
                    </ExportButton>
                    <ExportButton
                      variant="primary"
                      size="lg"
                      onClick={() => handleExport('BUML')}
                    >
                      <FileEarmarkCode size={22} />
                      Export as B-UML
                    </ExportButton>
                  </ExportButtonsGrid>
                </>
              ) : (
                <InfoText style={{ opacity: 0.7, fontStyle: 'italic' }}>
                  No diagrams available in the current project.
                </InfoText>
              )}
            </ExportSection>

            {/* Current Diagram Export Section */}
            <ExportSection>
              <SectionTitle>
                <Image size={24} />
                Current Diagram
              </SectionTitle>
              
              <InfoText>
                Export only the diagram you're currently viewing.
              </InfoText>

              <CurrentDiagramInfo>
                <strong>{diagram.title || 'Untitled'}</strong>
              </CurrentDiagramInfo>

              <ExportButtonsGrid>
                <ExportButton
                  variant="secondary"
                  size="lg"
                  onClick={() => handleExport('SVG')}
                >
                  <FileEarmarkCode size={22} />
                  Export as SVG
                </ExportButton>
                <ExportButton
                  variant="outline-secondary"
                  size="lg"
                  onClick={() => handleExport('PNG_WHITE')}
                >
                  <Image size={22} />
                  Export PNG (White)
                </ExportButton>
                <ExportButton
                  variant="outline-dark"
                  size="lg"
                  onClick={() => handleExport('PNG')}
                >
                  <Image size={22} />
                  Export PNG (Transparent)
                </ExportButton>
              </ExportButtonsGrid>
            </ExportSection>
          </ContentGrid>
        </ModalBody>
        
        <ModalFooterStyled>
          <FooterContent>
            <small>💡 Use JSON/B-UML to backup your entire project</small>
            <Button 
              variant="secondary" 
              onClick={close}
              style={{ fontWeight: 600, padding: '0.5rem 1.5rem' }}
            >
              Close
            </Button>
          </FooterContent>
        </ModalFooterStyled>
      </ModalContent>
    </ModalContainer>
  );
};
