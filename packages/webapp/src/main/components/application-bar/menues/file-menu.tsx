import React, { useContext } from 'react';
import { useImportDiagramPictureFromImage } from '../../../services/import/useImportDiagramPicture';
import { useImportDiagramFromKG } from '../../../services/import/useImportDiagramKG';
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
import { toast } from 'react-toastify';
import { importProject } from '../../../services/import/useImportProject';
import { useImportDiagramToProjectWorkflow } from '../../../services/import/useImportDiagram';
import { useProject } from '../../../hooks/useProject';

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
  const handleImportDiagramToProject = useImportDiagramToProjectWorkflow();
  const importDiagramPictureFromImage = useImportDiagramPictureFromImage();
  const importDiagramFromKG = useImportDiagramFromKG();

  // Modal state for feedback and input
  const [importModalType, setImportModalType] = React.useState<'image' | 'kg' | null>(null);
  const [apiKey, setApiKey] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState('');
  const [isImporting, setIsImporting] = React.useState(false);

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

  const handleImportDiagramPictureToCurrentProject = React.useCallback(() => {
    setImportModalType('image');
    setApiKey('');
    setSelectedFile(null);
    setFileError('');
  }, []);

  const handleImportKGToCurrentProject = React.useCallback(() => {
    setImportModalType('kg');
    setApiKey('');
    setSelectedFile(null);
    setFileError('');
  }, []);


  // File input change handler (PNG/JPEG only)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // KG File input change handler (TTL/JSON only)
  const handleKGFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const allowedTypes = ['application/json', 'text/turtle', 'application/x-turtle'];
      const allowedExtensions = ['.json', '.ttl'];
       const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setFileError('Only TTL or JSON files are allowed.');
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
      setImportModalType(null);
    } catch (error) {
      setImportModalType(null);
    } finally {
      setIsImporting(false);
    }
  };

  // Handler for Import KG button in modal
  const handleImportDiagramFromKG = async () => {
    if (!selectedFile || !apiKey || fileError) return;
    setIsImporting(true);
    try {
      const result = await importDiagramFromKG(selectedFile, apiKey);
      toast.success(result.message);
      toast.info(`Imported diagram type: ${result.diagramType}`);
      setImportModalType(null);
    } catch (error) {
      setImportModalType(null);
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

        {/* Import Single Diagram from KG to Project - only show when a project is active */}
        {currentProject && (
          <>
            {/* <NavDropdown.Divider /> */}
            <NavDropdown.Item 
              onClick={handleImportKGToCurrentProject}
              title="Import and convert a Knowledge Graph (KG) into a class diagram and add it to the current project"
            >
              Import Class Diagram from KG to Project
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

      </NavDropdown>

      {/* Import from Image Modal */}
      {importModalType === 'image' && (
        <Modal show onHide={() => setImportModalType(null)}>
          <Modal.Header closeButton>
            <Modal.Title>Import Class Diagram from Image</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isImporting ? (
              <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 80 }}>
                <Spinner animation="border" role="status" aria-label="Importing..." />
              </div>
            ) : (
              <>
                <p className="mb-3 text-muted">
                  OpenAI's GPT will be used as a large language model (LLM) to automatically extract the class diagram
                  from your uploaded image and import it into the modeling environment.
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
                      onChange={handleImageFileChange}
                    />
                    {fileError && <div className="text-danger mt-1">{fileError}</div>}
                    {selectedFile && <div className="mt-1">Selected file: {selectedFile.name}</div>}
                  </div>
                </form>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-secondary" onClick={() => setImportModalType(null)} disabled={isImporting}>
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
      )}

      {/* Import from KG Modal */}
      {importModalType === 'kg' && (
        <Modal show onHide={() => setImportModalType(null)}>
          <Modal.Header closeButton>
            <Modal.Title>Import Class Diagram from Knowledge Graph (KG)</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isImporting ? (
              <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 80 }}>
                <Spinner animation="border" role="status" aria-label="Importing..." />
              </div>
            ) : (
              <>
                <p className="mb-3 text-muted">
                  OpenAI's GPT will be used as a large language model (LLM) to automatically extract the class diagram
                  from your uploaded Knowledge Graph and import it into the modeling environment.
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
                    <label htmlFor="diagram-kg-file" className="form-label">Upload Knowledge Graph (TTL or JSON)</label>
                    <input
                      type="file"
                      className="form-control"
                      id="diagram-kg-file"
                      accept=".ttl,.json"
                      onChange={handleKGFileChange}
                    />
                    {fileError && <div className="text-danger mt-1">{fileError}</div>}
                    {selectedFile && <div className="mt-1">Selected file: {selectedFile.name}</div>}
                  </div>
                </form>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-secondary" onClick={() => setImportModalType(null)} disabled={isImporting}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!apiKey || !selectedFile || !!fileError || isImporting}
              onClick={handleImportDiagramFromKG}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
};
