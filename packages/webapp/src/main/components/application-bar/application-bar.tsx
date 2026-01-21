import React, { ChangeEvent, useEffect, useState, useContext } from 'react';
import { Nav, Navbar } from 'react-bootstrap';
import { FileMenu } from './menues/file-menu';
import { HelpMenu } from './menues/help-menu';
import { CommunityMenu } from './menues/community-menu';
import { ThemeSwitcherMenu } from './menues/theme-switcher-menu';
import styled from 'styled-components';
import { appVersion } from '../../application-constants';
import { APPLICATION_SERVER_VERSION, DEPLOYMENT_URL } from '../../constant';
import { ModalContentType } from '../modals/application-modal-types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCreateNewEditor, setDisplayUnpublishedVersion, updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { showModal } from '../../services/modal/modalSlice';
import { LayoutTextSidebarReverse, Github, Share, House } from 'react-bootstrap-icons';
import { ClassDiagramImporter } from './menues/class-diagram-importer';
import { GenerateCodeMenu } from './menues/generate-code-menu';
import { validateDiagram } from '../../services/validation/validateDiagram';
import { UMLDiagramType } from '@besser/wme';
import { displayError } from '../../services/error-management/errorManagementSlice';
import { toast } from 'react-toastify';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useProject } from '../../hooks/useProject';
import { isUMLModel } from '../../types/project';

const DiagramTitle = styled.input`
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 6px 12px;
  transition: all 0.3s ease;
  max-width: 200px;
  min-width: 120px;
  
  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
`;

const ProjectName = styled.div`
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 10px;
  margin-left: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  display: flex;
  align-items: center;
  
  &::before {
    content: "📁";
    margin-right: 6px;
    font-size: 0.8rem;
  }
`;

export const ApplicationBar: React.FC<{ onOpenHome?: () => void }> = ({ onOpenHome }) => {
  const dispatch = useAppDispatch();
  const { diagram } = useAppSelector((state) => state.diagram);
  const [diagramTitle, setDiagramTitle] = useState<string>(diagram?.title || '');
  const urlPath = window.location.pathname;
  const tokenInUrl = urlPath.substring(1); // This removes the leading "/"
  const currentType = useAppSelector((state) => state.diagram.editorOptions.type);
  const navigate = useNavigate();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const location = useLocation();
  const { currentProject } = useProject();

  useEffect(() => {
    if (diagram?.title) {
      setDiagramTitle(diagram.title);
    }
  }, [diagram?.title]);

  const changeDiagramTitlePreview = (event: ChangeEvent<HTMLInputElement>) => {
    setDiagramTitle(event.target.value);
  };

  const changeDiagramTitleApplicationState = () => {
    if (diagram) {
      dispatch(updateDiagramThunk({ title: diagramTitle }));
    }
  };

  const handleQualityCheck = async () => {
    // For quantum circuits, diagram.model contains the circuit data
    // For UML diagrams, editor.model contains the model data
    if (diagram?.model && !isUMLModel(diagram.model)) {
      // Non-UML diagram (like quantum circuit) - pass model directly
      await validateDiagram(null, diagram.title, diagram.model);
    } else if (editor) {
      // UML diagram - use editor
      await validateDiagram(editor, diagram.title);
    } else {
      toast.error('No diagram available to validate');
    }
  };

  const openGitHubRepo = () => {
    window.open('https://github.com/BESSER-PEARL/BESSER', '_blank');
  };

  return (
    <>
      <Navbar className="navbar" variant="dark" expand="lg">
        <Navbar.Brand as={Link} to="/">
          <img alt="" src="images/logo.png" width="124" height="33" className="d-inline-block align-top" />{' '}
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Item className="me-3">
              <Nav.Link onClick={onOpenHome} title="Home">
              <House size={20} />
            </Nav.Link>
            </Nav.Item>
            <FileMenu />
            {/* <ClassDiagramImporter /> */}
            {/* Ensure all diagram types have access to GenerateCodeMenu and Quality Check */}
            <>
              <GenerateCodeMenu />
              {APPLICATION_SERVER_VERSION && (
                <Nav.Item>
                  <Nav.Link onClick={handleQualityCheck}>Quality Check</Nav.Link>
                </Nav.Item>
              )}
            </>
            {/* {APPLICATION_SERVER_VERSION && (
              <Nav.Item>
                <Nav.Link onClick={handleQuickShare} title="Store and share your diagram into the database">
                  Save & Share
                </Nav.Link>
              </Nav.Item>
            )} */}
            <CommunityMenu />
            <HelpMenu />
            <DiagramTitle
              type="text"
              value={diagramTitle}
              onChange={changeDiagramTitlePreview}
              onBlur={changeDiagramTitleApplicationState}
              placeholder="Diagram Title"
            />
          </Nav>
        </Navbar.Collapse>
        <Nav.Item className="me-3">
          <Nav.Link onClick={openGitHubRepo} title="View on GitHub">
            <Github size={20} />
          </Nav.Link>
        </Nav.Item>
        <ThemeSwitcherMenu />
      </Navbar>
    </>
  );
};
