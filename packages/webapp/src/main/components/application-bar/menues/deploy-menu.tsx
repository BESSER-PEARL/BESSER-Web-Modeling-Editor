import React, { useState } from 'react';
import { Dropdown, NavDropdown, Modal, Form, Button, Alert } from 'react-bootstrap';
import { useGitHubAuth } from '../../../services/github/useGitHubAuth';
import { useDeployToGitHub } from '../../../services/deploy/useGitHubDeploy';
import { useAppSelector } from '../../store/hooks';
import { toast } from 'react-toastify';
import { UMLDiagramType } from '@besser/wme';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import posthog from 'posthog-js';

// localStorage helpers for tracking previously deployed repos per project
const DEPLOY_LINKED_REPO_PREFIX = 'besser_deploy_linked_';

function getDeployLinkedRepo(projectId: string): { owner: string; repo: string } | null {
  try {
    const raw = localStorage.getItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.owner && parsed.repo) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveDeployLinkedRepo(projectId: string, owner: string, repo: string): void {
  localStorage.setItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`, JSON.stringify({ owner, repo }));
}

function clearDeployLinkedRepo(projectId: string): void {
  localStorage.removeItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`);
}

export const DeployMenu: React.FC = () => {
  // Render deployment state
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubRepoDescription, setGithubRepoDescription] = useState('');
  const [githubRepoPrivate, setGithubRepoPrivate] = useState(false);
  const [showDeploymentLinks, setShowDeploymentLinks] = useState(false);
  const [useExistingRepo, setUseExistingRepo] = useState(false);
  const [linkedRepo, setLinkedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');

  const { isAuthenticated, username, githubSession } = useGitHubAuth();
  const { deployToGitHub, isDeploying: isDeployingToRender, deploymentResult } = useDeployToGitHub();
  const diagram = useAppSelector((state) => state.diagram.diagram);
  const currentDiagramType = useAppSelector((state) => state.diagram.editorOptions.type);

  // Detect if we're on the Quantum Circuit editor page
  const isQuantumDiagram = /quantum-editor/.test(typeof window !== 'undefined' ? window.location.pathname : '');
  // Detect if we're on the GraphicalUIEditor GUI / No-Code editor page
  const isGUINoCodeDiagram = /graphical-ui-editor/.test(typeof window !== 'undefined' ? window.location.pathname : '');

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

  // Check if deployment is available for current diagram type
  const isClassDiagram = currentDiagramType === UMLDiagramType.ClassDiagram;
  const isDeploymentAvailable = isGUINoCodeDiagram || isClassDiagram;

  const handleRenderDeploy = async () => {
    if (!githubRepoName.trim()) {
      toast.error('Please enter a repository name');
      return;
    }

    if (!githubSession) {
      toast.error('GitHub session not found');
      return;
    }

    const currentProject = ProjectStorageRepository.getCurrentProject();
    if (!currentProject) {
      toast.error('No project available for deployment');
      return;
    }

    const result = await deployToGitHub(
      currentProject,
      githubRepoName,
      githubRepoDescription || 'Web application generated',
      githubRepoPrivate,
      githubSession,
      useExistingRepo,
      commitMessage
    );

    if (result) {
      // Save linked repo for future redeployments
      if (currentProject.id) {
        saveDeployLinkedRepo(currentProject.id, result.owner, result.repo_name);
      }
      setShowRenderModal(false);

      if (useExistingRepo) {
        // Redeployment: Render auto-rebuilds from the push — just show a toast
        toast.success(
          `Code pushed to ${result.owner}/${result.repo_name}. Render will auto-rebuild your app.`,
          { autoClose: 6000 }
        );
      } else {
        // First deploy: show the deployment links modal
        setShowDeploymentLinks(true);
      }

      posthog.capture('render_deploy_success', {
        deployment_status: 'success',
        is_private: githubRepoPrivate,
        repo_name: githubRepoName,
        repo_url: result.repo_url,
        owner: result.owner,
        files_uploaded: result.files_uploaded,
        is_redeployment: useExistingRepo,
        diagram_type: currentDiagramType,
        ...getModelMetrics()
      });
    } else {
      posthog.capture('render_deploy_failure', {
        deployment_status: 'failed',
        is_private: githubRepoPrivate,
        repo_name: githubRepoName,
        diagram_type: currentDiagramType,
        ...getModelMetrics()
      });
    }
  };

  const handleInitiateRenderDeploy = () => {
    if (!isAuthenticated) {
      toast.info('Please connect to GitHub first using the button in the top bar');
    } else {
      // Already signed in, show deploy modal
      setShowRenderModal(true);
      setCommitMessage('');
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (currentProject) {
        // Check if this project was previously deployed
        const linked = currentProject.id ? getDeployLinkedRepo(currentProject.id) : null;
        if (linked) {
          setLinkedRepo(linked);
          setGithubRepoName(linked.repo);
          setUseExistingRepo(true);
        } else {
          setLinkedRepo(null);
          setUseExistingRepo(false);
          const defaultName = currentProject.name.toLowerCase().replace(/\s+/g, '-');
          setGithubRepoName(defaultName);
        }
      }
    }
  };

  // Don't render the menu if deployment is not available
  if (!isDeploymentAvailable) {
    return null;
  }

  return (
    <>
      <NavDropdown title="Deploy" className="pt-0 pb-0">
        <Dropdown.Item 
          onClick={handleInitiateRenderDeploy}
          disabled={!isAuthenticated}
          title="Creates a GitHub repo with your web app code, then deploys it to Render with one click"
        >
          {isAuthenticated ? `Publish Web App to Render` : 'Publish Web App to Render (Connect GitHub first)'}
        </Dropdown.Item>
      </NavDropdown>

      {/* Publish to Render Modal */}
      <Modal show={showRenderModal} onHide={() => setShowRenderModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{useExistingRepo && linkedRepo ? 'Update Your App' : 'Publish Web App'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {useExistingRepo && linkedRepo ? (
            <>
              <Alert variant="success">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>Linked repository:</strong>{' '}
                    <a href={`https://github.com/${linkedRepo.owner}/${linkedRepo.repo}`} target="_blank" rel="noopener noreferrer">
                      {linkedRepo.owner}/{linkedRepo.repo}
                    </a>
                  </div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const currentProject = ProjectStorageRepository.getCurrentProject();
                      if (currentProject?.id) {
                        clearDeployLinkedRepo(currentProject.id);
                      }
                      setLinkedRepo(null);
                      setUseExistingRepo(false);
                      const defaultName = currentProject?.name.toLowerCase().replace(/\s+/g, '-') || '';
                      setGithubRepoName(defaultName);
                    }}
                  >
                    New repo instead
                  </Button>
                </div>
                <small className="text-muted d-block mt-1">
                  Your code will be pushed to GitHub. If Render is connected, it will auto-rebuild.
                </small>
              </Alert>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Commit Message <span className="text-muted fw-normal">(optional)</span></Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Update app"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                </Form.Group>
              </Form>
            </>
          ) : (
            <>
              <Alert variant="info">
                <strong>First-time setup:</strong> We'll create a GitHub repository with your generated web app,
                then you'll connect it to Render (free) for live hosting.
                After that, every update is automatic.
              </Alert>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Repository Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="my-awesome-app"
                    value={githubRepoName}
                    onChange={(e) => setGithubRepoName(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Lowercase, hyphens and underscores only
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Description <span className="text-muted fw-normal">(optional)</span></Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Web application generated by BESSER"
                    value={githubRepoDescription}
                    onChange={(e) => setGithubRepoDescription(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Make repository private"
                    checked={githubRepoPrivate}
                    onChange={(e) => setGithubRepoPrivate(e.target.checked)}
                  />
                  {githubRepoPrivate && (
                    <Alert variant="warning" className="mt-2 mb-0">
                      <small>
                        Private repos require manually connecting GitHub to Render. The one-click deploy button won't work.
                      </small>
                    </Alert>
                  )}
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRenderModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRenderDeploy}
            disabled={isDeployingToRender || !githubRepoName.trim()}
          >
            {isDeployingToRender ? 'Publishing...' : useExistingRepo ? 'Push Update' : 'Create & Publish'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* First Deploy: Deployment Links Modal */}
      <Modal show={showDeploymentLinks} onHide={() => setShowDeploymentLinks(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Your App is Ready!</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deploymentResult && (
            <>
              <Alert variant="success">
                <strong>Code pushed to GitHub:</strong>{' '}
                <a href={deploymentResult.repo_url} target="_blank" rel="noopener noreferrer">
                  {deploymentResult.owner}/{deploymentResult.repo_name}
                </a>
                {' '}({deploymentResult.files_uploaded} files)
              </Alert>

              <div className="d-grid gap-3 mt-4">
                <a
                  href={deploymentResult.deployment_urls.render}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success btn-lg"
                >
                  Deploy to Render (Free)
                </a>

                <a
                  href={deploymentResult.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary"
                >
                  View on GitHub
                </a>
              </div>

              <Alert variant="light" className="mt-4 border">
                <strong>What happens next:</strong>
                <ol className="mb-0 mt-2 ps-3">
                  <li>Click "Deploy to Render" and sign in (free account)</li>
                  <li>Confirm the services — your app will be live in a few minutes</li>
                  <li>Future updates from the editor will auto-deploy (no extra steps!)</li>
                </ol>
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowDeploymentLinks(false)}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
