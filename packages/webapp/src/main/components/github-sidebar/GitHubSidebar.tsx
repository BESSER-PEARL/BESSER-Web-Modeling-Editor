import React, { useState, useEffect, useCallback, useContext } from 'react';
import styled from 'styled-components';
import { Button, Form, Modal, Spinner, Badge, ListGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  Github,
  X,
  CloudArrowUp,
  CloudArrowDown,
  ClockHistory,
  Link45deg,
  PlusCircle,
  ArrowClockwise,
  BoxArrowUpRight,
  XCircle,
  Check2Circle,
  ExclamationTriangle,
  Folder,
  FileEarmark,
  ArrowLeft,
  Share,
  Gear
} from 'react-bootstrap-icons';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { useGitHubStorage, GitHubRepository, GitHubCommit, LinkedRepository, GitHubContentItem } from '../../services/github/useGitHubStorage';
import { useAutoCommit } from '../../services/github/useAutoCommit';
import { useProject } from '../../hooks/useProject';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { toast } from 'react-toastify';
import { FileBrowserModal } from './FileBrowserModal';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useAppSelector } from '../store/hooks';

// Styled Components - Integrated panel style
const SidebarOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  transition: all 0.25s ease;
  z-index: 1000;
`;

const SidebarContainer = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 56px;
  right: 0;
  width: 360px;
  max-width: 100vw;
  height: calc(100vh - 56px);
  background: var(--apollon-background, #ffffff);
  border-left: 1px solid var(--apollon-border, #dee2e6);
  transform: translateX(${props => props.$isOpen ? '0' : '100%'});
  transition: transform 0.25s ease;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  
  .dark-mode & {
    background: #1e2228;
    border-color: #3d4449;
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--apollon-border, #dee2e6);
  background: var(--apollon-background, #ffffff);
  
  .dark-mode & {
    background: #23272b;
    border-color: #3d4449;
  }
  
  h5 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--apollon-text, #212529);
    
    .dark-mode & {
      color: #e9ecef;
    }
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--apollon-text-secondary, #6c757d);
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: var(--apollon-background-hover, #f8f9fa);
    color: var(--apollon-text, #212529);
  }
  
  .dark-mode &:hover {
    background: #3d4449;
    color: #e9ecef;
  }
`;

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h6`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--apollon-text-secondary, #6c757d);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const LinkedRepoCard = styled.div`
  background: var(--apollon-background-secondary, #f8f9fa);
  border: 1px solid var(--apollon-border, #dee2e6);
  border-radius: 8px;
  padding: 14px;
  
  .dark-mode & {
    background: #2d3238;
    border-color: #3d4449;
  }
`;

const RepoInfo = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  
  .repo-icon {
    background: #24292e;
    color: #fff;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .repo-details {
    flex: 1;
    min-width: 0;
    
    .repo-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--apollon-text, #212529);
      word-break: break-word;
      
      .dark-mode & {
        color: #e9ecef;
      }
    }
    
    .repo-branch {
      font-size: 0.75rem;
      color: var(--apollon-text-secondary, #6c757d);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
`;

const SyncStatus = styled.div<{ $status: 'synced' | 'pending' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  
  ${props => {
    switch (props.$status) {
      case 'synced':
        return `
          background: rgba(40, 167, 69, 0.1);
          color: #28a745;
        `;
      case 'pending':
        return `
          background: rgba(255, 193, 7, 0.1);
          color: #856404;
        `;
      case 'error':
        return `
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        `;
    }
  }}
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  
  .btn {
    font-size: 0.8rem;
    padding: 6px 10px;
  }
`;

const CommitList = styled(ListGroup)`
  max-height: 280px;
  overflow-y: auto;
  border-radius: 8px;
  
  .list-group-item {
    padding: 10px 12px;
    border-color: var(--apollon-border, #dee2e6);
    background: var(--apollon-background, #fff);
    
    .dark-mode & {
      background: #2d3238;
      border-color: #3d4449;
    }
    
    &:hover {
      background: var(--apollon-background-hover, #f8f9fa);
      
      .dark-mode & {
        background: #353b42;
      }
    }
  }
`;

const CommitItem = styled.div`
  .commit-message {
    font-weight: 500;
    font-size: 0.85rem;
    color: var(--apollon-text, #212529);
    margin-bottom: 4px;
    word-break: break-word;
    
    .dark-mode & {
      color: #e9ecef;
    }
  }
  
  .commit-meta {
    font-size: 0.7rem;
    color: var(--apollon-text-secondary, #6c757d);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .commit-sha {
    font-family: monospace;
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
    text-decoration: none;
    color: inherit;
    
    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .dark-mode & {
      background: rgba(255, 255, 255, 0.1);
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 30px 16px;
  color: var(--apollon-text-secondary, #6c757d);
  
  svg {
    margin-bottom: 12px;
    opacity: 0.5;
  }
  
  h6 {
    margin-bottom: 6px;
    color: var(--apollon-text, #212529);
    font-size: 0.95rem;
    
    .dark-mode & {
      color: #e9ecef;
    }
  }
  
  p {
    font-size: 0.85rem;
    margin-bottom: 14px;
  }
`;

const RepoListItem = styled(ListGroup.Item)`
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: var(--apollon-background-hover, #f8f9fa) !important;
    
    .dark-mode & {
      background: #353b42 !important;
    }
  }
  
  .repo-name {
    font-weight: 500;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .repo-description {
    font-size: 0.75rem;
    color: var(--apollon-text-secondary, #6c757d);
    margin-top: 4px;
  }
  
  .repo-meta {
    font-size: 0.7rem;
    color: var(--apollon-text-secondary, #6c757d);
    margin-top: 4px;
  }
`;

interface GitHubSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubSidebar: React.FC<GitHubSidebarProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated, username, githubSession, login } = useGitHubAuth();
  const { currentProject, updateCurrentDiagram } = useProject();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const diagram = useAppSelector((state) => state.diagram.diagram);

  const {
    isLoading,
    repositories,
    commits,
    linkedRepo,
    fetchRepositories,
    fetchBranches,
    fetchCommits,
    fetchRepoContents,
    saveProjectToGitHub,
    loadProjectFromGitHub,
    loadProjectFromCommit,
    createRepositoryForProject,
    unlinkRepo,
    initLinkedRepo,
    checkForChanges,
    checkFileExists,
    linkRepoOnly,
    createGist,
  } = useGitHubStorage();

  // Modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const [showGistModal, setShowGistModal] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);

  // Function to save current editor state
  const saveCurrentEditorState = useCallback(() => {
    if (editor && currentProject) {
      try {
        const currentModel = editor.model;
        // Update the current diagram in the project
        updateCurrentDiagram(currentModel);
        // Force save to storage
        const project = ProjectStorageRepository.loadProject(currentProject.id);
        if (project) {
          ProjectStorageRepository.saveProject(project);
        }
        return true;
      } catch (error) {
        console.error('Failed to save editor state:', error);
        return false;
      }
    }
    return true;
  }, [editor, currentProject, updateCurrentDiagram]);

  // Auto-commit hook
  const { settings: autoCommitSettings, updateSettings: updateAutoCommitSettings, isAutoCommitting } = useAutoCommit({
    githubSession,
    projectId: currentProject?.id || null,
    linkedRepo,
    saveCurrentEditorState,
  });

  // Form states
  const [commitMessage, setCommitMessage] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isRepoPrivate, setIsRepoPrivate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCheckingChanges, setIsCheckingChanges] = useState(false);

  // Link configuration states (Step 2 of link modal)
  const [linkStep, setLinkStep] = useState<'select' | 'configure'>('select');
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [linkFileName, setLinkFileName] = useState('');
  const [linkFolderPath, setLinkFolderPath] = useState('');
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [isCheckingFile, setIsCheckingFile] = useState(false);

  // Create repo path states
  const [createFileName, setCreateFileName] = useState('');
  const [createFolderPath, setCreateFolderPath] = useState('');

  // Gist states
  const [gistDescription, setGistDescription] = useState('');
  const [isGistPublic, setIsGistPublic] = useState(false);

  // Initialize linked repo when project changes
  useEffect(() => {
    if (currentProject?.id) {
      initLinkedRepo(currentProject.id);
    }
  }, [currentProject?.id, initLinkedRepo]);

  // Fetch repos when link modal opens
  useEffect(() => {
    if (showLinkModal && isAuthenticated && githubSession) {
      fetchRepositories(githubSession);
    }
  }, [showLinkModal, isAuthenticated, githubSession, fetchRepositories]);

  // Fetch commits when sidebar opens and linked
  useEffect(() => {
    if (isOpen && linkedRepo && isAuthenticated && githubSession) {
      fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath);
    }
  }, [isOpen, linkedRepo, isAuthenticated, githubSession, fetchCommits]);

  // Check for changes when sidebar opens
  useEffect(() => {
    const checkChanges = async () => {
      if (isOpen && linkedRepo && isAuthenticated && githubSession && currentProject) {
        setIsCheckingChanges(true);
        try {
          // Get current project from storage
          const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
          if (latestProject) {
            const hasDiff = await checkForChanges(githubSession, latestProject, linkedRepo);
            setHasChanges(hasDiff);
          }
        } catch (error) {
          console.error('Failed to check for changes:', error);
        } finally {
          setIsCheckingChanges(false);
        }
      }
    };
    checkChanges();
  }, [isOpen, linkedRepo, isAuthenticated, githubSession, currentProject, checkForChanges]);



  const handleSave = useCallback(async () => {
    if (!linkedRepo || !currentProject || !githubSession) return;

    // First, save current editor state
    saveCurrentEditorState();

    // Small delay to ensure storage is updated
    await new Promise(resolve => setTimeout(resolve, 100));

    setShowCommitModal(true);
  }, [linkedRepo, currentProject, githubSession, saveCurrentEditorState]);

  const handleConfirmSave = useCallback(async () => {
    if (!linkedRepo || !currentProject || !githubSession || !commitMessage.trim()) return;

    setIsSaving(true);

    // Save current editor state first
    saveCurrentEditorState();

    // Small delay to ensure storage is updated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now get the fresh project from storage
    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      setIsSaving(false);
      return;
    }

    const result = await saveProjectToGitHub(
      githubSession,
      latestProject,
      linkedRepo.owner,
      linkedRepo.repo,
      commitMessage,
      linkedRepo.branch,
      linkedRepo.filePath
    );

    if (result.success) {
      setShowCommitModal(false);
      setCommitMessage('');
      // Refresh commits
      fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath);
    }
    setIsSaving(false);
  }, [linkedRepo, currentProject, githubSession, commitMessage, saveProjectToGitHub, fetchCommits, saveCurrentEditorState]);

  const handleLoad = useCallback(async () => {
    if (!linkedRepo || !githubSession) return;

    const project = await loadProjectFromGitHub(
      githubSession,
      linkedRepo.owner,
      linkedRepo.repo,
      linkedRepo.branch,
      linkedRepo.filePath
    );

    if (project) {
      // Save the loaded project locally
      ProjectStorageRepository.saveProject(project);
      // Reload the page to apply changes
      window.location.reload();
    }
  }, [linkedRepo, githubSession, loadProjectFromGitHub]);

  // Step 1: Select a repo and move to configure step
  const handleSelectRepo = useCallback(async (repo: GitHubRepository) => {
    if (!githubSession || !currentProject) return;

    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);

    // Set default file name based on project name
    const defaultFileName = `${currentProject.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')}.json`;
    setLinkFileName(defaultFileName);
    setLinkFolderPath('');
    setFileExists(null);

    // Fetch branches for the repo
    const branches = await fetchBranches(githubSession, repo.full_name.split('/')[0], repo.name);
    setAvailableBranches(branches.length > 0 ? branches : [repo.default_branch]);

    // Move to configure step
    setLinkStep('configure');
  }, [githubSession, currentProject, fetchBranches]);

  // Check if file exists in the repo
  const handleCheckFileExists = useCallback(async () => {
    if (!githubSession || !selectedRepo || !linkFileName) return;

    setIsCheckingFile(true);
    const fullPath = linkFolderPath
      ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
      : linkFileName;

    const exists = await checkFileExists(
      githubSession,
      selectedRepo.full_name.split('/')[0],
      selectedRepo.name,
      selectedBranch,
      fullPath
    );
    setFileExists(exists);
    setIsCheckingFile(false);
  }, [githubSession, selectedRepo, selectedBranch, linkFileName, linkFolderPath, checkFileExists]);

  // Compute full file path for display
  const computedFilePath = linkFolderPath
    ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
    : linkFileName;

  // Handle loading existing project from repo
  const handleLoadFromRepo = useCallback(async (): Promise<boolean> => {
    if (!githubSession || !selectedRepo) return false;

    const fullPath = linkFolderPath
      ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
      : linkFileName;

    const project = await loadProjectFromGitHub(
      githubSession,
      selectedRepo.full_name.split('/')[0],
      selectedRepo.name,
      selectedBranch,
      fullPath
    );

    if (project) {
      // Save the loaded project locally
      ProjectStorageRepository.saveProject(project);
      // Persist the link so subsequent saves go to the same file
      if (currentProject) {
        linkRepoOnly(
          currentProject.id,
          selectedRepo.full_name.split('/')[0],
          selectedRepo.name,
          selectedBranch,
          fullPath
        );
      }
      // Reload the page to apply changes
      window.location.reload();
      return true;
    }
    return false;
  }, [githubSession, selectedRepo, selectedBranch, linkFileName, linkFolderPath, loadProjectFromGitHub, currentProject, linkRepoOnly]);

  // Step 2: Confirm link (if file exists, prefer loading and linking)
  const handleConfirmLink = useCallback(async (linkOnly: boolean = false) => {
    if (!currentProject || !selectedRepo) return;

    const fullPath = linkFolderPath
      ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
      : linkFileName;

    // If the file already exists (or likely exists), load it and persist the link so we don't overwrite unintentionally
    if (!linkOnly) {
      let exists = fileExists;

      // If we don't know yet, check before deciding
      if (exists === null) {
        try {
          exists = await checkFileExists(
            githubSession ?? '',
            selectedRepo.full_name.split('/')[0],
            selectedRepo.name,
            selectedBranch,
            fullPath
          );
          setFileExists(exists);
        } catch (error) {
          console.error('Failed to verify file existence before linking:', error);
        }
      }

      if (exists) {
        const loaded = await handleLoadFromRepo();
        if (loaded) return;
        toast.warn('Could not load from repo; linking without loading.');
      }
    }

    linkRepoOnly(
      currentProject.id,
      selectedRepo.full_name.split('/')[0],
      selectedRepo.name,
      selectedBranch,
      fullPath
    );

    // Reset modal state
    setShowLinkModal(false);
    setLinkStep('select');
    setSelectedRepo(null);
    setAvailableBranches([]);
    setFileExists(null);
  }, [currentProject, selectedRepo, selectedBranch, linkFileName, linkFolderPath, linkRepoOnly, fileExists, handleLoadFromRepo, checkFileExists, githubSession]);

  const fetchSelectedRepoContents = useCallback(async (path: string = ''): Promise<GitHubContentItem[]> => {
    if (!githubSession || !selectedRepo) return [];
    try {
      const [owner, repo] = selectedRepo.full_name.split('/');
      return await fetchRepoContents(
        githubSession,
        owner,
        repo,
        path,
        selectedBranch || selectedRepo.default_branch
      );
    } catch (error) {
      console.error('Failed to load repository contents:', error);
      toast.error('Could not load repository contents');
      return [];
    }
  }, [githubSession, selectedRepo, fetchRepoContents, selectedBranch]);

  const handleFileSelectedFromBrowser = useCallback((path: string) => {
    const sanitized = path.replace(/^\/+/, '');
    const segments = sanitized.split('/');
    const file = segments.pop() || '';
    const folder = segments.join('/');
    setLinkFileName(file);
    setLinkFolderPath(folder);
    // Reset existence until user checks or we verify during link
    setFileExists(null);
  }, []);

  const handleCreateRepo = useCallback(async () => {
    if (!currentProject || !githubSession || !newRepoName.trim() || !createFileName.trim()) return;

    // Save current state first
    saveCurrentEditorState();
    await new Promise(resolve => setTimeout(resolve, 100));

    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }

    // Compute full file path
    const fullPath = createFolderPath
      ? `${createFolderPath.replace(/^\/+|\/+$/g, '')}/${createFileName}`
      : createFileName;

    const result = await createRepositoryForProject(
      githubSession,
      latestProject,
      newRepoName,
      newRepoDescription || `BESSER project: ${latestProject.name}`,
      isRepoPrivate,
      fullPath
    );

    if (result.success) {
      setShowCreateModal(false);
      setNewRepoName('');
      setNewRepoDescription('');
      setIsRepoPrivate(false);
      setCreateFileName('');
      setCreateFolderPath('');
    }
  }, [currentProject, githubSession, newRepoName, newRepoDescription, isRepoPrivate, createFileName, createFolderPath, createRepositoryForProject, saveCurrentEditorState]);

  const handleUnlink = useCallback(() => {
    if (currentProject?.id) {
      unlinkRepo(currentProject.id);
      toast.info('Repository unlinked');
    }
  }, [currentProject?.id, unlinkRepo]);

  const handleCommitClick = useCallback((commit: GitHubCommit) => {
    // Check if this is the latest commit
    const isLatest = commits.length > 0 && commits[0].sha === commit.sha;
    if (isLatest) {
      toast.info('This is already the latest version');
      return;
    }
    setSelectedCommit(commit);
    setShowRestoreModal(true);
  }, [commits]);

  const handleRestoreCommit = useCallback(async () => {
    if (!linkedRepo || !githubSession || !selectedCommit) return;

    setIsSaving(true);

    const project = await loadProjectFromCommit(
      githubSession,
      linkedRepo.owner,
      linkedRepo.repo,
      selectedCommit.sha,
      linkedRepo.filePath
    );

    if (project) {
      // Save the loaded project locally
      ProjectStorageRepository.saveProject(project);
      setShowRestoreModal(false);
      setSelectedCommit(null);
      // Reload the page to apply changes
      window.location.reload();
    }
    setIsSaving(false);
  }, [linkedRepo, githubSession, selectedCommit, loadProjectFromCommit]);

  // Create a Gist from the current project
  const handleCreateGist = useCallback(async () => {
    if (!currentProject || !githubSession) return;

    // Save current state first
    saveCurrentEditorState();
    await new Promise(resolve => setTimeout(resolve, 100));

    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }

    const result = await createGist(
      githubSession,
      latestProject,
      gistDescription || `BESSER Project: ${latestProject.name}`,
      isGistPublic
    );

    if (result.success && result.gistUrl) {
      setShowGistModal(false);
      setGistDescription('');
      setIsGistPublic(false);
      // Open the gist in a new tab
      window.open(result.gistUrl, '_blank');
    }
  }, [currentProject, githubSession, gistDescription, isGistPublic, createGist, saveCurrentEditorState]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Not authenticated view
  const renderUnauthenticated = () => (
    <EmptyState>
      <Github size={40} />
      <h6>Connect to GitHub</h6>
      <p>Sign in to sync your projects with GitHub.</p>
      <Button variant="dark" size="sm" onClick={login}>
        <Github className="me-2" /> Connect GitHub
      </Button>
    </EmptyState>
  );

  // No project selected view
  const renderNoProject = () => (
    <EmptyState>
      <ExclamationTriangle size={40} />
      <h6>No Project Selected</h6>
      <p>Open or create a project to use GitHub sync.</p>
    </EmptyState>
  );

  // Not linked view
  const renderNotLinked = () => (
    <EmptyState>
      <Link45deg size={40} />
      <h6>Link a Repository</h6>
      <p>Connect your project to a GitHub repo for version control.</p>
      <div className="d-flex gap-2 justify-content-center flex-wrap">
        <Button
          variant="outline-dark"
          size="sm"
          className="d-inline-flex align-items-center"
          onClick={() => setShowLinkModal(true)}
        >
          <Link45deg className="me-1" style={{ transform: 'translateY(6px)' }} /> Link Existing
        </Button>
        <Button
          variant="dark"
          size="sm"
          className="d-inline-flex align-items-center"
          onClick={() => {
          if (currentProject) {
            const sanitizedName = currentProject.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
            setNewRepoName(sanitizedName);
            setNewRepoDescription(currentProject.description);
            setCreateFileName(`${sanitizedName}.json`);
            setCreateFolderPath('');
          }
          setShowCreateModal(true);
        }}>
          <PlusCircle className="me-1" style={{ transform: 'translateY(6px)' }} /> Create New
        </Button>
      </div>
    </EmptyState>
  );

  // Linked view
  const renderLinked = () => (
    <>
      <Section>
        <SectionTitle>
          <Link45deg size={14} /> Repository
        </SectionTitle>
        <LinkedRepoCard>
          <RepoInfo>
            <div className="repo-icon">
              <Github size={18} />
            </div>
            <div className="repo-details">
              <div className="repo-name">{linkedRepo?.owner}/{linkedRepo?.repo}</div>
              <div className="repo-branch">
                <Badge bg="secondary" style={{ fontSize: '0.65rem' }}>{linkedRepo?.branch}</Badge>
              </div>
            </div>
          </RepoInfo>

          <SyncStatus $status={isCheckingChanges ? 'pending' : hasChanges ? 'pending' : 'synced'}>
            {isCheckingChanges ? (
              <>
                <Spinner animation="border" size="sm" style={{ width: 12, height: 12 }} /> Checking...
              </>
            ) : hasChanges ? (
              <>
                <ExclamationTriangle size={12} /> You have unsaved changes
              </>
            ) : (
              <>
                <Check2Circle size={12} /> Up to date
              </>
            )}
          </SyncStatus>

          <ActionButtons>
            <Button
              variant="success"
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
            >
              <CloudArrowUp size={14} className="me-1" /> Push
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleLoad}
              disabled={isLoading}
            >
              <CloudArrowDown size={14} className="me-1" /> Pull
            </Button>
            <OverlayTrigger placement="top" overlay={<Tooltip>Open on GitHub</Tooltip>}>
              <Button
                variant="outline-secondary"
                size="sm"
                as="a"
                href={`https://github.com/${linkedRepo?.owner}/${linkedRepo?.repo}`}
                target="_blank"
              >
                <BoxArrowUpRight size={12} />
              </Button>
            </OverlayTrigger>
            <OverlayTrigger placement="top" overlay={<Tooltip>Unlink</Tooltip>}>
              <Button variant="outline-danger" size="sm" onClick={handleUnlink}>
                <XCircle size={12} />
              </Button>
            </OverlayTrigger>
          </ActionButtons>
        </LinkedRepoCard>
      </Section>



      <Section>
        <SectionTitle>
          <ClockHistory size={14} /> History
          <Button
            variant="link"
            size="sm"
            className="p-0 ms-auto"
            onClick={() => linkedRepo && githubSession && fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath)}
            disabled={isLoading}
            style={{ fontSize: '0.75rem' }}
          >
            <ArrowClockwise size={12} />
          </Button>
        </SectionTitle>

        {isLoading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : commits.length > 0 ? (
          <CommitList>
            {commits.slice(0, 10).map((commit, index) => (
              <ListGroup.Item
                key={commit.sha}
                action={index > 0}
                onClick={() => index > 0 && handleCommitClick(commit)}
                style={{ cursor: index > 0 ? 'pointer' : 'default' }}
              >
                <CommitItem>
                  <div className="commit-message">
                    {index === 0 && <Badge bg="success" style={{ fontSize: '0.6rem', marginRight: '6px' }}>Latest</Badge>}
                    {commit.message}
                  </div>
                  <div className="commit-meta">
                    <span>{commit.author}</span>
                    <span>•</span>
                    <span>{formatDate(commit.date)}</span>
                    <a
                      href={commit.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="commit-sha"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {commit.sha.substring(0, 7)}
                    </a>
                    {index > 0 && (
                      <span style={{ color: 'var(--apollon-text-secondary)', fontSize: '0.65rem' }}>
                        Click to restore
                      </span>
                    )}
                  </div>
                </CommitItem>
              </ListGroup.Item>
            ))}
          </CommitList>
        ) : (
          <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>No commits yet</p>
        )}
      </Section>

            <Section>
        <SectionTitle>
          <Share size={14} /> Share
        </SectionTitle>
        <div className="d-grid gap-2">
          <Button
            variant="outline-dark"
            size="sm"
            onClick={() => {
              setGistDescription(currentProject ? `BESSER Project: ${currentProject.name}` : '');
              setShowGistModal(true);
            }}
          >
            <FileEarmark size={14} className="me-2" /> Create Secret Gist
          </Button>
        </div>
      </Section>

      <Section>
        <SectionTitle>
          <Gear size={14} /> Settings
        </SectionTitle>
        <div className="d-flex align-items-center justify-content-between p-2 border rounded" style={{ background: 'var(--apollon-background-secondary, #f8f9fa)' }}>
          <div>
            <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Auto-commit</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              {autoCommitSettings.enabled
                ? `Enabled (${autoCommitSettings.intervalMinutes}m)`
                : 'Disabled'}
            </div>
          </div>
          <Form.Check
            type="switch"
            id="auto-commit-switch"
            checked={autoCommitSettings.enabled}
            onChange={(e) => updateAutoCommitSettings({ enabled: e.target.checked })}
            disabled={!linkedRepo}
          />
        </div>
        {autoCommitSettings.enabled && (
          <div className="mt-2">
            <Form.Label style={{ fontSize: '0.8rem' }}>Interval (minutes)</Form.Label>
            <Form.Select
              size="sm"
              value={autoCommitSettings.intervalMinutes}
              onChange={(e) => updateAutoCommitSettings({ intervalMinutes: parseInt(e.target.value) })}
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
            </Form.Select>
          </div>
        )}
        {isAutoCommitting && (
          <div className="mt-2 text-muted" style={{ fontSize: '0.75rem' }}>
            <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} className="me-1" />
            Auto-saving...
          </div>
        )}
      </Section>
    </>
  );

  return (
    <>
      <SidebarOverlay $isOpen={isOpen} onClick={onClose} />

      <SidebarContainer $isOpen={isOpen}>
        <SidebarHeader>
          <h5>
            <Github size={18} /> GitHub Sync
          </h5>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </SidebarHeader>

        <SidebarContent>
          {!isAuthenticated && renderUnauthenticated()}
          {isAuthenticated && !currentProject && renderNoProject()}
          {isAuthenticated && currentProject && !linkedRepo && renderNotLinked()}
          {isAuthenticated && currentProject && linkedRepo && renderLinked()}
        </SidebarContent>
      </SidebarContainer>

      {/* Link Repository Modal - Two-Step Flow */}
      <Modal show={showLinkModal} onHide={() => { setShowLinkModal(false); setLinkStep('select'); setSelectedRepo(null); setShowFileBrowser(false); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {linkStep === 'select' ? 'Link to Repository' : (
              <div className="d-flex align-items-center gap-2">
                <Button variant="link" size="sm" className="p-0" onClick={() => setLinkStep('select')}>
                  <ArrowLeft size={18} />
                </Button>
                Configure Link
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {linkStep === 'select' ? (
            <>
              <p className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>
                Select a repository to sync your project with.
              </p>

              {isLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" />
                  <p className="mt-2 text-muted">Loading...</p>
                </div>
              ) : (
                <ListGroup style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {repositories.map((repo) => (
                    <RepoListItem
                      key={repo.id}
                      action
                      onClick={() => handleSelectRepo(repo)}
                    >
                      <div className="repo-name">
                        <Github size={14} />
                        {repo.full_name}
                        {repo.private && <Badge bg="secondary" style={{ fontSize: '0.65rem' }}>Private</Badge>}
                      </div>
                      {repo.description && (
                        <div className="repo-description">{repo.description}</div>
                      )}
                      <div className="repo-meta">
                        Updated: {formatDate(repo.updated_at)}
                      </div>
                    </RepoListItem>
                  ))}
                  {repositories.length === 0 && (
                    <ListGroup.Item className="text-center text-muted">
                      No repositories found
                    </ListGroup.Item>
                  )}
                </ListGroup>
              )}
            </>
          ) : (
            <>
              {/* Step 2: Configure branch and file path */}
              <div className="mb-3 p-2 rounded" style={{ background: 'var(--apollon-background-secondary, #f8f9fa)' }}>
                <div className="d-flex align-items-center gap-2">
                  <Github size={16} />
                  <strong>{selectedRepo?.full_name}</strong>
                </div>
              </div>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Branch</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedBranch}
                    onChange={(e) => { setSelectedBranch(e.target.value); setFileExists(null); }}
                  >
                    {availableBranches.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label><Folder size={14} className="me-1" /> Folder Path (optional)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., projects/my-models"
                    value={linkFolderPath}
                    onChange={(e) => { setLinkFolderPath(e.target.value); setFileExists(null); }}
                    size="sm"
                  />
                  <Form.Text className="text-muted">
                    Leave empty to save in repository root.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label><FileEarmark size={14} className="me-1" /> File Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="my-project.json"
                    value={linkFileName}
                    onChange={(e) => { setLinkFileName(e.target.value.replace(/\s+/g, '-')); setFileExists(null); }}
                    size="sm"
                  />
                </Form.Group>

                <div className="d-flex align-items-center gap-2 mb-3">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShowFileBrowser(true)}
                    disabled={!selectedRepo || !githubSession}
                  >
                    <Folder size={14} className="me-1" /> Browse repository files
                  </Button>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    Pick an existing project file without typing the path.
                  </span>
                </div>

                {/* Preview path */}
                <div className="mb-3 p-2 rounded" style={{ background: 'var(--apollon-background-secondary, #f8f9fa)', fontSize: '0.85rem' }}>
                  <strong>Full path:</strong> <code>/{computedFilePath}</code>
                </div>

                {/* Check if file exists */}
                <div className="mb-3">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleCheckFileExists}
                    disabled={isCheckingFile || !linkFileName}
                  >
                    {isCheckingFile ? <Spinner animation="border" size="sm" /> : 'Check if file exists'}
                  </Button>

                  {fileExists === true && (
                    <div className="mt-2 p-2 rounded" style={{ background: 'rgba(255, 193, 7, 0.1)', fontSize: '0.85rem' }}>
                      <ExclamationTriangle size={14} className="me-1 text-warning" />
                      File already exists in repository. Choose how to proceed:
                      <div className="mt-2 d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={() => handleConfirmLink()}>
                          <CloudArrowDown size={14} className="me-1" /> Load & link (recommended)
                        </Button>
                        <Button variant="outline-warning" size="sm" onClick={() => handleConfirmLink(true)}>
                          Link without loading (may overwrite)
                        </Button>
                      </div>
                    </div>
                  )}

                  {fileExists === false && (
                    <div className="mt-2 p-2 rounded" style={{ background: 'rgba(40, 167, 69, 0.1)', fontSize: '0.85rem' }}>
                      <Check2Circle size={14} className="me-1 text-success" />
                      File path is available. Click "Link Repository" to continue.
                    </div>
                  )}
                </div>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => { setShowLinkModal(false); setLinkStep('select'); setSelectedRepo(null); setShowFileBrowser(false); }}>
            Cancel
          </Button>
          {linkStep === 'configure' && (
          <Button
            variant="dark"
            size="sm"
            onClick={() => handleConfirmLink()}
            disabled={!linkFileName}
          >
              <Link45deg size={14} className="me-1" /> {fileExists ? 'Load & Link' : 'Link Repository'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <FileBrowserModal
        show={showFileBrowser}
        onHide={() => setShowFileBrowser(false)}
        onSelect={handleFileSelectedFromBrowser}
        fetchContents={fetchSelectedRepoContents}
        title="Select project file"
        selectMode="file"
        initialPath={linkFolderPath}
      />

      {/* Create Repository Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Repository</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Repository Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="my-project"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''))}
                size="sm"
              />
              <Form.Text className="text-muted">
                Only lowercase letters, numbers, dashes, and underscores allowed.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Optional description..."
                value={newRepoDescription}
                onChange={(e) => setNewRepoDescription(e.target.value)}
                size="sm"
              />
            </Form.Group>

            <hr style={{ margin: '16px 0' }} />
            <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
              <strong>Project File Location</strong>
            </p>

            <Form.Group className="mb-3">
              <Form.Label><Folder size={14} className="me-1" /> Folder Path (optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., projects/my-models"
                value={createFolderPath}
                onChange={(e) => setCreateFolderPath(e.target.value)}
                size="sm"
              />
              <Form.Text className="text-muted">
                Leave empty to save in repository root.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label><FileEarmark size={14} className="me-1" /> File Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="my-project.json"
                value={createFileName}
                onChange={(e) => setCreateFileName(e.target.value.replace(/\s+/g, '-'))}
                size="sm"
              />
            </Form.Group>

            {/* Preview path */}
            <div className="mb-3 p-2 rounded" style={{ background: 'var(--apollon-background-secondary, #f8f9fa)', fontSize: '0.85rem' }}>
              <strong>Full path:</strong> <code>/{createFolderPath ? `${createFolderPath.replace(/^\/+|\/+$/g, '')}/${createFileName}` : createFileName}</code>
            </div>

            <Form.Group>
              <Form.Check
                type="checkbox"
                label="Private repository"
                checked={isRepoPrivate}
                onChange={(e) => setIsRepoPrivate(e.target.checked)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={handleCreateRepo}
            disabled={isLoading || !newRepoName.trim() || !createFileName.trim()}
          >
            {isLoading ? <Spinner animation="border" size="sm" /> : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Commit Message Modal */}
      <Modal show={showCommitModal} onHide={() => setShowCommitModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Push to GitHub</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Commit Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Describe your changes..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                autoFocus
                size="sm"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowCommitModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleConfirmSave}
            disabled={isSaving || !commitMessage.trim()}
          >
            {isSaving ? <Spinner animation="border" size="sm" /> : <><CloudArrowUp size={14} className="me-1" /> Push</>}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Restore Version Modal */}
      <Modal show={showRestoreModal} onHide={() => { setShowRestoreModal(false); setSelectedCommit(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>Restore Version</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to restore this version?</p>
          {selectedCommit && (
            <div style={{
              background: 'var(--apollon-background-secondary, #f8f9fa)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedCommit.message}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--apollon-text-secondary, #6c757d)' }}>
                {selectedCommit.author} • {formatDate(selectedCommit.date)}
              </div>
            </div>
          )}
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            <ExclamationTriangle size={14} className="me-1" />
            Your current unsaved changes will be lost. Consider pushing your current work first.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => { setShowRestoreModal(false); setSelectedCommit(null); }}>
            Cancel
          </Button>
          <Button
            variant="warning"
            size="sm"
            onClick={handleRestoreCommit}
            disabled={isSaving}
          >
            {isSaving ? <Spinner animation="border" size="sm" /> : 'Restore This Version'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Gist Modal */}
      <Modal show={showGistModal} onHide={() => setShowGistModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Gist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <p className="text-muted small">
              Create a GitHub Gist to quickly share your project.
            </p>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Gist description..."
                value={gistDescription}
                onChange={(e) => setGistDescription(e.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Check
                type="checkbox"
                label="Public Gist"
                checked={isGistPublic}
                onChange={(e) => setIsGistPublic(e.target.checked)}
              />
              <Form.Text className="text-muted">
                Secret gists are hidden from search engines but visible to anyone with the link.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowGistModal(false)}>
            Cancel
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={handleCreateGist}
            disabled={isLoading}
          >
            {isLoading ? <Spinner animation="border" size="sm" /> : 'Create Gist'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default GitHubSidebar;
