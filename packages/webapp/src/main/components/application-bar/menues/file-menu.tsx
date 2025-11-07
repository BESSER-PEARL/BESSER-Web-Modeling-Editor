import React, { useContext } from 'react';
import { useImportDiagramPictureFromImage } from '../../../services/import/useImportDiagramPicture';
import { Dropdown, NavDropdown, Modal, Spinner } from 'react-bootstrap';
import { ApollonEditorContext } from '../../apollon-editor-component/apollon-editor-context';
import { ModalContentType } from '../../modals/application-modal-types';

import { useAppDispatch, useAppSelector } from '../../store/hooks';

import { showModal } from '../../../services/modal/modalSlice';
import { useExportJSON } from '../../../services/export/useExportJson';
import { useExportPDF } from '../../../services/export/useExportPdf';
import { useExportPNG } from '../../../services/export/useExportPng';
import { useExportSVG } from '../../../services/export/useExportSvg';
import { useExportBUML } from '../../../services/export/useExportBuml';
import { useProjectBumlPreview } from '../../../services/export/useProjectBumlPreview';
import { toast } from 'react-toastify';
import { importProject } from '../../../services/import/useImportProject';
import { useImportDiagramToProjectWorkflow } from '../../../services/import/useImportDiagram';
import { useProject } from '../../../hooks/useProject';
import { JsonViewerModal } from '../../modals/json-viewer-modal/json-viewer-modal';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import { useProjectPreviewModal } from './hooks/useProjectPreviewModal';

export const FileMenu: React.FC = () => {
  const apollonEditor = useContext(ApollonEditorContext);
  const dispatch = useAppDispatch();
  const editor = apollonEditor?.editor;
  const diagram = useAppSelector((state) => state.diagram.diagram);
  const { currentProject } = useProject();
  const exportAsSVG = useExportSVG();
  const exportAsPNG = useExportPNG();
  const exportAsPDF = useExportPDF();
  const exportAsJSON = useExportJSON();
  const exportAsBUML = useExportBUML();
  const generateProjectBumlPreview = useProjectBumlPreview();
  const handleImportDiagramToProject = useImportDiagramToProjectWorkflow();
  const importDiagramPictureFromImage = useImportDiagramPictureFromImage();

  // Modal state for feedback and input
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState('');
  const [isImporting, setIsImporting] = React.useState(false);

  const {
    showJsonViewer,
    jsonToView,
    jsonDiagramType,
    bumlPreview,
    bumlPreviewError,
    isBumlPreviewLoading,
    canPreviewBuml,
    bumlPreviewLabel,
    openPreviewModal,
    closePreviewModal,
    handleCopyJson,
    handleDownloadJson,
    handleRequestBumlPreview,
    handleCopyBumlPreview,
    handleDownloadBumlPreview,
  } = useProjectPreviewModal(generateProjectBumlPreview);

  const exportDiagram = async (exportType: 'PNG' | 'PNG_WHITE' | 'SVG' | 'JSON' | 'PDF' | 'BUML'): Promise<void> => {
    if (!editor) {
      toast.error('No diagram available to export');
      return;
    }

    try {
      switch (exportType) {
        case 'SVG':
          await exportAsSVG(editor, diagram.title);
          break;
        case 'PNG_WHITE':
          await exportAsPNG(editor, diagram.title, true);
          break;
        case 'PNG':
          await exportAsPNG(editor, diagram.title, false);
          break;
        case 'PDF':
          await exportAsPDF(editor, diagram.title);
          break;
        case 'JSON':
          await exportAsJSON(editor, diagram);
          break;
        case 'BUML':
          await exportAsBUML(editor, diagram.title);
          break;
      }
    } catch (error) {
      console.error('Error in exportDiagram:', error);
      // toast.error('Export failed. Check console for details.');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to export as BUML: ${errorMessage}`);
    }
  };

  // Placeholder handlers for project actions
  const handleNewProject = () => dispatch(showModal({ type: ModalContentType.CreateProjectModal }));
  const handleImportProject = () => dispatch(showModal({ type: ModalContentType.ImportProjectModal }));
  // const handleLoadProject = () => {
  //   // Open the Home modal to let users select from existing projects
  //   if (onOpenHome) {
  //     onOpenHome();
  //   }
  // };
  const handleLoadTemplate = () => dispatch(showModal({ type: ModalContentType.CreateDiagramFromTemplateModal }));
  const handleExportProject = () => dispatch(showModal({ type: ModalContentType.ExportProjectModal }));

  // Handler for previewing project JSON
  const handlePreviewProjectJSON = async () => {
    if (!currentProject) {
      toast.error('No project is open. Please create or open a project first.');
      return;
    }

    try {
      // Force GrapesJS to save before previewing (if editor is active)
      const GraphicalUIEditor = (window as any).editor;
      if (GraphicalUIEditor && currentProject.currentDiagramType === 'GUINoCodeDiagram') {
        console.log('[Preview] Forcing GrapesJS save before preview...');
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('GrapesJS save timeout'));
          }, 5000);
          
          GraphicalUIEditor.store((result: any) => {
            clearTimeout(timeout);
            console.log('[Preview] GrapesJS save completed');
            setTimeout(() => resolve(), 300);
          });
        });
      }

      // Reload the project from storage to get the latest data
      const freshProject = ProjectStorageRepository.loadProject(currentProject.id);
      if (!freshProject) {
        toast.error('Failed to load project data');
        return;
      }

      // Format the JSON with the same structure as export (V2.0.0 format)
      const exportData = {
        project: freshProject,
        exportedAt: new Date().toISOString(),
        version: '2.0.0'
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      openPreviewModal({
        project: freshProject,
        jsonContent: jsonString,
        diagramLabel: 'Project (V2.0.0)',
      });
    } catch (error) {
      console.error('Error previewing project JSON:', error);
      toast.error(`Failed to preview project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  // Handler for importing single diagram to project
  const handleImportDiagramToCurrentProject = async () => {
    if (!currentProject) {
      toast.error('No project is open. Please create or open a project first.');
      return;
    }

    try {
      const result = await handleImportDiagramToProject();
      toast.success(result.message);
      toast.info(`Imported diagram type: ${result.diagramType}`);
    } catch (error) {
      // Error handling is already done in the workflow function
      console.error('Import failed:', error);
    }
  };

  // Handler for importing diagram picture to project, triggers modal popup
  const handleImportDiagramPictureToCurrentProject = React.useCallback(() => {
    setShowImportModal(true);
    setApiKey('');
    setSelectedFile(null);
    setFileError('');
  }, []);

  // File input change handler (PNG/JPEG only)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        setFileError('Only PNG or JPEG files are allowed.');
        setSelectedFile(null);
      } else {
        setFileError('');
        setSelectedFile(file);
      }
    } else {
      setFileError('');
      setSelectedFile(null);
    }
  };

  // Handler for Import button in modal
  const handleImportDiagramPictureFromImage = async () => {
    if (!selectedFile || !apiKey || fileError) return;
    setIsImporting(true);
    try {
      const result = await importDiagramPictureFromImage(selectedFile, apiKey);
      toast.success(result.message);
      toast.info(`Imported diagram type: ${result.diagramType}`);
      setShowImportModal(false);
    } catch (error) {
      setShowImportModal(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <NavDropdown id="file-menu-item" title="File" className="pt-0 pb-0">
        {/* New */}
        <NavDropdown.Item onClick={handleNewProject}>
          New Project
        </NavDropdown.Item>

        {/* Import */}
        <NavDropdown.Item onClick={handleImportProject}>
          Import Project
        </NavDropdown.Item>

        {/* Import Single Diagram to Project - only show when a project is active */}
        {currentProject && (
          <>
            {/* <NavDropdown.Divider /> */}
            <NavDropdown.Item 
              onClick={handleImportDiagramToCurrentProject}
              title="Import a single diagram JSON file and add it to the current project (useful for converting old diagrams)"
            >
              Import Single Diagram to Project
            </NavDropdown.Item>
          </>
        )}

        {/* Import Single Diagram from Image to Project - only show when a project is active */}
        {currentProject && (
          <>
            {/* <NavDropdown.Divider /> */}
            <NavDropdown.Item 
              onClick={handleImportDiagramPictureToCurrentProject}
              title="Import Class Diagram by uploading an image containing the diagram and add it to the current project"
            >
              Import Class Diagram from Image to Project
            </NavDropdown.Item>
          </>
        )}

        {/* Load */}
        {/* <NavDropdown.Item onClick={handleLoadProject}>
          Load Project
        </NavDropdown.Item> */}

        {/* <NavDropdown.Divider /> */}

        {/* Load Template */}
        <NavDropdown.Item onClick={handleLoadTemplate}>
          Load Template
        </NavDropdown.Item>

        {/* <NavDropdown.Divider /> */}

        {/* Export */}
        <NavDropdown.Item onClick={handleExportProject}>
          Export Project
        </NavDropdown.Item>

        {/* Preview Project JSON - only show when a project is active */}
        {currentProject && (
          <NavDropdown.Item onClick={handlePreviewProjectJSON}>
            Preview Project
          </NavDropdown.Item>
        )}

      </NavDropdown>

      {/* Modal for API key and file upload */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Import Class Diagram from Image</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isImporting && (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 80 }}>
              <Spinner animation="border" role="status" aria-label="Importing...">
                <span className="visually-hidden">Importing...</span>
              </Spinner>
            </div>
          )}
          {!isImporting && (
            <>
              <p className="mb-3 text-muted">
                OpenAI's GPT will be used as a large language model (LLM) to automatically extract the class diagram from your uploaded image and import it into the modeling environment.
              </p>
              <form>
                <div className="mb-3">
                  <label htmlFor="openai-api-key" className="form-label">OpenAI API Key</label>
                  <input
                    type="text"
                    className="form-control"
                    id="openai-api-key"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Enter your OpenAI API key"
                    autoComplete="off"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="diagram-image-file" className="form-label">Upload Diagram Image (PNG or JPEG)</label>
                  <input
                    type="file"
                    className="form-control"
                    id="diagram-image-file"
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                  />
                  {fileError && <div className="text-danger mt-1">{fileError}</div>}
                  {selectedFile && <div className="mt-1">Selected file: {selectedFile.name}</div>}
                </div>
              </form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!apiKey || !selectedFile || !!fileError || isImporting}
            onClick={handleImportDiagramPictureFromImage}
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* JSON Viewer Modal */}
      <JsonViewerModal
        isVisible={showJsonViewer}
        jsonData={jsonToView}
        diagramType={jsonDiagramType}
        onClose={closePreviewModal}
        onCopy={handleCopyJson}
        onDownload={handleDownloadJson}
        enableBumlView={canPreviewBuml}
        bumlData={bumlPreview}
        bumlLabel={bumlPreviewLabel}
        isBumlLoading={isBumlPreviewLoading}
        bumlError={bumlPreviewError}
        onRequestBuml={handleRequestBumlPreview}
        onCopyBuml={handleCopyBumlPreview}
        onDownloadBuml={handleDownloadBumlPreview}
      />
    </>
  );
};
