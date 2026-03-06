import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';
import { LocalStorageRepository } from '../local-storage/local-storage-repository';

export interface GitHubRepoResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  files_uploaded: number;
  message: string;
}

export interface CreateRepoOptions {
  repoName: string;
  description: string;
  isPrivate: boolean;
  githubSession: string;
}

/**
 * Hook for creating and pushing projects to GitHub repositories.
 * This can be used independently for any GitHub repo operations.
 */
export const useGitHubRepo = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [repoResult, setRepoResult] = useState<GitHubRepoResult | null>(null);

  /**
   * Creates a new GitHub repository and pushes project files to it.
   * @param projectData - The project data to push to the repository
   * @param options - Repository creation options (name, description, private, session)
   * @returns The result of the repository creation, or null if failed
   */
  const createRepo = useCallback(
    async (
      projectData: any,
      options: CreateRepoOptions
    ): Promise<GitHubRepoResult | null> => {
      console.log('Creating GitHub repository...');
      setIsCreating(true);
      setRepoResult(null);

      try {
        // Get active agent configuration to include in the deploy request
        // Without this, agent diagrams deploy without LLM/IC config and crash
        const activeConfigId = LocalStorageRepository.getActiveAgentConfigurationId();
        const agentConfig = activeConfigId
          ? LocalStorageRepository.loadAgentConfiguration(activeConfigId)?.config ?? null
          : null;

        // Default agent config: websocket+streamlit, LLM-based IC, OpenAI gpt-5-nano
        const defaultAgentConfig = {
          agentPlatform: 'streamlit',
          intentRecognitionTechnology: 'llm-based',
          llm: { provider: 'openai', model: 'gpt-5-nano' },
        };

        const requestBody = {
          ...projectData,
          settings: {
            ...(projectData.settings || {}),
            config: agentConfig ?? defaultAgentConfig,
          },
          deploy_config: {
            repo_name: options.repoName,
            description: options.description,
            is_private: options.isPrivate,
          },
        };

        const response = await fetch(`${BACKEND_URL}/github/deploy-webapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Session': options.githubSession,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Repository creation failed' }));
          throw new Error(errorData.detail || `HTTP error: ${response.status}`);
        }

        const result = await response.json();
        
        // Extract GitHub-specific result
        const repoResult: GitHubRepoResult = {
          success: result.success,
          repo_url: result.repo_url,
          repo_name: result.repo_name,
          owner: result.owner,
          files_uploaded: result.files_uploaded,
          message: result.message,
        };
        
        setRepoResult(repoResult);

        if (repoResult.success) {
          toast.success(`Repository created: ${repoResult.repo_name}`);
        } else {
          toast.error('Repository creation failed');
        }

        return repoResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Repository creation failed';
        toast.error(errorMessage);
        console.error('GitHub repository creation error:', error);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return {
    createRepo,
    isCreating,
    repoResult,
  };
};
