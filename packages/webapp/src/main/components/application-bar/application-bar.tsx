import React, { ChangeEvent, useEffect, useState, useContext, useCallback, useRef } from 'react';
import { Nav, Navbar,NavDropdown, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FileMenu } from './menues/file-menu';
import { HelpMenu } from './menues/help-menu';
import { CommunityMenu } from './menues/community-menu';
import { ThemeSwitcherMenu } from './menues/theme-switcher-menu';
import styled from 'styled-components';
import { appVersion } from '../../application-constants';
import { APPLICATION_SERVER_VERSION, DEPLOYMENT_URL, BACKEND_URL } from '../../constant';
import { ModalContentType } from '../modals/application-modal-types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCreateNewEditor, setDisplayUnpublishedVersion, updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { showModal } from '../../services/modal/modalSlice';
import { LayoutTextSidebarReverse, Github, Share, BoxArrowRight, StarFill, Star } from 'react-bootstrap-icons';

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
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { displayError } from '../../services/error-management/errorManagementSlice';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import { StoredAgentConfiguration } from '../../services/local-storage/local-storage-types';
import { toast } from 'react-toastify';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useProject } from '../../hooks/useProject';
import { isUMLModel } from '../../types/project';
import { setUser } from '@sentry/react';

type UserProfileSummary = {
  id: string;
  name: string;
  savedAt: string;
};
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';
import posthog from 'posthog-js';

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

const StarButton = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 215, 0, 0.15);
    border-color: rgba(255, 215, 0, 0.4);
    color: #ffd700;
  }

  &.starred {
    color: #ffd700;
    border-color: rgba(255, 215, 0, 0.3);
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
  const [userProfiles, setUserProfiles] = useState<UserProfileSummary[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfileSummary | null>(null);
  const [agentConfigOptions, setAgentConfigOptions] = useState<StoredAgentConfiguration[]>([]);
  const [activeAgentConfigId, setActiveAgentConfigId] = useState<string>(LocalStorageRepository.getActiveAgentConfigurationId() || '');
  const baseAgentModelRef = useRef<UMLModel | null>(null);
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const urlPath = window.location.pathname;
  const tokenInUrl = urlPath.substring(1); // This removes the leading "/"
  const currentType = useAppSelector((state) => state.diagram.editorOptions.type);
  const navigate = useNavigate();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const location = useLocation();
  const { currentProject } = useProject();
  const isUserDiagram = currentType === UMLDiagramType.UserDiagram;
  const isAgentDiagram = currentType === UMLDiagramType.AgentDiagram;
  const isAgentGenerated = isAgentDiagram && diagram?.model && isUMLModel(diagram.model);
  const activeAgentConfigName = agentConfigOptions.find((entry) => entry.id === activeAgentConfigId)?.name;
  const agentConfigDropdownLabel = activeAgentConfigName ? `Agent Config: ${activeAgentConfigName}` : 'Agent Configuration: Original';
  const { isAuthenticated, username, githubSession, login: githubLogin, logout: githubLogout, isLoading: githubLoading } = useGitHubAuth();
  const [hasStarred, setHasStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !githubSession) return;
    fetch(`${BACKEND_URL}/github/star/status?session_id=${githubSession}`)
      .then((res) => res.json())
      .then((data) => { if (data.starred) setHasStarred(true); })
      .catch(() => {});
  }, [isAuthenticated, githubSession]);

  const handleToggleStar = async () => {
    if (!githubSession || starLoading) return;
    setStarLoading(true);
    try {
      const method = hasStarred ? 'DELETE' : 'PUT';
      const res = await fetch(
        `${BACKEND_URL}/github/star?session_id=${githubSession}`,
        { method }
      );
      if (res.ok) {
        setHasStarred(!hasStarred);
        if (!hasStarred) toast.success('Thanks for starring BESSER!');
      }
    } catch {
      toast.error('Failed to update star');
    } finally {
      setStarLoading(false);
    }
  };

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

  const refreshAgentConfigs = useCallback(() => {
    const configs = LocalStorageRepository.getAgentConfigurations()
      .filter((entry) => Boolean(entry.baseAgentModel || entry.personalizedAgentModel))
      .map((entry) => {
        if (!entry.personalizedAgentModel && entry.baseAgentModel) {
          return { ...entry, personalizedAgentModel: entry.baseAgentModel } as StoredAgentConfiguration;
        }
        return entry;
      });
    setAgentConfigOptions(configs);

    setActiveAgentConfigId((current) => {
      const storedActive = LocalStorageRepository.getActiveAgentConfigurationId();
      if (storedActive && configs.some((cfg) => cfg.id === storedActive)) {
        return storedActive;
      }
      if (current && configs.some((cfg) => cfg.id === current)) {
        return current;
      }
      return '';
    });
  }, []);

  useEffect(() => {
    refreshAgentConfigs();

    const handleConfigChange = () => refreshAgentConfigs();
    window.addEventListener('agent-configurations-changed', handleConfigChange);
    return () => {
      window.removeEventListener('agent-configurations-changed', handleConfigChange);
    };
  }, [refreshAgentConfigs]);

  useEffect(() => {
    if (!isAgentDiagram) {
      baseAgentModelRef.current = null;
      return;
    }

    const storedBase = diagram?.id ? LocalStorageRepository.getAgentBaseModel(diagram.id) : null;
    if (storedBase) {
      baseAgentModelRef.current = storedBase;
      return;
    }

    const activeConfig = activeAgentConfigId
      ? agentConfigOptions.find((entry) => entry.id === activeAgentConfigId)
      : null;
    if (activeConfig?.originalAgentModel) {
      baseAgentModelRef.current = JSON.parse(JSON.stringify(activeConfig.originalAgentModel));
      return;
    }

    if (
      isAgentGenerated &&
      isUMLModel(diagram?.model) &&
      diagram?.model.type === UMLDiagramType.AgentDiagram &&
      !baseAgentModelRef.current
    ) {
      baseAgentModelRef.current = JSON.parse(JSON.stringify(diagram.model));
    }
  }, [activeAgentConfigId, agentConfigOptions, diagram?.id, diagram?.model, isAgentDiagram, isAgentGenerated]);

  const getActiveUserModel = (): UMLModel | null => {
    if (editor && isUMLModel(editor.model) && editor.model.type === UMLDiagramType.UserDiagram) {
      return editor.model;
    }
    if (isUMLModel(diagram?.model) && diagram?.model?.type === UMLDiagramType.UserDiagram) {
      return diagram.model;
    }
    return null;
  };

  const getCurrentAgentModel = useCallback((): UMLModel | null => {
    if (editor && isUMLModel(editor.model) && editor.model.type === UMLDiagramType.AgentDiagram) {
      return editor.model;
    }
    if (isUMLModel(diagram?.model) && diagram?.model?.type === UMLDiagramType.AgentDiagram) {
      return diagram.model;
    }
    return null;
  }, [diagram?.model, editor]);

  const persistCurrentAgentSnapshot = useCallback((options?: { nextConfigId?: string }) => {
    const currentModel = getCurrentAgentModel();
    if (!currentModel) {
      return;
    }

    const snapshot = JSON.parse(JSON.stringify(currentModel)) as UMLModel;

    if (activeAgentConfigId) {
      const activeConfig = agentConfigOptions.find((entry) => entry.id === activeAgentConfigId);
      if (!activeConfig) {
        return;
      }

      LocalStorageRepository.saveAgentConfiguration(activeConfig.name, activeConfig.config, {
        personalizedAgentModel: snapshot,
        originalAgentModel: baseAgentModelRef.current || activeConfig.originalAgentModel || null,
      });

      try {
        window.dispatchEvent(new Event('agent-configurations-changed'));
      } catch {
        /* no-op */
      }
    } else if (diagram?.id) {
      LocalStorageRepository.saveAgentBaseModel(diagram.id, snapshot);
      baseAgentModelRef.current = snapshot;

      if (options?.nextConfigId) {
        const targetConfig = agentConfigOptions.find((entry) => entry.id === options.nextConfigId);
        if (targetConfig) {
          LocalStorageRepository.saveAgentConfiguration(targetConfig.name, targetConfig.config, {
            personalizedAgentModel: targetConfig.personalizedAgentModel || targetConfig.baseAgentModel || null,
            originalAgentModel: snapshot,
          });
          try {
            window.dispatchEvent(new Event('agent-configurations-changed'));
          } catch {
            /* no-op */
          }
        }
      }
    }
  }, [activeAgentConfigId, agentConfigOptions, diagram?.id, getCurrentAgentModel]);

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
      setCurrentProfileId(profileId);
      setCurrentProfile(storedProfile);
      toast.success(`Profile "${storedProfile.name}" loaded.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load the selected profile.');
    }
  };

  const handleApplyAgentConfiguration = useCallback(
    async (configId: string) => {
      if (!isAgentGenerated) {
        toast.error('Generate the agent before applying a configuration.');
        return;
      }

      persistCurrentAgentSnapshot({ nextConfigId: configId || undefined });

      if (!baseAgentModelRef.current && isUMLModel(diagram?.model)) {
        baseAgentModelRef.current = JSON.parse(JSON.stringify(diagram.model));
      }

      const findConfigById = (id?: string | null) => (id ? agentConfigOptions.find((entry) => entry.id === id) : null);
      const cloneModel = (model?: UMLModel | null) => (model ? (JSON.parse(JSON.stringify(model)) as UMLModel) : null);

      if (!configId) {
        const activeConfig = findConfigById(activeAgentConfigId);
        const fallbackBase = diagram?.id ? LocalStorageRepository.getAgentBaseModel(diagram.id) : null;
        const storedOriginal = activeConfig?.originalAgentModel;
        const referenceSource = baseAgentModelRef.current ?? fallbackBase ?? storedOriginal;
        const snapshot = cloneModel(referenceSource);

        if (snapshot) {
          await dispatch(updateDiagramThunk({ model: snapshot })).unwrap();
          dispatch(setCreateNewEditor(true));
          if (diagram?.id && storedOriginal) {
            LocalStorageRepository.saveAgentBaseModel(diagram.id, snapshot);
          }
          baseAgentModelRef.current = JSON.parse(JSON.stringify(snapshot));
          LocalStorageRepository.clearActiveAgentConfigurationId();
          setActiveAgentConfigId('');
          toast.success('Reverted to the original agent.');
        } else {
          toast.error('No original agent snapshot available.');
        }
        return;
      }

      const target = findConfigById(configId);
      const personalizedModel = target?.personalizedAgentModel || target?.baseAgentModel;
      if (!target || !personalizedModel || !isUMLModel(personalizedModel)) {
        toast.error('Selected configuration has no stored agent copy to apply.');
        return;
      }

      const snapshot = cloneModel(personalizedModel);
      if (!snapshot) {
        toast.error('Failed to clone the selected agent configuration.');
        return;
      }

      await dispatch(updateDiagramThunk({ model: snapshot })).unwrap();
      dispatch(setCreateNewEditor(true));
      LocalStorageRepository.setActiveAgentConfigurationId(configId);
      setActiveAgentConfigId(configId);

      const storedBase = diagram?.id ? LocalStorageRepository.getAgentBaseModel(diagram.id) : null;
      const latestBase = storedBase || baseAgentModelRef.current || (target.originalAgentModel ? cloneModel(target.originalAgentModel) : null);

      if (latestBase) {
        baseAgentModelRef.current = latestBase;
        if (diagram?.id) {
          LocalStorageRepository.saveAgentBaseModel(diagram.id, latestBase);
        }
      }

      toast.success(`Applied agent configuration "${target.name}"`);
    },
    [
      activeAgentConfigId,
      agentConfigOptions,
      dispatch,
      diagram?.id,
      diagram?.model,
      isAgentGenerated,
      persistCurrentAgentSnapshot,
    ],
  );

  const changeDiagramTitlePreview = (event: ChangeEvent<HTMLInputElement>) => {
    setDiagramTitle(event.target.value);
  };

  const changeDiagramTitleApplicationState = () => {
    if (diagram) {
      dispatch(updateDiagramThunk({ title: diagramTitle }));
    }
  };

  // Helper to get model size metrics for analytics
  const getModelMetrics = () => {
    const empty = { elements_count: 0, classes_count: 0, abstract_classes_count: 0, attributes_count: 0, methods_count: 0, enumerations_count: 0, relationships_count: 0, total_size: 0 };
    if (!diagram?.model) return empty;

    const model = diagram.model as any;
    const elements = model.elements ? Object.values(model.elements) as any[] : [];
    const countByType = (types: string[]) => elements.filter((el) => types.includes(el.type)).length;

    const classesCount = countByType(['Class']);
    const abstractClassesCount = countByType(['AbstractClass']);
    const attributesCount = countByType(['ClassAttribute']);
    const methodsCount = countByType(['ClassMethod']);
    const enumerationsCount = countByType(['Enumeration']);
    const relationshipsCount = model.relationships ? Object.keys(model.relationships).length : 0;

    return {
      elements_count: elements.length,
      classes_count: classesCount,
      abstract_classes_count: abstractClassesCount,
      attributes_count: attributesCount,
      methods_count: methodsCount,
      enumerations_count: enumerationsCount,
      relationships_count: relationshipsCount,
      total_size: elements.length + relationshipsCount
    };
  };

  const handleQualityCheck = async () => {
    if (
      location.pathname === '/quantum-editor' ||
      location.pathname === '/graphical-ui-editor' ||
      currentProject?.currentDiagramType === 'QuantumCircuitDiagram'
    ) {
      toast.error('coming soon');
      return;
    }

    posthog.capture('quality_check_used', {
      diagram_type: currentType,
      diagram_title: diagram?.title,
      ...getModelMetrics()
    });

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
            {isUserDiagram && (
              <>
                <Nav.Item className="ms-2">
                  <Nav.Link onClick={handleSaveUserProfile}>Save Profile</Nav.Link>
                </Nav.Item>
                
                <NavDropdown
                  title={`Load Profile${currentProfile ? `: ${currentProfile.name}` : ""}`}
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
            {isAgentGenerated && agentConfigOptions.length > 0 && (
              <NavDropdown
                title={agentConfigDropdownLabel}
                id="agent-config-dropdown"
                className="ms-2"
                menuVariant="dark"
              >
                <NavDropdown.Item active={!activeAgentConfigId} onClick={() => handleApplyAgentConfiguration('')}>
                  Original Agent
                </NavDropdown.Item>
                <NavDropdown.Divider />
                {agentConfigOptions.map((entry) => (
                  <NavDropdown.Item
                    key={entry.id}
                    active={entry.id === activeAgentConfigId}
                    onClick={() => handleApplyAgentConfiguration(entry.id)}
                  >
                    {entry.name}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            )}
          </Nav>
        </Navbar.Collapse>
        <GitHubButton>
          {isAuthenticated ? (
            <>
              <span className="github-user">
                <Github size={16} style={{ transform: 'translateY(-1px)' }} /> {username}
              </span>
              <StarButton
                className={hasStarred ? 'starred' : ''}
                onClick={handleToggleStar}
                disabled={starLoading}
                title={hasStarred ? 'Unstar BESSER on GitHub' : 'Star BESSER on GitHub'}
              >
                {hasStarred ? <StarFill size={14} /> : <Star size={14} />}
                {hasStarred ? 'Starred' : 'Star'}
              </StarButton>
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
