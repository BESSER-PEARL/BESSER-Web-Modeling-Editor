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
  ExclamationTriangle
} from 'react-bootstrap-icons';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { useGitHubStorage, GitHubRepository, GitHubCommit, LinkedRepository } from '../../services/github/useGitHubStorage';
import { useProject } from '../../hooks/useProject';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { toast } from 'react-toastify';
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
    fetchCommits,
    saveProjectToGitHub,
    loadProjectFromGitHub,
    loadProjectFromCommit,
    createRepositoryForProject,
    unlinkRepo,
    initLinkedRepo,
    checkForChanges,
  } = useGitHubStorage();

  // Modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  
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

  // Helper to save current editor state to project before pushing
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

  const handleLinkRepo = useCallback(async (repo: GitHubRepository) => {
    if (!currentProject || !githubSession) return;
    
    // Save current state first
    saveCurrentEditorState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get latest project from storage
    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }
    
    // Save project to the selected repo
    const result = await saveProjectToGitHub(
      githubSession,
      latestProject,
      repo.full_name.split('/')[0],
      repo.name,
      `Initial commit: ${latestProject.name}`,
      repo.default_branch,
      'besser-project.json'
    );
    
    if (result.success) {
      setShowLinkModal(false);
      fetchCommits(githubSession, repo.full_name.split('/')[0], repo.name, 'besser-project.json');
    }
  }, [currentProject, githubSession, saveProjectToGitHub, fetchCommits, saveCurrentEditorState]);

  const handleCreateRepo = useCallback(async () => {
    if (!currentProject || !githubSession || !newRepoName.trim()) return;
    
    // Save current state first
    saveCurrentEditorState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }
    
    const result = await createRepositoryForProject(
      githubSession,
      latestProject,
      newRepoName,
      newRepoDescription || `BESSER project: ${latestProject.name}`,
      isRepoPrivate
    );
    
    if (result.success) {
      setShowCreateModal(false);
      setNewRepoName('');
      setNewRepoDescription('');
      setIsRepoPrivate(false);
    }
  }, [currentProject, githubSession, newRepoName, newRepoDescription, isRepoPrivate, createRepositoryForProject, saveCurrentEditorState]);

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
        <Button variant="outline-dark" size="sm" onClick={() => setShowLinkModal(true)}>
          <Link45deg className="me-1" /> Link Existing
        </Button>
        <Button variant="dark" size="sm" onClick={() => {
          if (currentProject) {
            setNewRepoName(currentProject.name.toLowerCase().replace(/\s+/g, '-'));
            setNewRepoDescription(currentProject.description);
          }
          setShowCreateModal(true);
        }}>
          <PlusCircle className="me-1" /> Create New
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

      {/* Link Repository Modal */}
      <Modal show={showLinkModal} onHide={() => setShowLinkModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Link to Repository</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
                  onClick={() => handleLinkRepo(repo)}
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowLinkModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

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
                onChange={(e) => setNewRepoName(e.target.value)}
                size="sm"
              />
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
            disabled={isLoading || !newRepoName.trim()}
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
    </>
  );
};

export default GitHubSidebar;
