/**
 * BESSER Lab calls (BESSER `routers/lab_router.py`): the run stream, the changes, their review,
 * the preview slots, the settings and usage, and the team memory. Every route needs the
 * `X-GitHub-Session` of an allowed login: 401 without a valid session (marks the tab's GitHub
 * session expired), 403 for a login not on the list, 404 when the lab is switched off. A lab
 * refusal answers `{"detail": {"code", "message"}}`; `labRefusal` reads it.
 *
 * Every type is BESSER's model of the same name (`models/lab.py`), from the generated schema.
 */
import { ApiError, apiClient, GITHUB_SESSION_REJECTED_EVENT, type ApiRequestOptions } from './api-client';
import type { components } from './generated/besser-openapi';
import { SseHttpError, streamSse } from './sseClient';
import { LAB_MESSAGE_ENDPOINT } from '../constants/constant';

type Schemas = components['schemas'];

/** `ChangeKind` of the lab agent (`besser/spec_driven_agent/lab/contracts.py`). */
export type LabChangeKind = Schemas['ChangeKind'];
/** `auto`: plan while the change has no approved plan, else build; `plan` and `build` force the step. */
export type LabAction = Schemas['LabMessageRequest']['action'];
export type LabStopReason = Schemas['LabChangeView']['stopReason'];
/** `besser`, `frontend` or `modeling_agent`. */
export type LabRepoKey = Schemas['LabIssueRef']['repo'];
/** Where a change stands, for the home's list and the change header. */
export type LabPhase = Schemas['LabChangeSummary']['phase'];
export type LabRefusalCode = Schemas['LabRefusalDetail']['code'];
export type LabPreviewServiceName = Schemas['LabPreviewService']['name'];

// Requests.
export type LabIssueRef = Schemas['LabIssueRef'];
export type LabReviewTask = Schemas['LabReviewTask'];
export type LabMessageRequest = Schemas['LabMessageRequest'];
export type LabPullRequestRequest = Schemas['LabPullRequestRequest'];
export type LabChangeRequest = Schemas['LabChangeRequest'];
export type LabUpdateBranchRequest = Schemas['LabUpdateBranchRequest'];
export type LabTakeSlotRequest = Schemas['LabTakeSlotRequest'];
export type LabTouchSlotRequest = Schemas['LabTouchSlotRequest'];
export type LabPreviewRestartRequest = Schemas['LabPreviewRestartRequest'];
export type LabProposalRef = Schemas['LabProposalRef'];
export type LabNoteInput = Schemas['LabNoteInput'];

// A change and its last run.
export type LabFileChange = Schemas['LabFileChange'];
export type LabRepoChange = Schemas['LabRepoChange'];
export type LabCheck = Schemas['LabCheck'];
/** `done` is null when the rule cannot be judged from the files. */
export type LabChecklistItem = Schemas['LabChecklistItem'];
export type LabPlan = Schemas['LabPlan'];
/** The class diagram the plan proposes for a metamodel or diagram-type change, as editor UMLModel JSON. */
export type LabModelProposal = Schemas['LabModelProposal'];
export type LabBuildReport = Schemas['LabBuildReport'];
export type LabChangeCost = Schemas['LabChangeCost'];
export type LabPullRequest = Schemas['LabPullRequest'];
export type LabIssue = Schemas['LabIssue'];
export type LabChangeView = Schemas['LabChangeView'];
export type LabNoteProposal = Schemas['LabNoteProposal'];
/** The `lab` field of a lab run's `done` event. */
export type LabDone = Schemas['LabDone'];

// Refusals, users, bases and budget.
export type LabRefusalDetail = Schemas['LabRefusalDetail'];
export type LabRefusalResponse = Schemas['LabRefusalResponse'];
export type LabUserView = Schemas['LabUserView'];
export type LabBase = Schemas['LabBase'];
export type LabMeter = Schemas['LabMeter'];
export type LabMeters = Schemas['LabMeters'];
/** A run in progress: `/spec-driven/runs/{runId}/events` follows it, the cancel route stops it. */
export type LabRun = Schemas['LabRun'];
export type LabRunsView = Schemas['LabRunsView'];
export type LabMemoryInfo = Schemas['LabMemoryInfo'];
export type LabHomeResponse = Schemas['LabHomeResponse'];

// Changes and their thread.
export type LabRunRecord = Schemas['LabRunRecord'];
export type LabChangeSummary = Schemas['LabChangeSummary'];
export type LabChangesResponse = Schemas['LabChangesResponse'];
export type LabRepoBaseStatus = Schemas['LabRepoBaseStatus'];
export type LabRunError = Schemas['LabRunError'];
export type LabThreadMessage = Schemas['LabThreadMessage'];
export type LabThreadRun = Schemas['LabThreadRun'];
export type LabThreadPullRequests = Schemas['LabThreadPullRequests'];
export type LabThreadNotice = Schemas['LabThreadNotice'];
/** One item of a change's thread, told apart by `type`. */
export type LabThreadItem = Schemas['LabChangeDetail']['thread'][number];
export type LabChangeDetail = Schemas['LabChangeDetail'];
/** `checksNote` says which checks the change passed before it was pushed (the lab runs only the quick ones). */
export type LabPullRequestsResponse = Schemas['LabPullRequestsResponse'];

// Review.
export type LabFileDiff = Schemas['LabFileDiff'];
export type LabRepoDiff = Schemas['LabRepoDiff'];
export type LabDiffResponse = Schemas['LabDiffResponse'];
export type LabCheckRun = Schemas['LabCheckRun'];
export type LabReviewComment = Schemas['LabReviewComment'];
export type LabReview = Schemas['LabReview'];
export type LabPullRequestStatus = Schemas['LabPullRequestStatus'];
export type LabReviewResponse = Schemas['LabReviewResponse'];
export type LabUpdateBranchResponse = Schemas['LabUpdateBranchResponse'];

// Preview.
export type LabPreviewService = Schemas['LabPreviewService'];
/**
 * A preview's backend, editor and modeling agent. Not in the schema of its own: no route answers it
 * alone, only as the base of `LabPreviewSlot`.
 */
export type LabPreview = Pick<Schemas['LabPreviewSlot'], 'enabled' | 'url' | 'confined' | 'detail' | 'services'>;
export type LabPreviewSlot = Schemas['LabPreviewSlot'];
export type LabPreviewView = Schemas['LabPreviewView'];
export type LabPreviewLog = Schemas['LabPreviewLog'];

// Settings, usage and team memory.
export type LabLimitsView = Schemas['LabLimitsView'];
export type LabSettingsResponse = Schemas['LabSettingsResponse'];
export type LabAuditEntry = Schemas['LabAuditEntry'];
export type LabAuditResponse = Schemas['LabAuditResponse'];
export type LabNote = Schemas['LabNote'];
export type LabMemoryResponse = Schemas['LabMemoryResponse'];

/** Any event of the run stream; the caller narrows it (the Spec-Driven event types). */
export interface LabStreamEvent {
  event: string;
  [field: string]: unknown;
}

/** Same shape as the Spec-Driven client's `SpecDrivenRunHandle` when `E` is its event type. */
export interface LabRunHandle<E> {
  events: AsyncGenerator<E, void, void>;
  abort: () => void;
  controller: AbortController;
}

export interface StartLabRunParams {
  message: string;
  action?: LabAction;
  /** The project reduced to what the lab reads (its class diagram), or null. */
  project?: Record<string, unknown> | null;
  githubSession: string;
  /** The change the message goes to: the one in the editor's URL. */
  changeId: string;
  /** A task on the change's pull requests; it forces the build step. */
  review?: LabReviewTask | null;
  /** The issue the change starts from. */
  issue?: LabIssueRef | null;
}

/** The backend emits a `cost` event every few seconds, so a minute without a byte is a dead transport. */
export const LAB_STREAM_STALL_TIMEOUT_MS = 60_000;
/** Deadline for the response headers of the run request. */
export const LAB_RESPONSE_TIMEOUT_MS = 45_000;

/** Reads of the lab's own state files. */
const READ_TIMEOUT_MS = 30_000;
/** A diff or review status: git over every changed file, or several GitHub GraphQL and log reads. */
const REVIEW_TIMEOUT_MS = 60_000;
/** Creating, closing or dropping a change, or a preview slot action: worktrees and services in up to three repositories. */
const CHANGE_TIMEOUT_MS = 120_000;
/** A push, a pull request, an update from the base or a refresh of the bases: git over the network in each repository. */
const GIT_NETWORK_TIMEOUT_MS = 300_000;

const session = (githubSession: string) => ({ 'X-GitHub-Session': githubSession });

const query = (params: Record<string, string | number | null | undefined>): string => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(name, String(value));
  }
  return search.toString();
};

const get = <T>(githubSession: string, path: string, timeout = READ_TIMEOUT_MS): Promise<T> =>
  apiClient.get<T>(path, { headers: session(githubSession), timeout });

const post = <T>(githubSession: string, path: string, body: unknown, timeout = READ_TIMEOUT_MS): Promise<T> =>
  apiClient.post<T>(path, body, { headers: session(githubSession), timeout });

/**
 * A route that answers 204. `apiClient` parses every successful body as JSON, which an empty body
 * is not; it reaches that parse only for a 2xx response, so a `SyntaxError` here is the success.
 */
async function noContent(githubSession: string, path: string, init: ApiRequestOptions): Promise<void> {
  try {
    await apiClient.request<unknown>(path, { ...init, headers: session(githubSession), timeout: READ_TIMEOUT_MS });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
}

/**
 * `POST /lab/message`: run the next step (plan or build) of change `changeId` for the user's
 * message. The stream is not retried: a run is not idempotent. Cancel a run through the
 * Spec-Driven cancel route with the `runId` of its `start` event.
 */
export function startLabRun<E = LabStreamEvent>(params: StartLabRunParams): LabRunHandle<E> {
  const controller = new AbortController();
  const body = {
    message: params.message,
    action: params.action ?? 'auto',
    project: params.project ?? null,
    changeId: params.changeId,
    review: params.review ?? null,
    issue: params.issue ?? null,
  };
  const events = streamSse<E>(LAB_MESSAGE_ENDPOINT, body, {
    signal: controller.signal,
    headers: session(params.githubSession),
    onResponse: (response) => {
      if (response.status === 401) window.dispatchEvent(new Event(GITHUB_SESSION_REJECTED_EVENT));
    },
    stallTimeoutMs: LAB_STREAM_STALL_TIMEOUT_MS,
    responseTimeoutMs: LAB_RESPONSE_TIMEOUT_MS,
  });
  return { events, abort: () => controller.abort(), controller };
}

/** `GET /lab/home`: the signed-in user, the bases, the runs in progress, this month's meters, the memory. */
export const getLabHome = (githubSession: string): Promise<LabHomeResponse> => get(githubSession, '/lab/home');

/** `GET /lab/changes`: open changes and drafts by last update, then the latest closed ones. */
export const listLabChanges = (githubSession: string): Promise<LabChangesResponse> =>
  get(githubSession, '/lab/changes');

/** `POST /lab/change`: a new draft change, owned by the signed-in user. */
export const createLabChange = (githubSession: string): Promise<LabChangeDetail> =>
  apiClient.request<LabChangeDetail>('/lab/change', {
    method: 'POST',
    headers: session(githubSession),
    timeout: CHANGE_TIMEOUT_MS,
  });

/** `GET /lab/change`: one change with its thread, its bases and its run records. */
export const getLabChange = (githubSession: string, changeId: string): Promise<LabChangeDetail> =>
  get(githubSession, `/lab/change?${query({ changeId })}`);

/** `POST /lab/change/drop`: delete the change, its trees, branches and state (owner or admin). */
export const dropLabChange = (githubSession: string, changeId: string): Promise<LabChangesResponse> =>
  post(githubSession, '/lab/change/drop', { changeId } satisfies LabChangeRequest, CHANGE_TIMEOUT_MS);

/** `POST /lab/change/close`: close the change (merged or not); its trees and branches are removed, its state kept. */
export const closeLabChange = (githubSession: string, changeId: string): Promise<LabChangeDetail> =>
  post(githubSession, '/lab/change/close', { changeId } satisfies LabChangeRequest, CHANGE_TIMEOUT_MS);

/** `POST /lab/change/update-base`: bring one repository of the change up to its base branch. */
export const updateLabChangeFromBase = (
  githubSession: string,
  changeId: string,
  repo: LabRepoKey,
): Promise<LabUpdateBranchResponse> =>
  post(
    githubSession,
    '/lab/change/update-base',
    { changeId, repo } satisfies LabUpdateBranchRequest,
    GIT_NETWORK_TIMEOUT_MS,
  );

/**
 * `POST /lab/pull-request`: push change `changeId` and open (or update) one draft pull request per
 * repository it touches. Null title and body take the server's; `closesIssues` must be among the
 * change's issues.
 */
export const openLabPullRequests = (
  githubSession: string,
  changeId: string,
  {
    title = null,
    body = null,
    closesIssues = [],
  }: { title?: string | null; body?: string | null; closesIssues?: LabIssueRef[] } = {},
): Promise<LabPullRequestsResponse> =>
  post(
    githubSession,
    '/lab/pull-request',
    { changeId, title, body, closesIssues } satisfies LabPullRequestRequest,
    GIT_NETWORK_TIMEOUT_MS,
  );

/** `GET /lab/diff`: the change's working trees against their bases; with `file`, that one file uncapped. */
export const getLabDiff = (
  githubSession: string,
  changeId: string,
  file?: { repo: LabRepoKey; path: string },
): Promise<LabDiffResponse> =>
  get(githubSession, `/lab/diff?${query({ changeId, repo: file?.repo, path: file?.path })}`, REVIEW_TIMEOUT_MS);

/** `GET /lab/review`: the change's pull requests as GitHub reports them now, and whether it can close. */
export const getLabReview = (githubSession: string, changeId: string): Promise<LabReviewResponse> =>
  get(githubSession, `/lab/review?${query({ changeId })}`, REVIEW_TIMEOUT_MS);

/** `GET /lab/preview`: every preview slot and the change it shows. */
export const getLabPreview = (githubSession: string): Promise<LabPreviewView> => get(githubSession, '/lab/preview');

/** `POST /lab/preview/slot`: show change `changeId` in a preview slot. */
export const takeLabPreviewSlot = (githubSession: string, changeId: string): Promise<LabPreviewSlot> =>
  post(githubSession, '/lab/preview/slot', { changeId } satisfies LabTakeSlotRequest, CHANGE_TIMEOUT_MS);

/** `POST /lab/preview/slot/touch`: the slot is still in use (keeps another change from taking it). */
export const touchLabPreviewSlot = (githubSession: string, slot: number): Promise<void> =>
  noContent(githubSession, '/lab/preview/slot/touch', {
    method: 'POST',
    body: JSON.stringify({ slot } satisfies LabTouchSlotRequest),
  });

/** `POST /lab/preview/restart`: restart one service of a slot, or all three without `service`. */
export const restartLabPreview = (
  githubSession: string,
  slot: number,
  service?: LabPreviewServiceName,
): Promise<LabPreviewView> =>
  post(
    githubSession,
    '/lab/preview/restart',
    { slot, service: service ?? null } satisfies LabPreviewRestartRequest,
    CHANGE_TIMEOUT_MS,
  );

/** `GET /lab/preview/logs/{service}`: the last `lines` lines of a slot service's log, redacted. */
export const getLabPreviewLog = (
  githubSession: string,
  slot: number,
  service: LabPreviewServiceName,
  lines = 200,
): Promise<LabPreviewLog> =>
  get(githubSession, `/lab/preview/logs/${encodeURIComponent(service)}?${query({ slot, lines })}`);

/** `GET /lab/settings`: repositories, limits, admins and this month's spending. */
export const getLabSettings = (githubSession: string): Promise<LabSettingsResponse> =>
  get(githubSession, '/lab/settings');

/** `POST /lab/settings/refresh-bases`: fetch every base branch now. */
export const refreshLabBases = (githubSession: string): Promise<LabSettingsResponse> =>
  apiClient.request<LabSettingsResponse>('/lab/settings/refresh-bases', {
    method: 'POST',
    headers: session(githubSession),
    timeout: GIT_NETWORK_TIMEOUT_MS,
  });

/** `GET /lab/audit`: one UTC month (`YYYY-MM`, default the current one) of the audit log. */
export const getLabAudit = (githubSession: string, month?: string): Promise<LabAuditResponse> =>
  get(githubSession, `/lab/audit${month ? `?${query({ month })}` : ''}`);

/** `GET /lab/memory`: the team's approved notes. */
export const getLabMemory = (githubSession: string): Promise<LabMemoryResponse> => get(githubSession, '/lab/memory');

/** `POST /lab/memory`: a new team note; with `fromProposal`, the approval of a run's proposal. */
export const createLabNote = (githubSession: string, note: LabNoteInput): Promise<LabNote> =>
  post(githubSession, '/lab/memory', note);

/** `PUT /lab/memory/{note_id}`: replace a team note. */
export const updateLabNote = (githubSession: string, noteId: string, note: LabNoteInput): Promise<LabNote> =>
  apiClient.request<LabNote>(`/lab/memory/${encodeURIComponent(noteId)}`, {
    method: 'PUT',
    body: JSON.stringify(note),
    headers: session(githubSession),
    timeout: READ_TIMEOUT_MS,
  });

/** `DELETE /lab/memory/{note_id}`. */
export const deleteLabNote = (githubSession: string, noteId: string): Promise<void> =>
  noContent(githubSession, `/lab/memory/${encodeURIComponent(noteId)}`, { method: 'DELETE' });

/** `POST /lab/memory/proposals/dismiss`: drop a note a run proposed without keeping it. */
export const dismissLabNoteProposal = (githubSession: string, proposal: LabProposalRef): Promise<void> =>
  noContent(githubSession, '/lab/memory/proposals/dismiss', { method: 'POST', body: JSON.stringify(proposal) });

/** Every refusal code, so a code the editor does not know reads as `unknown`. */
const REFUSAL_CODES: Record<LabRefusalCode, true> = {
  change_busy: true,
  runs_full: true,
  user_cap: true,
  instance_cap: true,
  not_owner: true,
  preview_full: true,
  not_found: true,
  state: true,
};

const isRefusalCode = (code: unknown): code is LabRefusalCode =>
  typeof code === 'string' && Object.prototype.hasOwnProperty.call(REFUSAL_CODES, code);

/** The `detail` of a failed lab request's body: parsed from a stream's body, as kept by `ApiError`. */
function failureDetail(error: unknown): unknown {
  if (error instanceof SseHttpError) {
    try {
      return (JSON.parse(error.body) as { detail?: unknown } | null)?.detail;
    } catch {
      return undefined;
    }
  }
  // `ApiError` keeps only the readable text of the detail (its `message` for a refusal), not its code.
  if (error instanceof ApiError) return error.detail;
  return undefined;
}

/**
 * Why the lab refused a request: `{detail: {code, message}}`. A plain string detail (the 401, 403
 * and 404 of the lab's sign-in check) and any other failure are `unknown`, with the best text there is.
 */
export function labRefusal(error: unknown): { code: LabRefusalCode | 'unknown'; message: string } {
  const detail = failureDetail(error);
  if (detail && typeof detail === 'object') {
    const { code, message } = detail as { code?: unknown; message?: unknown };
    if (typeof message === 'string' && message) return { code: isRefusalCode(code) ? code : 'unknown', message };
  }
  if (typeof detail === 'string' && detail) return { code: 'unknown', message: detail };
  return { code: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

// -- Phase 1 shims: their routes are gone; their callers are rewritten in later waves. ------------------

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export interface LabParkedChange {
  changeId: string;
  title: string;
  kind: LabChangeKind;
  /** seconds since the epoch */
  createdAt: number;
}

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export interface LabState {
  enabled: boolean;
  user: string;
  change: LabChangeView | null;
  parked: LabParkedChange[];
  preview: { enabled: boolean; services: LabPreviewService[] };
  run: LabRun | null;
}

/** Park, resume, drop and reset committed and checked out branches in up to three repositories. */
const changeAction = (githubSession: string, path: string, body: Record<string, unknown> = {}): Promise<LabState> =>
  post(githubSession, path, body, CHANGE_TIMEOUT_MS);

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export const getLabState = (githubSession: string): Promise<LabState> => get(githubSession, '/lab/state');

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export const parkLabChange = (githubSession: string) => changeAction(githubSession, '/lab/change/park');

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export const resumeLabChange = (githubSession: string, changeId: string) =>
  changeAction(githubSession, '/lab/change/resume', { changeId });

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export const dropActiveLabChange = (githubSession: string) => changeAction(githubSession, '/lab/change/drop');

/** @deprecated BESSER Lab phase 1; removed by W6-B */
export const resetLabPreview = (githubSession: string) => changeAction(githubSession, '/lab/preview/reset');
