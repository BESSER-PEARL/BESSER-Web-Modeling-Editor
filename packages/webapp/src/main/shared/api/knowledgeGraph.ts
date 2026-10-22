import type { TFunction } from 'i18next';
import { apiClient } from './api-client';
import type { ConsistencyReport, KnowledgeGraphData, ProjectDiagram, ProjectDiagramModel } from '../types/project';

/**
 * API layer for the Knowledge Graph feature.
 *
 * One function per endpoint (`/besser_api/kg/...`); the flows built on them
 * (batching, merging, retries) belong to the features that use them. Every KG
 * HTTP call goes through the shared `apiClient` (timeouts, `{"detail"}` error
 * parsing into `ApiError`). The response types below mirror the backend's
 * `backend/models/responses.py`; a change there is a change here.
 */

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/** How much longer than the server's own deadline the browser waits for an LLM
 *  call: room for the network and the request body, so the server's answer
 *  (or its timeout error) arrives before the browser gives up. */
const LLM_TIMEOUT_MARGIN_MS = 10_000;
/** Parsing a large ontology and converting a graph are CPU work on the server. */
const HEAVY_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Server-owned limits
// ---------------------------------------------------------------------------

/** Backend `GET /kg/config`: the limits the server enforces on the KG LLM
 *  endpoints. Never hardcode a copy: a stale one silently becomes the binding
 *  limit (a timeout shorter than the server's, or a batch it rejects). */
export interface KgConfig {
  /** Overall deadline, in seconds, the server gives one KG LLM request. */
  llmRequestTimeoutSeconds: number;
  /** Most node ids one `/kg/classify-orphans` request may carry. */
  maxOrphanClassifyNodes: number;
}

/** The server's KG limits could not be loaded, so no LLM call is attempted
 *  (guessing them could cut a request short or send a batch it rejects). */
export class KgConfigUnavailableError extends Error {
  constructor(public readonly reason?: unknown) {
    super('Could not load the Knowledge Graph limits from the server.');
    this.name = 'KgConfigUnavailableError';
  }
}

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function parseKgConfig(raw: unknown): KgConfig {
  const data = raw as Partial<KgConfig> | null | undefined;
  const timeout = data?.llmRequestTimeoutSeconds;
  const maxNodes = data?.maxOrphanClassifyNodes;
  if (!isPositiveNumber(timeout) || !isPositiveNumber(maxNodes) || maxNodes < 1) {
    throw new Error(`Unexpected /kg/config payload: ${JSON.stringify(raw)}`);
  }
  return { llmRequestTimeoutSeconds: timeout, maxOrphanClassifyNodes: Math.floor(maxNodes) };
}

let kgConfigPromise: Promise<KgConfig> | null = null;

/**
 * The server's KG limits, fetched once per page load (the promise is cached,
 * as `getSpecDrivenConfig` does). Unlike that config there is no hardcoded
 * fallback: a failure rejects with `KgConfigUnavailableError` and clears the
 * cache, so the next call retries against a recovered backend.
 */
export function getKgConfig(): Promise<KgConfig> {
  if (!kgConfigPromise) {
    kgConfigPromise = apiClient
      .get<unknown>('/kg/config')
      .then(parseKgConfig)
      .catch((error: unknown) => {
        kgConfigPromise = null;
        throw new KgConfigUnavailableError(error);
      });
  }
  return kgConfigPromise;
}

/** Test-only: forget the cached config. */
export function _resetKgConfigCacheForTests(): void {
  kgConfigPromise = null;
}

/** The browser-side timeout of one KG LLM request. */
const llmTimeoutMs = (config: KgConfig) => config.llmRequestTimeoutSeconds * 1000 + LLM_TIMEOUT_MARGIN_MS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Backend `KGActionResponse`: a pre-filled action attached to a preflight issue. */
export interface KgAction {
  key: string;
  parameters: Record<string, unknown>;
  label: string;
}

/** Backend `KGIssueResponse`: one KG element with no clean 1-to-1 B-UML mapping. */
export interface KgIssue {
  id: string;
  code: string;
  description: string;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  recommendedAction: KgAction | null;
  skipAction: KgAction | null;
}

/** Backend `KGPreflightReportResponse`: answer of `/kg/preflight`,
 *  `/kg/llm-clean` and `/kg/classify-orphans`. */
export interface KgPreflightReport {
  kgSignature: string;
  diagramType: string;
  issueCount: number;
  issues: KgIssue[];
}

/** Backend `KGConsistencyReportResponse`. Declared with the project types. */
export type KgConsistencyReport = ConsistencyReport;

/** Backend `KGPendingOrphanClassification`. */
export interface KgPendingOrphanClassification {
  nodeIds: string[];
  kgSignature: string;
}

/** Backend `KGRefinementResponse`: answer of `/kg/apply-refinement`. */
export interface KgRefinementResponse {
  title: string;
  model: KnowledgeGraphData;
  diagramType: string;
  kgSignature: string;
  pendingOrphanClassification?: KgPendingOrphanClassification | null;
  exportedAt?: string;
  version?: string;
}

/** Backend `DiagramExportResponse`: answer of `/kg/import-owl` (a KG model) and
 *  `/kg/to-class-diagram` (a class diagram model). `warnings` is the
 *  conversion's list of `{code, message}` anomalies. */
export interface KgDiagramResponse<TModel> {
  title: string;
  model: TModel;
  diagramType: string;
  exportedAt?: string;
  version?: string;
  warnings?: Array<Record<string, unknown>> | null;
}

export type KgDecision = 'accept' | 'skip';
export interface KgResolution {
  issueId: string;
  decision: KgDecision;
}

/** RDF serialisations the backend can export. */
export type KgRdfFormat = 'owl' | 'ttl';
/** Which constraint vocabularies to emit alongside the domain triples
 *  (the backend's `vocab` parameter). */
export type KgRdfVocab = 'owl' | 'shacl' | 'both';

/** The part of a project diagram the backend needs (its `DiagramInput`). */
export type KgDiagramRef = Pick<ProjectDiagram, 'id' | 'title' | 'model'>;

const diagramBody = (diagram: KgDiagramRef) => ({
  id: diagram.id,
  title: diagram.title,
  model: diagram.model,
});

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

/** Static preflight: every element that has no clean B-UML mapping. */
export const analyzeKg = (diagram: KgDiagramRef): Promise<KgPreflightReport> =>
  apiClient.post<KgPreflightReport>('/kg/preflight', diagramBody(diagram));

/** OWL2 + SHACL consistency check of the graph's data. */
export const checkKgConsistency = (diagram: KgDiagramRef): Promise<KgConsistencyReport> =>
  apiClient.post<KgConsistencyReport>('/kg/consistency', diagramBody(diagram));

export interface ApplyKgRefinementRequest {
  diagram: KgDiagramRef;
  /** Where the issues came from: the static preflight, or the LLM tab. */
  source: 'static' | 'llm';
  /** The signature the user's decisions were made against; the backend rejects a stale one. */
  kgSignature: string;
  resolutions: KgResolution[];
  /** The LLM tab's issues, sent back because the backend does not keep them. */
  llmIssues?: KgIssue[];
}

/** Apply the user's decisions and get the cleaned graph back. */
export const applyKgRefinement = ({
  diagram,
  source,
  kgSignature,
  resolutions,
  llmIssues,
}: ApplyKgRefinementRequest): Promise<KgRefinementResponse> =>
  apiClient.post<KgRefinementResponse>('/kg/apply-refinement', {
    ...diagramBody(diagram),
    source,
    kgSignature,
    ...(llmIssues ? { llmIssues } : {}),
    resolutions,
  });

/** Providers the KG LLM endpoints accept a user key for (the backend's `KGLLMProvider`).
 *  A key for any other (PIA, a local endpoint) needs a custom base URL, which the
 *  server refuses to open on a user's behalf. */
export const KG_LLM_PROVIDERS = ['anthropic', 'openai', 'mistral', 'nebius'] as const;
export type KgLlmProvider = (typeof KG_LLM_PROVIDERS)[number];

export const isKgLlmProvider = (provider: string): provider is KgLlmProvider =>
  (KG_LLM_PROVIDERS as readonly string[]).includes(provider);

/** The user's own LLM key, and where it belongs. */
export interface KgLlmCredentials {
  provider: KgLlmProvider;
  /** Travels in the JSON body only, never in the URL. */
  apiKey: string;
  /** The user's explicit model choice; omitted, the backend uses the provider's default. */
  model?: string;
}

export interface LlmCleanKgRequest {
  diagram: KgDiagramRef;
  /** What the system is, in the user's words. Optional: when blank the model infers the domain from the graph. */
  description?: string;
  credentials: KgLlmCredentials;
  /** Cancels the request (the user closed the dialog). */
  signal?: AbortSignal;
}

/** The body fields both LLM endpoints share (the backend's `KGLLMRequest`). */
const llmBody = ({ description, credentials }: Pick<LlmCleanKgRequest, 'description' | 'credentials'>) => ({
  ...(description?.trim() ? { description } : {}),
  provider: credentials.provider,
  api_key: credentials.apiKey,
  ...(credentials.model ? { llm_model: credentials.model } : {}),
});

/** Ask the LLM to review the whole graph. */
export const llmCleanKg = async ({
  diagram,
  description,
  credentials,
  signal,
}: LlmCleanKgRequest): Promise<KgPreflightReport> => {
  const config = await getKgConfig();
  return apiClient.post<KgPreflightReport>(
    '/kg/llm-clean',
    { diagram: diagramBody(diagram), ...llmBody({ description, credentials }) },
    { timeout: llmTimeoutMs(config), signal },
  );
};

export interface ClassifyOrphansRequest extends LlmCleanKgRequest {
  /** At most `maxOrphanClassifyNodes` ids (`getKgConfig`): the server rejects more. */
  nodeIds: string[];
  kgSignature: string;
}

/** Ask the LLM to place nodes that have no class: one request, for at most
 *  `maxOrphanClassifyNodes` of them. */
export const classifyOrphansWithLlm = async ({
  diagram,
  description,
  credentials,
  nodeIds,
  kgSignature,
  signal,
}: ClassifyOrphansRequest): Promise<KgPreflightReport> => {
  const config = await getKgConfig();
  return apiClient.post<KgPreflightReport>(
    '/kg/classify-orphans',
    {
      diagram: { ...diagramBody(diagram), kgSignature },
      ...llmBody({ description, credentials }),
      nodeIds,
    },
    { timeout: llmTimeoutMs(config), signal },
  );
};

/** Parse an OWL / RDF-XML / Turtle file into a Knowledge Graph model. */
export const importOwl = (file: File): Promise<KgDiagramResponse<KnowledgeGraphData>> => {
  const form = new FormData();
  form.append('owl_file', file);
  return apiClient.upload<KgDiagramResponse<KnowledgeGraphData>>('/kg/import-owl', form, {
    timeout: HEAVY_TIMEOUT_MS,
  });
};

export interface KgToClassDiagramRequest {
  diagram: KgDiagramRef;
  /** The user's decisions from the preflight, if it was run. */
  resolutions?: KgResolution[];
  kgSignature?: string;
}

/** Convert the graph into a class diagram model. */
export const kgToClassDiagram = ({
  diagram,
  resolutions,
  kgSignature,
}: KgToClassDiagramRequest): Promise<KgDiagramResponse<ProjectDiagramModel>> =>
  apiClient.post<KgDiagramResponse<ProjectDiagramModel>>(
    '/kg/to-class-diagram',
    {
      ...diagramBody(diagram),
      ...(resolutions && resolutions.length ? { resolutions } : {}),
      ...(kgSignature ? { kgSignature } : {}),
    },
    { timeout: HEAVY_TIMEOUT_MS },
  );

export interface ExportKgRdfRequest {
  diagram: KgDiagramRef;
  format: KgRdfFormat;
  vocab: KgRdfVocab;
}

/** The file name the server chose, from a `Content-Disposition` header. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  for (const pattern of [/filename="([^"]+)"/, /filename=([^;\s]+)/]) {
    const match = header.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Serialise the graph as OWL (RDF/XML) or Turtle. `filename` is the server's
 *  choice, or null when it sent none. */
export const exportKgRdf = async ({
  diagram,
  format,
  vocab,
}: ExportKgRdfRequest): Promise<{ blob: Blob; filename: string | null }> => {
  const { blob, headers } = await apiClient.downloadBlob(`/kg/export/${format}`, {
    ...diagramBody(diagram),
    vocab,
  });
  return { blob, filename: filenameFromContentDisposition(headers.get('Content-Disposition')) };
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** User-facing text for a failed KG call: the request timing out and the
 *  server's limits being unavailable get their own message (the raw ones are
 *  English or name milliseconds); anything else shows what the server or the
 *  network said, else `fallback`. */
export function kgApiErrorMessage(error: unknown, t: TFunction, fallback: string): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return t('import.kg.api.timedOut');
  if (error instanceof KgConfigUnavailableError) return t('import.kg.api.configUnavailable');
  if (error instanceof Error && error.message) return error.message;
  // A rejected Redux thunk's `.unwrap()` throws a serialized error: a plain
  // `{ name, message }` object, not an `Error`. Without this its message was
  // dropped and every storage failure read as the generic fallback.
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
