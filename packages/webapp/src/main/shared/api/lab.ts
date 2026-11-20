/**
 * BESSER Lab calls (BESSER `routers/lab_router.py`): the run stream and the
 * actions on the user's change. Every route needs the `X-GitHub-Session` of an
 * allowed login: 401 without a valid session (marks the tab's GitHub session
 * expired), 403 for a login not on the list, 404 when the lab is switched off.
 *
 * The JSON routes' types are BESSER's response models (`models/lab.py`); the
 * `done` event's `lab` payload is not in the OpenAPI schema, so `LabDone` adds
 * the plan, the model proposal and the final text to the same change view by hand.
 */
import { apiClient, GITHUB_SESSION_REJECTED_EVENT } from './api-client';
import type { components } from './generated/besser-openapi';
import { streamSse } from './sseClient';
import { LAB_MESSAGE_ENDPOINT } from '../constants/constant';

type Schemas = components['schemas'];

/** `ChangeKind` of the lab agent (`besser/spec_driven_agent/lab/contracts.py`). */
export type LabChangeKind = Schemas['ChangeKind'];

/** `auto`: plan when there is no change, else build; `plan` and `build` force the step. */
export type LabAction = NonNullable<Schemas['LabMessageRequest']['action']>;

export type LabStopReason = Schemas['LabChangeView']['stopReason'];

export interface LabPlan {
  kind: LabChangeKind;
  title: string;
  summary: string;
  steps: string[];
  /** Repository keys: `besser`, `frontend`, `modeling_agent`. */
  repos: string[];
  questions: string[];
}

/** The class diagram the plan proposes for a metamodel or diagram-type change, as editor UMLModel JSON. */
export interface LabModelProposal {
  title: string;
  diagramType: 'ClassDiagram';
  model: Record<string, unknown>;
}

export type LabFileChange = Schemas['LabFileChange'];
export type LabRepoChange = Schemas['LabRepoChange'];
export type LabCheck = Schemas['LabCheck'];
/** `done` is null when the rule cannot be judged from the files. */
export type LabChecklistItem = Schemas['LabChecklistItem'];

/** The active change in `GET /lab/state`: the `done` payload without the plan and the model proposal. */
export type LabActiveChange = Schemas['LabChangeView'];

/** The `lab` field of a lab run's `done` event. */
export type LabDone = LabActiveChange & {
  plan: LabPlan | null;
  modelProposal: LabModelProposal | null;
  /** The model's own closing account of a build; "" for a plan. */
  finalText: string;
};

/** `createdAt` is seconds since the epoch (`LabChange.created_at`). */
export type LabParkedChange = Schemas['LabParkedChange'];
export type LabPreviewService = Schemas['LabPreviewService'];
/** `run` is the lab run in progress, if any: `/spec-driven/runs/{runId}/events` follows it, the cancel route stops it. */
export type LabState = Schemas['LabStateResponse'];
export type LabPullRequest = Schemas['LabPullRequest'];
/** `checksNote` says which checks the change passed before it was pushed (the lab runs only the quick ones). */
export type LabPullRequestsResponse = Schemas['LabPullRequestsResponse'];

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
}

/** The backend emits a `cost` event every few seconds, so a minute without a byte is a dead transport. */
export const LAB_STREAM_STALL_TIMEOUT_MS = 60_000;
/** Deadline for the response headers of the run request. */
export const LAB_RESPONSE_TIMEOUT_MS = 45_000;

const STATE_TIMEOUT_MS = 30_000;
/** Park, resume, drop and reset commit and check out branches in up to three repositories. */
const CHANGE_TIMEOUT_MS = 120_000;
/** Commit, push and open a draft pull request in each repository the change touches. */
const PULL_REQUEST_TIMEOUT_MS = 300_000;

const session = (githubSession: string) => ({ 'X-GitHub-Session': githubSession });

/**
 * `POST /lab/message`: run one step (plan or build) for the user's message.
 * The stream is not retried: a run is not idempotent. Cancel a run through
 * the Spec-Driven cancel route with the `runId` of its `start` event.
 */
export function startLabRun<E = LabStreamEvent>(params: StartLabRunParams): LabRunHandle<E> {
  const controller = new AbortController();
  const events = streamSse<E>(
    LAB_MESSAGE_ENDPOINT,
    { message: params.message, action: params.action ?? 'auto', project: params.project ?? null },
    {
      signal: controller.signal,
      headers: session(params.githubSession),
      onResponse: (response) => {
        if (response.status === 401) window.dispatchEvent(new Event(GITHUB_SESSION_REJECTED_EVENT));
      },
      stallTimeoutMs: LAB_STREAM_STALL_TIMEOUT_MS,
      responseTimeoutMs: LAB_RESPONSE_TIMEOUT_MS,
    },
  );
  return { events, abort: () => controller.abort(), controller };
}

/** `GET /lab/state`: the signed-in user, the active and parked changes, the preview services. */
export const getLabState = (githubSession: string): Promise<LabState> =>
  apiClient.get<LabState>('/lab/state', { headers: session(githubSession), timeout: STATE_TIMEOUT_MS });

/**
 * `POST /lab/pull-request`: push change `changeId` and open one draft pull request per
 * repository it touches. The server acts only on the active change (409 otherwise), so
 * this resolves null, opening nothing, when `changeId` is not the active change.
 */
export async function openLabPullRequests(
  githubSession: string,
  changeId: string,
  { title = null, body = null }: { title?: string | null; body?: string | null } = {},
): Promise<LabPullRequestsResponse | null> {
  if ((await getLabState(githubSession)).change?.changeId !== changeId) return null;
  return apiClient.post<LabPullRequestsResponse>(
    '/lab/pull-request',
    { changeId, title, body },
    { headers: session(githubSession), timeout: PULL_REQUEST_TIMEOUT_MS },
  );
}

const changeAction = (githubSession: string, path: string, body: Record<string, unknown> = {}): Promise<LabState> =>
  apiClient.post<LabState>(path, body, { headers: session(githubSession), timeout: CHANGE_TIMEOUT_MS });

/** `POST /lab/change/park`: commit the active change's work in progress and return to the base branches. */
export const parkLabChange = (githubSession: string) => changeAction(githubSession, '/lab/change/park');

/** `POST /lab/change/resume`: check out a parked change again. */
export const resumeLabChange = (githubSession: string, changeId: string) =>
  changeAction(githubSession, '/lab/change/resume', { changeId });

/** `POST /lab/change/drop`: delete the active change's branches and notes. */
export const dropLabChange = (githubSession: string) => changeAction(githubSession, '/lab/change/drop');

/** `POST /lab/preview/reset`: check out the base branches in the working copy; 409 while a change is active. */
export const resetLabPreview = (githubSession: string) => changeAction(githubSession, '/lab/preview/reset');
