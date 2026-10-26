/**
 * Typed calls to the backend's GitHub endpoints that keep a project and its
 * repository in step. Contract: BESSER `services/deployment/github_deploy_api.py`
 * (`/github/*`) and `routers/spec_driven_router.py` (`/spec-driven/*`).
 */
import { apiClient } from '../../../shared/api/api-client';
import type { BesserProject } from '../../../shared/types/project';
import type { ProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';

/** The `BESSER-Origin` trailer of a commit; null when a person made it. */
export type CommitOrigin = 'spec-driven-agent' | 'editor' | null;

export interface RepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
  origin: CommitOrigin;
}

export interface RepoListing {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
  topics: string[];
}

export interface RepoSummary {
  has_model: boolean;
  branch: string;
  head_sha: string;
  project_name: string;
  project_id: string | null;
  diagram_counts: Record<string, number>;
  class_count: number;
  class_names: string[];
  last_commit: RepoCommit | null;
}

export interface SyncStatus {
  head_sha: string;
  /** Commits on the branch since the editor's last sync, newest first. */
  commits_since: RepoCommit[];
  in_sync: boolean;
}

export interface ModelHistoryEntry extends RepoCommit {
  changes: string[];
}

export interface ImportedRun {
  run_id: string;
  project: unknown | null;
  has_model: boolean;
  owner: string;
  repo: string;
  branch: string;
  commit_sha: string;
  message?: string;
}

/** The GitHub topic BESSER sets on every repo it pushes to. */
export const BESSER_TOPIC = 'besser';

const session = (githubSession: string) => ({ headers: { 'X-GitHub-Session': githubSession } });
const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();

export const listRepos = async (githubSession: string): Promise<RepoListing[]> =>
  (await apiClient.get<{ repositories: RepoListing[] }>('/github/repos', { ...session(githubSession), timeout: 60_000 }))
    .repositories ?? [];

export const listBranches = async (githubSession: string, owner: string, repo: string): Promise<string[]> =>
  (await apiClient.get<{ branches: string[] }>(`/github/branches?${query({ owner, repo })}`, session(githubSession)))
    .branches ?? [];

export const getRepoSummary = (githubSession: string, owner: string, repo: string, branch?: string) =>
  apiClient.get<RepoSummary>(`/github/repo-summary?${query({ owner, repo, branch })}`, session(githubSession));

export const getSyncStatus = (githubSession: string, owner: string, repo: string, branch: string, baseSha?: string) =>
  apiClient.get<SyncStatus>(
    `/github/sync-status?${query({ owner, repo, branch, base_sha: baseSha })}`,
    session(githubSession),
  );

export const getModelHistory = async (githubSession: string, owner: string, repo: string, branch: string) =>
  (await apiClient.get<{ commits: ModelHistoryEntry[] }>(
    `/github/model-history?${query({ owner, repo, branch })}`,
    { ...session(githubSession), timeout: 60_000 },
  )).commits ?? [];

export const createPullRequest = (
  githubSession: string,
  body: { owner: string; repo: string; head: string; base: string; title: string; body?: string },
) => apiClient.post<{ number: number; html_url: string }>('/github/pull-request', body, session(githubSession));

/** Outcome of a commit that must not revert newer commits (see GitHubService.commit_tree). */
export type PushStatus = 'pushed' | 'merged' | 'conflict' | 'pull_request';

export interface SaveModelResult {
  success: boolean;
  commit_sha: string;
  message: string;
  status: PushStatus;
  conflict_branch: string | null;
}

export const saveModel = (
  githubSession: string,
  body: {
    owner: string;
    repo: string;
    branch: string;
    commit_message: string;
    project_data: BesserProject;
    project_export: ProjectExportEnvelope;
    base_commit_sha?: string;
  },
) => apiClient.post<SaveModelResult>('/github/project/save', body, { ...session(githubSession), timeout: 60_000 });

/** The repo's model file as stored (a V2 envelope or a legacy project) and the head it was read at. */
export const loadModel = (githubSession: string, owner: string, repo: string, branch: string) =>
  apiClient.get<{ project: unknown; sha: string }>(
    `/github/project/load?${query({ owner, repo, branch })}`,
    { ...session(githubSession), timeout: 60_000 },
  );

export const loadModelAtCommit = (githubSession: string, owner: string, repo: string, commitSha: string) =>
  apiClient.get<{ project: unknown; commit_sha: string }>(
    `/github/project/load-commit?${query({ owner, repo, commit_sha: commitSha })}`,
    { ...session(githubSession), timeout: 60_000 },
  );

export const createRepoForProject = (
  githubSession: string,
  body: {
    repo_name: string;
    description: string;
    is_private: boolean;
    project_data: BesserProject;
    project_export: ProjectExportEnvelope;
  },
) =>
  apiClient.post<{ owner: string; repo_url: string; commit_sha: string; branch: string }>(
    '/github/project/create-repo',
    body,
    { ...session(githubSession), timeout: 60_000 },
  );

export const createGist = (githubSession: string, project: BesserProject, description: string, isPublic: boolean) =>
  apiClient.post<{ gist_url: string }>(
    '/github/gist/create',
    { project_data: project, description, is_public: isPublic },
    session(githubSession),
  );

/** Register the repo's code as a run the next Spec-Driven modify run can start from. */
export const importRepoAsRun = (githubSession: string, owner: string, repo: string, branch?: string) =>
  apiClient.post<ImportedRun>(
    '/spec-driven/import-github-run',
    { owner, repo, branch: branch || undefined },
    { ...session(githubSession), timeout: 120_000 },
  );

export interface GoLiveResult {
  commit_sha: string;
  /** False when the repo already held these exact deploy files. */
  changed: boolean;
  render_deploy_url: string;
  backend_url: string;
  frontend_url: string | null;
  backend_dir: string;
  frontend_dir: string | null;
  warnings: string[];
}

/** Fired on `window` to open Go live from anywhere (the GitHub panel); the shell owns the dialog. */
export const GO_LIVE_EVENT = 'wme:open-go-live';

let goLiveAvailable: Promise<boolean> | null = null;

/** Whether the server deploys the project's own repo ("Go live"); asked once per page load. */
export const isGoLiveAvailable = (): Promise<boolean> => {
  goLiveAvailable ??= apiClient
    .get<{ go_live: boolean }>('/github/app/capabilities')
    .then((caps) => caps.go_live === true)
    .catch(() => false);
  return goLiveAvailable;
};

/** Commit Render deploy files for the app in the repo; 422 carries the reason a repo cannot go live. */
export const goLive = (githubSession: string, owner: string, repo: string, branch: string) =>
  apiClient.post<GoLiveResult>(
    '/github/app/go-live',
    { owner, repo, branch },
    { ...session(githubSession), timeout: 120_000 },
  );
