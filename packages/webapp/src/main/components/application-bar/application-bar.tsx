import React, { ChangeEvent, useEffect, useState, useContext, useCallback } from 'react';
import { Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FileMenu } from './menues/file-menu';
import { HelpMenu } from './menues/help-menu';
import { ThemeSwitcherMenu } from './menues/theme-switcher-menu';
import styled from 'styled-components';
import { appVersion } from '../../application-constants';
import { APPLICATION_SERVER_VERSION, DEPLOYMENT_URL } from '../../constant';
import { ModalContentType } from '../modals/application-modal-types';
import { ConnectClientsComponent } from './connected-clients-component';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCreateNewEditor, setDisplayUnpublishedVersion, updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { showModal } from '../../services/modal/modalSlice';
import { LayoutTextSidebarReverse, Github, Share, House } from 'react-bootstrap-icons';
import { selectDisplaySidebar, toggleSidebar } from '../../services/version-management/versionManagementSlice';
import { ClassDiagramImporter } from './menues/class-diagram-importer';
import { GenerateCodeMenu } from './menues/generate-code-menu';
import { validateDiagram } from '../../services/validation/validateDiagram';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { DiagramRepository } from '../../services/diagram/diagram-repository';
import { displayError } from '../../services/error-management/errorManagementSlice';
import { DiagramView } from 'shared';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import { toast } from 'react-toastify';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useProject } from '../../hooks/useProject';
import { isUMLModel } from '../../types/project';

type UserProfileSummary = {
  id: string;
  name: string;
  savedAt: string;
};

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

const MainContent = styled.div<{ $isSidebarOpen: boolean }>`
  transition: margin-right 0.3s ease;
  margin-right: ${(props) => (props.$isSidebarOpen ? '250px' : '0')}; /* Adjust based on sidebar width */
`;

export const ApplicationBar: React.FC<{ onOpenHome?: () => void }> = ({ onOpenHome }) => {
  const dispatch = useAppDispatch();
  const { diagram } = useAppSelector((state) => state.diagram);
  const [diagramTitle, setDiagramTitle] = useState<string>(diagram?.title || '');
  const [userProfiles, setUserProfiles] = useState<UserProfileSummary[]>([]);
  const isSidebarOpen = useAppSelector(selectDisplaySidebar);
  const urlPath = window.location.pathname;
  const tokenInUrl = urlPath.substring(1); // This removes the leading "/"
  const currentType = useAppSelector((state) => state.diagram.editorOptions.type);
  const navigate = useNavigate();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const location = useLocation();
  const { currentProject } = useProject();
  const isUserDiagram = currentType === UMLDiagramType.UserDiagram;

  useEffect(() => {
    if (diagram?.title) {
      setDiagramTitle(diagram.title);
    }
  }, [diagram?.title]);

  const refreshUserProfiles = useCallback(() => {
    if (!isUserDiagram) {
      setUserProfiles([]);
      return;
    }

    const entries = LocalStorageRepository.getUserProfiles()
      .filter((profile) => profile.model?.type === UMLDiagramType.UserDiagram)
      .map(({ id, name, savedAt }) => ({ id, name, savedAt }));
    setUserProfiles(entries);
  }, [isUserDiagram]);

  useEffect(() => {
    refreshUserProfiles();
  }, [refreshUserProfiles]);

  const getActiveUserModel = (): UMLModel | null => {
    if (editor && isUMLModel(editor.model) && editor.model.type === UMLDiagramType.UserDiagram) {
      return editor.model;
    }
    if (isUMLModel(diagram?.model) && diagram?.model?.type === UMLDiagramType.UserDiagram) {
      return diagram.model;
    }
    return null;
  };

  const handleSaveUserProfile = () => {
    if (!isUserDiagram) {
      toast.error('Profile saving is only available for user diagrams.');
      return;
    }

    const model = getActiveUserModel();
    if (!model) {
      toast.error('No user model available to save.');
      return;
    }

    const suggestedName = diagramTitle ? `${diagramTitle} Profile` : 'User Profile';
    const input = window.prompt('Enter a name for this user profile', suggestedName);
    if (input === null) {
      return;
    }
    const trimmedName = input.trim();
    if (!trimmedName) {
      toast.error('Profile name cannot be empty.');
      return;
    }

    const existing = userProfiles.find((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      const shouldOverwrite = window.confirm(`A profile named "${trimmedName}" already exists. Overwrite it?`);
      if (!shouldOverwrite) {
        return;
      }
    }

    try {
      LocalStorageRepository.saveUserProfile(trimmedName, model);
      refreshUserProfiles();
      toast.success(`Profile "${trimmedName}" saved.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save the profile.');
    }
  };

  const handleLoadUserProfile = async (profileId: string) => {
    if (!isUserDiagram) {
      toast.error('Profile loading is only available for user diagrams.');
      return;
    }

    const storedProfile = LocalStorageRepository.loadUserProfile(profileId);
    if (!storedProfile || storedProfile.model?.type !== UMLDiagramType.UserDiagram) {
      toast.error('The selected profile could not be loaded.');
      refreshUserProfiles();
      return;
    }

    try {
      if (editor) {
        editor.model = storedProfile.model;
      } else {
        dispatch(setCreateNewEditor(true));
      }
      await dispatch(updateDiagramThunk({ model: storedProfile.model })).unwrap();
      toast.success(`Profile "${storedProfile.name}" loaded.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load the selected profile.');
    }
  };

  const changeDiagramTitlePreview = (event: ChangeEvent<HTMLInputElement>) => {
    setDiagramTitle(event.target.value);
  };

  const changeDiagramTitleApplicationState = () => {
    if (diagram) {
      dispatch(updateDiagramThunk({ title: diagramTitle }));
    }
  };

  const handleOpenModal = () => {
    dispatch(showModal({ type: ModalContentType.ShareModal, size: 'lg' }));
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

  const handleQuickShare = async () => {
    if (!diagram || !isUMLModel(diagram.model) || Object.keys(diagram.model.elements).length === 0) {
      dispatch(
        displayError(
          'Sharing diagram failed',
          'You are trying to share an empty diagram. Please insert at least one element to the canvas before sharing.',
        ),
      );
      return;
    }

    let token = diagram.token;
    const diagramCopy = Object.assign({}, diagram);
    diagramCopy.description = diagramCopy.description || 'Shared diagram';
    

    try {
      const res = await DiagramRepository.publishDiagramVersionOnServer(diagramCopy, diagram.token);
      dispatch(updateDiagramThunk(res.diagram));
      dispatch(setCreateNewEditor(true));
      dispatch(setDisplayUnpublishedVersion(false));
      token = res.diagramToken;
      
      // Set collaborate view as the published type
      LocalStorageRepository.setLastPublishedType(DiagramView.COLLABORATE);
      LocalStorageRepository.setLastPublishedToken(token);
      
      // Generate and copy the link without the view parameter
      const link = `${DEPLOYMENT_URL}/${token}`;
      try {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(link);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = link;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
          }
          document.body.removeChild(textArea);
        }
        
        toast.success(
          'The collaboration link has been copied to your clipboard and can be shared by pasting the link.',
          {
            autoClose: 10000,
          },
        );
        
        // Close sidebar if it's open
        if (isSidebarOpen) {
          dispatch(toggleSidebar());
        }
        
        // Navigate to the collaboration view using just the token
        navigate(`/${token}`);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy to clipboard. Please try again.');
      }
    } catch (error) {
      dispatch(
        displayError('Connection failed', 'Connection to the server failed. Please try again or report a problem.'),
      );
      console.error(error);
    }
  };  return (
    <MainContent $isSidebarOpen={isSidebarOpen}>
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
            <HelpMenu />
            {isUserDiagram && (
              <>
                <Nav.Item className="ms-2">
                  <Nav.Link onClick={handleSaveUserProfile}>Save Profile</Nav.Link>
                </Nav.Item>
                <NavDropdown
                  title="Load Profile"
                  id="user-profile-dropdown"
                  className="ms-2"
                  menuVariant="dark"
                  disabled={userProfiles.length === 0}
                >
                  {userProfiles.length === 0 ? (
                    <NavDropdown.ItemText>No saved profiles yet</NavDropdown.ItemText>
                  ) : (
                    userProfiles.map((profile) => (
                      <NavDropdown.Item key={profile.id} onClick={() => handleLoadUserProfile(profile.id)}>
                        <div className="d-flex flex-column">
                          <span>{profile.name}</span>
                          <small className="text-muted">{new Date(profile.savedAt).toLocaleString()}</small>
                        </div>
                      </NavDropdown.Item>
                    ))
                  )}
                </NavDropdown>
              </>
            )}
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
        {tokenInUrl && <ConnectClientsComponent />}
        <ThemeSwitcherMenu />
      </Navbar>
    </MainContent>
  );
};
