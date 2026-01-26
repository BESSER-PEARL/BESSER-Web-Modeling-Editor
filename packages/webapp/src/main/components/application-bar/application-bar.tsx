import React, { ChangeEvent, useEffect, useState, useContext } from 'react';
import { Nav, Navbar, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
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
import { LayoutTextSidebarReverse, Github, Share, House, BoxArrowRight } from 'react-bootstrap-icons';

// Custom Sidebar Icon SVG component
const SidebarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fillRule="evenodd" d="M11.28 9.53L8.81 12l2.47 2.47a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 111.06 1.06z"/>
    <path fillRule="evenodd" d="M3.75 2A1.75 1.75 0 002 3.75v16.5c0 .966.784 1.75 1.75 1.75h16.5A1.75 1.75 0 0022 20.25V3.75A1.75 1.75 0 0020.25 2H3.75zM3.5 3.75a.25.25 0 01.25-.25H15v17H3.75a.25.25 0 01-.25-.25V3.75zm13 16.75v-17h3.75a.25.25 0 01.25.25v16.5a.25.25 0 01-.25.25H16.5z"/>
  </svg>
);
import { ClassDiagramImporter } from './menues/class-diagram-importer';
import { GenerateCodeMenu } from './menues/generate-code-menu';
import { DeployMenu } from './menues/deploy-menu';
import { validateDiagram } from '../../services/validation/validateDiagram';
import { UMLDiagramType } from '@besser/wme';
import { displayError } from '../../services/error-management/errorManagementSlice';
import { toast } from 'react-toastify';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useProject } from '../../hooks/useProject';
import { isUMLModel } from '../../types/project';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';

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

const GitHubButton = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
  
  .github-user {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1;
  }
  
  .github-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
    
    &.login {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      
      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }
    }
    
    &.logout {
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      
      &:hover {
        background: rgba(255, 100, 100, 0.2);
        color: #ff6b6b;
        border-color: rgba(255, 100, 100, 0.3);
      }
    }
  }
`;

const SidebarToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  padding: 8px;
  margin-left: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.has-changes {
    color: #ffc107;
    
    &:hover {
      color: #ffcd39;
    }
  }
`;

export const ApplicationBar: React.FC<{ onOpenHome?: () => void }> = ({ onOpenHome }) => {
  const dispatch = useAppDispatch();
  const { diagram } = useAppSelector((state) => state.diagram);
  const [diagramTitle, setDiagramTitle] = useState<string>(diagram?.title || '');
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const urlPath = window.location.pathname;
  const tokenInUrl = urlPath.substring(1); // This removes the leading "/"
  const currentType = useAppSelector((state) => state.diagram.editorOptions.type);
  const navigate = useNavigate();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const location = useLocation();
  const { currentProject } = useProject();
  const { isAuthenticated, username, login: githubLogin, logout: githubLogout, isLoading: githubLoading } = useGitHubAuth();

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
              <DeployMenu />
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
        <GitHubButton>
          {isAuthenticated ? (
            <>
              <span className="github-user">
                <Github size={16} style={{ transform: 'translateY(-1px)' }} /> {username}
              </span>
              <button 
                className="github-btn logout" 
                onClick={githubLogout}
                title="Sign out from GitHub"
              >
                <BoxArrowRight size={14} /> Sign Out
              </button>
            </>
          ) : (
            <button 
              className="github-btn login" 
              onClick={githubLogin}
              disabled={githubLoading}
              title="Connect to GitHub for deployment"
            >
              <Github size={16} /> {githubLoading ? 'Connecting...' : 'Connect GitHub'}
            </button>
          )}
        </GitHubButton>
        <ThemeSwitcherMenu />
        {isAuthenticated && (
          <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip>GitHub Version Control</Tooltip>}
          >
            <SidebarToggleButton
              onClick={() => setIsGitHubSidebarOpen(true)}
              title="Open GitHub sync panel"
            >
              <SidebarIcon size={20} />
            </SidebarToggleButton>
          </OverlayTrigger>
        )}
      </Navbar>
      
      {/* GitHub Sidebar for version control */}
      <GitHubSidebar 
        isOpen={isGitHubSidebarOpen} 
        onClose={() => setIsGitHubSidebarOpen(false)} 
      />
    </>
  );
};
