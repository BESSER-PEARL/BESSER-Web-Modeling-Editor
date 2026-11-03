/**
 * Typed calls to the backend's GitHub endpoints that keep a project and its
 * repository in step. Contract: BESSER `services/deployment/github_deploy_api.py`
 * (`/github/*`) and `routers/spec_driven_router.py` (`/spec-driven/*`).
 */
import { apiClient } from './api-client';
import type { ApiResponse } from './schema';
import { BACKEND_URL } from '../constants/constant';
import type { BesserProject } from '../types/project';
import type { ProjectExportEnvelope } from '../utils/projectExportUtils';
import type { RepoCodeAnalysis } from '../services/storage/projectGitHubLink';
import { getDemoToken } from '../services/demoMode';

/** `origin`: the commit's `BESSER-Origin` trailer as written (BESSER writes
 *  `spec-driven-agent` or `editor`); null when a person made it. */
export type RepoCommit = ApiResponse<'GitHubCommitResponse'>;

/** `can_push` is false for a repository the user may only read. */
export type RepoListing = ApiResponse<'GitHubRepoResponse'>;

/** `truncated`: the account has more repositories than the list holds. */
export type RepoList = ApiResponse<'GitHubReposListResponse'>;

/** `model_path`: where the model was read (`buml/diagrams.json`, or a file an older editor saved);
 *  `model_paths`: every file holding a BESSER model, more than one lets the user pick. */
export type RepoSummary = ApiResponse<'RepoSummaryResponse'>;

/** Where a save or push kept on its own branch stands. Narrows the schema's
 *  `pull_request_state: str` to the three values `_pending_status` sets. */
export type PendingChangeStatus = Omit<ApiResponse<'PendingChangeStatus'>, 'pull_request_state'> & {
  pull_request_state: 'open' | 'closed' | 'merged' | null;
};

/** `commits_since`: commits on the branch since the editor's last sync, newest
 *  first; `pending` is set when the request named a pending branch. */
export type SyncStatus = Omit<ApiResponse<'SyncStatusResponse'>, 'pending'> & {
  pending: PendingChangeStatus | null;
};

export type ModelHistoryEntry = ApiResponse<'ModelHistoryEntry'>;

/** What BESSER read in a repo it did not create. */
export type RepoAnalysis = RepoCodeAnalysis;

/**
 * Narrows the schema's free dicts `analysis` and `proposed_diagram` (backend
 * `Optional[dict]`) to the fixed shapes `github_sync.import_run_from_github` builds.
 * `analysis`: what the code of a repo without a BESSER model holds;
 * `proposed_diagram`: a class diagram read from its data classes, in the shape
 * the editor imports; `ai_reading_offered`: no data classes were readable and an
 * AI reading could propose a model (import again with `allowAiReading` once the
 * user agreed); `model_path`: where `project` was read.
 */
export type ImportedRun = Omit<ApiResponse<'ImportGitHubRunResponse'>, 'analysis' | 'proposed_diagram'> & {
  analysis: RepoAnalysis | null;
  proposed_diagram: { title: string; model: unknown; diagramType: 'ClassDiagram' } | null;
};

/** The GitHub topic BESSER sets on every repo it pushes to. */
export const BESSER_TOPIC = 'besser';

const session = (githubSession: string) => ({ headers: { 'X-GitHub-Session': githubSession } });
const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();

/** Every repository the user can open: their own, their collaborations and their organizations'. */
export const listRepos = async (githubSession: string): Promise<RepoList> => {
  const list = await apiClient.get<Partial<RepoList>>('/github/repos', { ...session(githubSession), timeout: 60_000 });
  return { repositories: list.repositories ?? [], truncated: list.truncated ?? false };
};

export const listBranches = async (githubSession: string, owner: string, repo: string): Promise<string[]> =>
  (await apiClient.get<ApiResponse<'GitHubBranchesListResponse'>>(`/github/branches?${query({ owner, repo })}`, session(githubSession)))
    .branches ?? [];

export const getRepoSummary = (githubSession: string, owner: string, repo: string, branch?: string) =>
  apiClient.get<RepoSummary>(`/github/repo-summary?${query({ owner, repo, branch })}`, session(githubSession));

export const getSyncStatus = (
  githubSession: string,
  owner: string,
  repo: string,
  branch: string,
  baseSha?: string,
  pendingBranch?: string,
) =>
  apiClient.get<SyncStatus>(
    `/github/sync-status?${query({ owner, repo, branch, base_sha: baseSha, pending_branch: pendingBranch })}`,
    session(githubSession),
  );

export const getModelHistory = async (
  githubSession: string, owner: string, repo: string, branch: string, modelPath?: string,
) =>
  (await apiClient.get<ApiResponse<'ModelHistoryResponse'>>(
    `/github/model-history?${query({ owner, repo, branch, model_path: modelPath })}`,
    { ...session(githubSession), timeout: 60_000 },
  )).commits ?? [];

export const createPullRequest = (
  githubSession: string,
  body: { owner: string; repo: string; head: string; base: string; title: string; body?: string },
) => apiClient.post<ApiResponse<'CreatePullRequestResponse'>>('/github/pull-request', body, session(githubSession));

/** Outcome of a commit that must not revert newer commits (see GitHubService.commit_tree). */
export type PushStatus = 'pushed' | 'merged' | 'conflict' | 'pull_request';

/** Narrows the schema's `status: str` to the values `GitHubService.commit_tree` returns.
 *  `warnings`: what the save could not do as asked, e.g. the B-UML sources could not be rebuilt. */
export type SaveModelResult = Omit<ApiResponse<'SaveProjectResponse'>, 'status'> & { status: PushStatus };

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
    /** A model file the old GitHub sidebar saved (e.g. `models/shop.json`); the save commit deletes it. */
    legacy_file_path?: string;
  },
) => apiClient.post<SaveModelResult>('/github/project/save', body, { ...session(githubSession), timeout: 60_000 });

/** The repo's model file as stored (a V2 envelope or a legacy project) and the head it was read at. */
export const loadModel = (githubSession: string, owner: string, repo: string, branch: string) =>
  apiClient.get<ApiResponse<'LoadProjectResponse'>>(
    `/github/project/load?${query({ owner, repo, branch })}`,
    { ...session(githubSession), timeout: 60_000 },
  );

export const loadModelAtCommit = (
  githubSession: string, owner: string, repo: string, commitSha: string, modelPath?: string,
) =>
  apiClient.get<ApiResponse<'LoadProjectFromCommitResponse'>>(
    `/github/project/load-commit?${query({ owner, repo, commit_sha: commitSha, model_path: modelPath })}`,
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
  apiClient.post<ApiResponse<'CreateRepoForProjectResponse'>>(
    '/github/project/create-repo',
    body,
    { ...session(githubSession), timeout: 60_000 },
  );

export const createGist = (githubSession: string, project: BesserProject, description: string, isPublic: boolean) =>
  apiClient.post<ApiResponse<'CreateGistResponse'>>(
    '/github/gist/create',
    { project_data: project, description, is_public: isPublic },
    session(githubSession),
  );

/**
 * Register the repo's code as a run the next Spec-Driven modify run can start from.
 * `allowAiReading`: the user agreed that an excerpt of the code goes to the server's AI model.
 * `modelPath`: the model file to read when the repo holds several (the first found otherwise).
 */
export const importRepoAsRun = (
  githubSession: string,
  owner: string,
  repo: string,
  branch?: string,
  { allowAiReading = false, modelPath }: { allowAiReading?: boolean; modelPath?: string } = {},
) =>
  apiClient.post<ImportedRun>(
    '/spec-driven/import-github-run',
    // A demo tab (`?demo=<token>`) has repos read by the demo model rather than the keyless one.
    {
      owner, repo, branch: branch || undefined, demo_token: getDemoToken() ?? undefined,
      allow_ai_reading: allowAiReading, model_path: modelPath,
    },
    // The AI fallback reader can take up to 90 s on top of the download.
    { ...session(githubSession), timeout: 150_000 },
  );

/** `changed` is false when the repo already held these exact deploy files. */
export type GoLiveResult = ApiResponse<'GoLiveResponse'>;

let goLiveAvailable: Promise<boolean> | null = null;

/** Whether the server deploys the project's own repo ("Go live"); asked once per page load. */
export const isGoLiveAvailable = (): Promise<boolean> => {
  goLiveAvailable ??= apiClient
    .get<ApiResponse<'AppCapabilitiesResponse'>>('/github/app/capabilities')
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

/** Fired on `window` to open the top bar's GitHub menu (or start sign-in) from anywhere, e.g. the chat's repo header. */
export const OPEN_GITHUB_PANEL_EVENT = 'wme:open-github-panel';

// Sign-in and star calls answer with the raw `Response`: their callers read the
// body themselves and must not get the client's timeout or 401 event.

/** `GET /github/auth/status`: whether the session still works (`GitHubOAuthResponse`). */
export const getGitHubAuthStatus = (githubSession: string, signal: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/auth/status`, { ...session(githubSession), signal });

/** `POST /github/auth/logout`: end the session on the backend, which also revokes the GitHub token. */
export const logOutOfGitHub = (githubSession: string): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: githubSession }),
  });

/** `GET /github/star/status`: `{starred}` for the BESSER repository. */
export const getStarStatus = (githubSession: string, signal: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/star/status`, { ...session(githubSession), signal });

/** `PUT` (star) or `DELETE` (unstar) `/github/star`. */
export const setStarred = (githubSession: string, starred: boolean): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/star`, { method: starred ? 'PUT' : 'DELETE', ...session(githubSession) });

/** A file from `raw.githubusercontent.com` (a public repository; no backend involved). */
export const fetchRawGitHubFile = (rawUrl: string): Promise<Response> => fetch(rawUrl);
