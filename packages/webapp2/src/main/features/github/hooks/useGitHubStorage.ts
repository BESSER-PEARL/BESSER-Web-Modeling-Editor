import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../shared/constants/constant';
import { BesserProject } from '../../../shared/types/project';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
}

export interface GitHubProjectFile {
  path: string;
  sha: string;
  content?: string;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

export interface LinkedRepository {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  lastSyncedAt: string;
  lastCommitSha?: string;
}

// LocalStorage key for linked repos
const GITHUB_LINKED_REPOS_KEY = 'besser_github_linked_repos';

/**
 * Hook for GitHub project storage operations.
 * Allows saving/loading projects to/from GitHub repositories.
 */
export const useGitHubStorage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [linkedRepo, setLinkedRepo] = useState<LinkedRepository | null>(null);

  /**
   * Get linked repository for a project from localStorage
   */
  const getLinkedRepo = useCallback((projectId: string): LinkedRepository | null => {
    try {
      const stored = localStorage.getItem(GITHUB_LINKED_REPOS_KEY);
      if (!stored) return null;
      const links = JSON.parse(stored) as Record<string, LinkedRepository>;
      return links[projectId] || null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Save linked repository for a project to localStorage
   */
  const saveLinkedRepo = useCallback((projectId: string, link: LinkedRepository) => {
    try {
      const stored = localStorage.getItem(GITHUB_LINKED_REPOS_KEY);
      let links: Record<string, LinkedRepository> = {};
      if (stored) {
        try { links = JSON.parse(stored); } catch { links = {}; }
      }
      links[projectId] = link;
      localStorage.setItem(GITHUB_LINKED_REPOS_KEY, JSON.stringify(links));
      setLinkedRepo(link);
    } catch (error) {
      console.error('Failed to save linked repository:', error);
    }
  }, []);

  /**
   * Remove linked repository for a project
   */
  const unlinkRepo = useCallback((projectId: string) => {
    try {
      const stored = localStorage.getItem(GITHUB_LINKED_REPOS_KEY);
      if (stored) {
        let links: Record<string, unknown>;
        try { links = JSON.parse(stored); } catch { links = {}; }
        delete links[projectId];
        localStorage.setItem(GITHUB_LINKED_REPOS_KEY, JSON.stringify(links));
      }
      setLinkedRepo(null);
    } catch (error) {
      console.error('Failed to unlink repository:', error);
    }
  }, []);

  /**
   * Fetch user's GitHub repositories
   */
  const fetchRepositories = useCallback(async (githubSession: string): Promise<GitHubRepository[]> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${BACKEND_URL}/github/repos`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.repositories || []);
      return data.repositories || [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return [];
      }
      console.error('Failed to fetch repositories:', error);
      toast.error('Failed to fetch GitHub repositories');
      return [];
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch branches for a repository
   */
  const fetchBranches = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string
  ): Promise<string[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo });
      const response = await fetch(`${BACKEND_URL}/github/branches?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();
      return data.branches || [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return [];
      }
      console.error('Failed to fetch branches:', error);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  /**
   * Check if a file exists in a repository
   */
  const checkFileExists = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string
  ): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo, branch, file_path: filePath });
      const response = await fetch(`${BACKEND_URL}/github/file/exists?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.exists === true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return false;
      }
      console.error('Failed to check file existence:', error);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  /**
   * Link a repository to a project without pushing (just saves the link metadata)
   */
  const linkRepoOnly = useCallback((
    projectId: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string
  ): void => {
    saveLinkedRepo(projectId, {
      owner,
      repo,
      branch,
      filePath,
      lastSyncedAt: '', // Empty = never synced
    });
    toast.success('Repository linked! Push to sync your project.');
  }, [saveLinkedRepo]);

  /**
   * Fetch commits for a repository
   */
  const fetchCommits = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    path?: string
  ): Promise<GitHubCommit[]> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo });
      if (path) params.append('path', path);

      const response = await fetch(`${BACKEND_URL}/github/commits?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch commits');
      }

      const data = await response.json();
      setCommits(data.commits || []);
      return data.commits || [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return [];
      }
      console.error('Failed to fetch commits:', error);
      toast.error('Failed to fetch commit history');
      return [];
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  /**
   * Save project to GitHub repository
   */
  const saveProjectToGitHub = useCallback(async (
    githubSession: string,
    project: BesserProject,
    owner: string,
    repo: string,
    commitMessage: string,
    branch: string = 'main',
    filePath: string = 'besser-project.json'
  ): Promise<{ success: boolean; commitSha?: string }> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${BACKEND_URL}/github/project/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Session': githubSession,
        },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          file_path: filePath,
          commit_message: commitMessage,
          project_data: project,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save project to GitHub');
      }

      const result = await response.json();

      // Update linked repo info
      saveLinkedRepo(project.id, {
        owner,
        repo,
        branch,
        filePath,
        lastSyncedAt: new Date().toISOString(),
        lastCommitSha: result.commit_sha,
      });

      toast.success('Project saved to GitHub!');
      return { success: true, commitSha: result.commit_sha };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return { success: false };
      }
      const message = error instanceof Error ? error.message : 'Failed to save project';
      toast.error(message);
      console.error('GitHub save error:', error);
      return { success: false };
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [saveLinkedRepo]);

  /**
   * Load project from GitHub repository
   */
  const loadProjectFromGitHub = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    branch: string = 'main',
    filePath: string = 'besser-project.json'
  ): Promise<BesserProject | null> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo, branch, file_path: filePath });
      const response = await fetch(`${BACKEND_URL}/github/project/load?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load project from GitHub');
      }

      const data = await response.json();
      return data.project as BesserProject;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return null;
      }
      const message = error instanceof Error ? error.message : 'Failed to load project';
      toast.error(message);
      console.error('GitHub load error:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  /**
   * Load project from a specific commit
   */
  const loadProjectFromCommit = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    commitSha: string,
    filePath: string = 'besser-project.json'
  ): Promise<BesserProject | null> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo, commit_sha: commitSha, file_path: filePath });
      const response = await fetch(`${BACKEND_URL}/github/project/load-commit?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load project from commit');
      }

      const data = await response.json();
      toast.success(`Restored version from ${data.commit_date ? new Date(data.commit_date).toLocaleDateString() : 'commit'}`);
      return data.project as BesserProject;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return null;
      }
      const message = error instanceof Error ? error.message : 'Failed to load project from commit';
      toast.error(message);
      console.error('GitHub load commit error:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new repository for the project
   */
  const createRepositoryForProject = useCallback(async (
    githubSession: string,
    project: BesserProject,
    repoName: string,
    description: string,
    isPrivate: boolean,
    filePath: string = 'besser-project.json'
  ): Promise<{ success: boolean; repoUrl?: string }> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${BACKEND_URL}/github/project/create-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Session': githubSession,
        },
        body: JSON.stringify({
          repo_name: repoName,
          description,
          is_private: isPrivate,
          project_data: project,
          file_path: filePath,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create repository');
      }

      const result = await response.json();

      // Link the project to the new repo
      saveLinkedRepo(project.id, {
        owner: result.owner,
        repo: repoName,
        branch: 'main',
        filePath: filePath,
        lastSyncedAt: new Date().toISOString(),
        lastCommitSha: result.commit_sha,
      });

      toast.success(`Repository "${repoName}" created!`);
      return { success: true, repoUrl: result.repo_url };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return { success: false };
      }
      const message = error instanceof Error ? error.message : 'Failed to create repository';
      toast.error(message);
      console.error('GitHub create repo error:', error);
      return { success: false };
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [saveLinkedRepo]);

  /**
   * Check if there are unsaved changes (compare with last synced version).
   * Only compares diagram model data — ignores metadata like schemaVersion,
   * timestamps, currentDiagramIndices, and settings that change during
   * migrations without any user action.
   */
  const checkForChanges = useCallback(async (
    githubSession: string,
    project: BesserProject,
    linkedRepo: LinkedRepository
  ): Promise<boolean> => {
    try {
      const remoteProject = await loadProjectFromGitHub(
        githubSession,
        linkedRepo.owner,
        linkedRepo.repo,
        linkedRepo.branch,
        linkedRepo.filePath
      );

      if (!remoteProject) return true;

      // Compare only diagram models — the actual user content
      const extractModels = (p: BesserProject) => {
        const result: Record<string, unknown[]> = {};
        for (const [type, diagrams] of Object.entries(p.diagrams)) {
          const arr = Array.isArray(diagrams) ? diagrams : [diagrams];
          result[type] = arr.map((d: any) => d?.model ?? null);
        }
        return result;
      };

      return JSON.stringify(extractModels(project)) !== JSON.stringify(extractModels(remoteProject));
    } catch {
      return true;
    }
  }, [loadProjectFromGitHub]);

  /**
   * Initialize linked repo state for a project
   */
  const initLinkedRepo = useCallback((projectId: string) => {
    const link = getLinkedRepo(projectId);
    setLinkedRepo(link);
    return link;
  }, [getLinkedRepo]);

  /**
   * Fetch contents of a repository path
   */
  const fetchRepoContents = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<GitHubContentItem[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo, path, branch });
      const response = await fetch(`${BACKEND_URL}/github/contents?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contents');
      }

      const data = await response.json();
      return data.contents || [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return [];
      }
      console.error('Failed to fetch repo contents:', error);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  /**
   * Get remote project silently (for diff preview - no toasts)
   */
  const getRemoteProjectSilent = useCallback(async (
    githubSession: string,
    owner: string,
    repo: string,
    branch: string = 'main',
    filePath: string = 'besser-project.json'
  ): Promise<BesserProject | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const params = new URLSearchParams({ owner, repo, branch, file_path: filePath });
      const response = await fetch(`${BACKEND_URL}/github/project/load?${params}`, {
        headers: {
          'X-GitHub-Session': githubSession,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.project as BesserProject;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
      console.error('Failed to get remote project:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  /**
   * Create a GitHub Gist from project
   */
  const createGist = useCallback(async (
    githubSession: string,
    project: BesserProject,
    description: string,
    isPublic: boolean
  ): Promise<{ success: boolean; gistUrl?: string }> => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${BACKEND_URL}/github/gist/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Session': githubSession,
        },
        body: JSON.stringify({
          project_data: project,
          description: description || `BESSER Project: ${project.name}`,
          is_public: isPublic,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create Gist');
      }

      const result = await response.json();
      toast.success('Gist created successfully!');
      return { success: true, gistUrl: result.gist_url };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
        return { success: false };
      }
      const message = error instanceof Error ? error.message : 'Failed to create Gist';
      toast.error(message);
      console.error('GitHub Gist error:', error);
      return { success: false };
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    isLoading,
    repositories,
    commits,
    linkedRepo,

    // Actions
    fetchRepositories,
    fetchBranches,
    fetchCommits,
    fetchRepoContents,
    saveProjectToGitHub,
    loadProjectFromGitHub,
    loadProjectFromCommit,
    createRepositoryForProject,
    checkForChanges,
    checkFileExists,

    // Linking
    getLinkedRepo,
    saveLinkedRepo,
    unlinkRepo,
    initLinkedRepo,
    linkRepoOnly,

    // Diff & Gist
    getRemoteProjectSilent,
    createGist,
  };
};
