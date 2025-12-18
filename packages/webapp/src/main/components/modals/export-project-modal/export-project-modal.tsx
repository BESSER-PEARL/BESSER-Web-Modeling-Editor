import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
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
import { FileEarmarkArrowDown, Image, FileEarmarkCode, FileEarmarkText, X } from 'react-bootstrap-icons';

// Styled Components - Clean grey/white design
const StyledModal = styled(Modal)`
  .modal-dialog {
    max-width: 700px;
    width: 90vw;
    margin: 1.5rem auto;
  }
  
  .modal-content {
    background: white;
    border: none;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  }
  
  [data-theme="dark"] & .modal-content {
    background: #1a1d21;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
  
  .modal-body {
    padding: 0;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  
  [data-theme="dark"] & {
    background: #2b3035;
    border-bottom-color: #495057;
  }
`;

const ModalTitle = styled.h3`
  color: #212529;
  margin: 0;
  font-weight: 600;
  font-size: 1.25rem;
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
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1.25rem;
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
  padding: 1.25rem;
  color: #212529;
  
  [data-theme="dark"] & {
    background: #212529;
    color: #f8f9fa;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ExportSection = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 1.25rem;
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
  font-size: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  [data-theme="dark"] & {
    color: #f8f9fa;
  }
`;

const DiagramSelectionBox = styled.div`
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 0.875rem;
  margin-bottom: 1rem;
  max-height: 150px;
  overflow-y: auto;
  
  [data-theme="dark"] & {
    background: #343a40;
    border-color: #495057;
  }
  
  &::-webkit-scrollbar {
    width: 6px;
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
    margin-bottom: 0.5rem;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .form-check-label {
    color: #495057;
    font-weight: 500;
    font-size: 0.875rem;
    
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
  gap: 0.625rem;
  margin-top: auto;
`;

const ExportButton = styled(Button)`
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  
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
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: #6c757d;
  font-size: 0.875rem;
  
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
  font-size: 0.875rem;
  margin-bottom: 1rem;
  line-height: 1.5;
  
  [data-theme="dark"] & {
    color: #adb5bd;
  }
`;

const ModalFooterStyled = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  padding: 0.875rem 1.5rem;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  
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
    font-size: 0.8rem;
    
    [data-theme="dark"] & {
      color: #adb5bd;
    }
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

interface ExportProjectModalProps {
  show: boolean;
  onHide: () => void;
}

export const ExportProjectModal: React.FC<ExportProjectModalProps> = ({ show, onHide }) => {
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
    // For image exports (SVG, PNG), we need the Apollon editor
    const isImageExport = ['SVG', 'PNG_WHITE', 'PNG'].includes(format);
    if (isImageExport && !editor) {
      toast.error('No diagram available to export');
      return;
    }
    
    // For JSON/BUML exports, we need the project data
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
          await exportAsSVG(editor!, diagram.title);
          break;
        case 'PNG_WHITE':
          await exportAsPNG(editor!, diagram.title, true);
          break;
        case 'PNG':
          await exportAsPNG(editor!, diagram.title, false);
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
      onHide();
    } catch (error) {
      toast.error('Export failed.');
    }
  };

  return (
    <StyledModal
      show={show}
      onHide={onHide}
      centered
      backdrop={true}
      keyboard={true}
      aria-labelledby="export-modal-title"
      aria-describedby="export-modal-description"
    >
      <Modal.Body>
        <ModalHeader>
          <ModalTitle id="export-modal-title">
            <FileEarmarkArrowDown size={20} style={{ marginRight: '0.5rem' }} />
            Export Project
          </ModalTitle>
          <CloseButton onClick={onHide} aria-label="Close">
            <X size={16} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <ContentGrid>
            {/* Project Export Section */}
            <ExportSection>
              <SectionTitle>
                <FileEarmarkCode size={18} />
                Multiple Diagrams
              </SectionTitle>

              <InfoText>
                Export selected diagrams as a complete project file.
              </InfoText>

              {diagramEntries.length > 0 ? (
                <>
                  <DiagramSelectionBox>
                    <div style={{ color: '#495057', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.8rem' }}>
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
                      onClick={() => handleExport('JSON')}
                    >
                      <FileEarmarkText size={18} />
                      Export as JSON
                    </ExportButton>
                    <ExportButton
                      variant="primary"
                      onClick={() => handleExport('BUML')}
                    >
                      <FileEarmarkCode size={18} />
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
                <Image size={18} />
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
                  onClick={() => handleExport('SVG')}
                >
                  <FileEarmarkCode size={18} />
                  Export as SVG
                </ExportButton>
                <ExportButton
                  variant="outline-secondary"
                  onClick={() => handleExport('PNG_WHITE')}
                >
                  <Image size={18} />
                  Export PNG (White)
                </ExportButton>
                <ExportButton
                  variant="outline-dark"
                  onClick={() => handleExport('PNG')}
                >
                  <Image size={18} />
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
              onClick={onHide}
              size="sm"
              style={{ fontWeight: 600 }}
            >
              Close
            </Button>
          </FooterContent>
        </ModalFooterStyled>
      </Modal.Body>
    </StyledModal>
  );
};
