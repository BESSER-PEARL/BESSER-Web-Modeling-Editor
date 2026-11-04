/**
 * Typed calls to the backend's GitHub endpoints that keep a project and its
 * repository in step. Contract: BESSER `services/deployment/github_deploy_api.py`
 * (`/github/*`) and `routers/spec_driven_router.py` (`/spec-driven/*`).
 */
import { apiClient } from './api-client';
import type { components, operations } from './generated/besser-openapi';
import { BACKEND_URL } from '../constants/constant';
import type { BesserProject } from '../types/project';
import type { ProjectExportEnvelope } from '../utils/projectExportUtils';
import { getDemoToken } from '../services/demoMode';

/** `origin`: the commit's `BESSER-Origin` trailer as written (BESSER writes
 *  `spec-driven-agent` or `editor`); null when a person made it. */
export type RepoCommit = components['schemas']['GitHubCommitResponse'];

/** `can_push` is false for a repository the user may only read. */
export type RepoListing = components['schemas']['GitHubRepoResponse'];

/** `truncated`: the account has more repositories than the list holds. */
export type RepoList = components['schemas']['GitHubReposListResponse'];

/** `model_path`: where the model was read (`buml/diagrams.json`, or a file an older editor saved);
 *  `model_paths`: every file holding a BESSER model, more than one lets the user pick. */
export type RepoSummary = components['schemas']['RepoSummaryResponse'];

/** Where a save or push kept on its own branch stands. */
export type PendingChangeStatus = components['schemas']['PendingChangeStatus'];

/** `commits_since`: commits on the branch since the editor's last sync, newest
 *  first; `pending` is set when the request named a pending branch. */
export type SyncStatus = components['schemas']['SyncStatusResponse'];

export type ModelHistoryEntry = components['schemas']['ModelHistoryEntry'];

/** What BESSER read in a repo it did not create. */
export type RepoAnalysis = components['schemas']['CodeAnalysisResponse'];

/**
 * `analysis`: what the code of a repo without a BESSER model holds;
 * `proposed_diagram`: a class diagram read from its data classes, in the shape
 * the editor imports; `ai_reading_offered`: no data classes were readable and an
 * AI reading could propose a model (import again with `allowAiReading` once the
 * user agreed); `model_path`: where `project` was read.
 */
export type ImportedRun = components['schemas']['ImportGitHubRunResponse'];

/** What was done on a repo's app and where it stands; every value is text from the repository. */
export type RepoRecap = components['schemas']['RepoRecap'];

/** The GitHub topic BESSER sets on every repo it pushes to. */
export const BESSER_TOPIC = 'besser';

const session = (githubSession: string) => ({ headers: { 'X-GitHub-Session': githubSession } });
const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();

/** Every repository the user can open: their own, their collaborations and their organizations'. */
export const listRepos = (githubSession: string): Promise<RepoList> =>
  apiClient.get<RepoList>('/github/repos', { ...session(githubSession), timeout: 60_000 });

export const listBranches = async (githubSession: string, owner: string, repo: string): Promise<string[]> =>
  (await apiClient.get<components['schemas']['GitHubBranchesListResponse']>(`/github/branches?${query({ owner, repo })}`, session(githubSession)))
    .branches;

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
  (await apiClient.get<components['schemas']['ModelHistoryResponse']>(
    `/github/model-history?${query({ owner, repo, branch, model_path: modelPath })}`,
    { ...session(githubSession), timeout: 60_000 },
  )).commits;

export const createPullRequest = (
  githubSession: string,
  body: { owner: string; repo: string; head: string; base: string; title: string; body?: string },
) => apiClient.post<components['schemas']['CreatePullRequestResponse']>('/github/pull-request', body, session(githubSession));

/** `status`: what `GitHubService.commit_tree` did, a save never reverts newer commits;
 *  `warnings`: what the save could not do as asked, e.g. the B-UML sources could not be rebuilt. */
export type SaveModelResult = components['schemas']['SaveProjectResponse'];

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
  apiClient.get<components['schemas']['LoadProjectResponse']>(
    `/github/project/load?${query({ owner, repo, branch })}`,
    { ...session(githubSession), timeout: 60_000 },
  );

export const loadModelAtCommit = (
  githubSession: string, owner: string, repo: string, commitSha: string, modelPath?: string,
) =>
  apiClient.get<components['schemas']['LoadProjectFromCommitResponse']>(
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
  apiClient.post<components['schemas']['CreateRepoForProjectResponse']>(
    '/github/project/create-repo',
    body,
    { ...session(githubSession), timeout: 60_000 },
  );

export const createGist = (githubSession: string, project: BesserProject, description: string, isPublic: boolean) =>
  apiClient.post<components['schemas']['CreateGistResponse']>(
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
  { allowAiReading = false, modelPath, signal }: { allowAiReading?: boolean; modelPath?: string; signal?: AbortSignal } = {},
) =>
  apiClient.post<ImportedRun>(
    '/spec-driven/import-github-run',
    // A demo tab (`?demo=<token>`) has repos read by the demo model rather than the keyless one.
    {
      owner, repo, branch: branch || undefined, demo_token: getDemoToken() ?? undefined,
      allow_ai_reading: allowAiReading, model_path: modelPath,
    },
    // The AI fallback reader can take up to 90 s on top of the download.
    { ...session(githubSession), timeout: 150_000, signal },
  );

/** `POST /github/deploy-webapp` takes the project with `deploy_config` and `projectExport` as an open object. */
export type DeployToGitHubBody =
  operations['deploy_webapp_to_github_besser_api_github_deploy_webapp_post']['requestBody']['content']['application/json'];

/** Generate the project's web app (or agent) and commit it to a new or existing repo. */
export const deployToGitHub = (githubSession: string, body: DeployToGitHubBody) =>
  apiClient.post<components['schemas']['DeployToGitHubResponse']>('/github/deploy-webapp', body, {
    ...session(githubSession),
    // Several GitHub API calls plus code generation, observed up to ~37 s.
    timeout: 120_000,
  });

/** `projectExport`: the re-importable model the push writes next to the run's code. */
export type PushRunBody = Omit<components['schemas']['PushSmartToGitHubRequest'], 'projectExport'> & {
  projectExport: ProjectExportEnvelope;
};

/** `POST /spec-driven/push-to-github`: commit a finished Spec-Driven run's stored code to a repo. */
export const pushRunToGitHub = (githubSession: string, body: PushRunBody) =>
  apiClient.post<components['schemas']['PushSmartToGitHubResponse']>('/spec-driven/push-to-github', body, {
    ...session(githubSession),
    // Code generation plus several GitHub API calls, as for a deploy.
    timeout: 120_000,
  });

/** `changed` is false when the repo already held these exact deploy files. */
export type GoLiveResult = components['schemas']['GoLiveResponse'];

let goLiveAvailable: Promise<boolean> | null = null;

/** Whether the server deploys the project's own repo ("Go live"); asked once per page load. */
export const isGoLiveAvailable = (): Promise<boolean> => {
  goLiveAvailable ??= apiClient
    .get<components['schemas']['AppCapabilitiesResponse']>('/github/app/capabilities')
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

// Raw `fetch` stays where apiClient cannot send the same request: it adds
// `Content-Type: application/json` to every call and rejects a non-2xx answer,
// while these callers read the raw `Response` (status and body) themselves.

/** `GET /github/auth/status`: whether the session still works (`GitHubOAuthResponse`). Raw: the
 *  caller reads every answer itself, a 401 included, which apiClient would turn into its rejected-session event. */
export const getGitHubAuthStatus = (githubSession: string, signal: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/auth/status`, { ...session(githubSession), signal });

/** `POST /github/auth/logout`: end the session on the backend, which also revokes the GitHub token. */
export const logOutOfGitHub = (githubSession: string) =>
  apiClient.post<unknown>('/github/auth/logout', { session_id: githubSession });

/** `GET /github/star/status`: `{starred}` for the BESSER repository. Raw: a GET without a content type. */
export const getStarStatus = (githubSession: string, signal: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/star/status`, { ...session(githubSession), signal });

/** `PUT` (star) or `DELETE` (unstar) `/github/star`. Raw: no body, so no content type; the caller reads `ok`. */
export const setStarred = (githubSession: string, starred: boolean): Promise<Response> =>
  fetch(`${BACKEND_URL}/github/star`, { method: starred ? 'PUT' : 'DELETE', ...session(githubSession) });

/** A file from `raw.githubusercontent.com` (a public repository). Raw: not the backend apiClient is bound to. */
export const fetchRawGitHubFile = (rawUrl: string): Promise<Response> => fetch(rawUrl);
