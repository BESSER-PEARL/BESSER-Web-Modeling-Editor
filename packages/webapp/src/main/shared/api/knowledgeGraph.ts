import type { TFunction } from 'i18next';
import { apiClient } from './api-client';
import type { ConsistencyReport, KnowledgeGraphData, ProjectDiagram, ProjectDiagramModel } from '../types/project';

/**
 * API layer for the Knowledge Graph feature.
 *
 * Every KG HTTP call goes through the shared `apiClient` (timeouts, `{"detail"}`
 * error parsing into `ApiError`). The response types below mirror the backend's
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

/** Backend `GET /kg-config`: the limits the server enforces on the KG LLM
 *  endpoints. Never hardcode a copy: a stale one silently becomes the binding
 *  limit (a timeout shorter than the server's, or a batch it rejects). */
export interface KgConfig {
  /** Overall deadline, in seconds, the server gives one KG LLM request. */
  llmRequestTimeoutSeconds: number;
  /** Most node ids one `/classify-orphans-with-llm` request may carry. */
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
    throw new Error(`Unexpected /kg-config payload: ${JSON.stringify(raw)}`);
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
      .get<unknown>('/kg-config')
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

/** Backend `KGPreflightReportResponse`: answer of `/analyze-kg-for-buml-conversion`,
 *  `/llm-clean-kg` and `/classify-orphans-with-llm`. */
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

/** Backend `KGRefinementResponse`: answer of `/apply-kg-refinement`. */
export interface KgRefinementResponse {
  title: string;
  model: KnowledgeGraphData;
  diagramType: string;
  kgSignature: string;
  pendingOrphanClassification?: KgPendingOrphanClassification | null;
  exportedAt?: string;
  version?: string;
}

/** Backend `DiagramExportResponse`: answer of `/import-owl` (a KG model) and
 *  `/kg-to-class-diagram` (a class diagram model). `warnings` is the
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
  apiClient.post<KgPreflightReport>('/analyze-kg-for-buml-conversion', diagramBody(diagram));

/** OWL2 + SHACL consistency check of the graph's data. */
export const checkKgConsistency = (diagram: KgDiagramRef): Promise<KgConsistencyReport> =>
  apiClient.post<KgConsistencyReport>('/check-kg-consistency', diagramBody(diagram));

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
  apiClient.post<KgRefinementResponse>('/apply-kg-refinement', {
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
}: LlmCleanKgRequest): Promise<KgPreflightReport> => {
  const config = await getKgConfig();
  return apiClient.post<KgPreflightReport>(
    '/llm-clean-kg',
    { diagram: diagramBody(diagram), ...llmBody({ description, credentials }) },
    { timeout: llmTimeoutMs(config) },
  );
};

export interface ClassifyOrphansRequest extends LlmCleanKgRequest {
  nodeIds: string[];
  kgSignature: string;
  /** Called before the first batch and after each one, with how many of
   *  `total` batches are done. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/** The reports of several batches of one graph carry different signatures,
 *  so they cannot all describe the graph the user is about to change. */
export class KgBatchMismatchError extends Error {
  constructor() {
    super('The batches of the orphan classification describe different versions of the graph.');
    this.name = 'KgBatchMismatchError';
  }
}

/**
 * One report out of the reports of several batches of the same graph.
 *
 * Well-defined because every batch is sent against the same diagram and
 * signature, the batches hold disjoint node ids, and the server derives an
 * issue's id from its action and the nodes it touches: the issues are
 * concatenated (an id seen twice is kept once) and the signature, which must
 * be the same in every report, is kept.
 */
export function mergeOrphanReports(reports: readonly KgPreflightReport[]): KgPreflightReport {
  if (reports.length === 0) throw new Error('mergeOrphanReports needs at least one report');
  const [first] = reports;
  if (reports.some((r) => r.kgSignature !== first.kgSignature)) throw new KgBatchMismatchError();
  const seen = new Set<string>();
  const issues: KgIssue[] = [];
  for (const report of reports) {
    for (const issue of report.issues) {
      if (seen.has(issue.id)) continue;
      seen.add(issue.id);
      issues.push(issue);
    }
  }
  return { kgSignature: first.kgSignature, diagramType: first.diagramType, issueCount: issues.length, issues };
}

/**
 * Ask the LLM to place nodes that have no class.
 *
 * The server takes at most `maxOrphanClassifyNodes` ids per request (from
 * `getKgConfig`), so a longer list is sent in batches of that size, one after
 * the other (each batch is already a chain of LLM calls on the server; running
 * them in parallel would only multiply the load on the user's key), and the
 * reports are merged into one (`mergeOrphanReports`) that the AI tab reviews
 * and applies in a single step. A failed batch fails the whole call.
 */
export const classifyOrphansWithLlm = async ({
  diagram,
  description,
  credentials,
  nodeIds,
  kgSignature,
  onProgress,
}: ClassifyOrphansRequest): Promise<KgPreflightReport> => {
  const config = await getKgConfig();
  const ids = [...new Set(nodeIds)];
  const size = config.maxOrphanClassifyNodes;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));

  const reports: KgPreflightReport[] = [];
  onProgress?.({ done: 0, total: batches.length });
  for (const batch of batches) {
    const report = await apiClient.post<KgPreflightReport>(
      '/classify-orphans-with-llm',
      {
        diagram: { ...diagramBody(diagram), kgSignature },
        ...llmBody({ description, credentials }),
        node_ids: batch,
      },
      { timeout: llmTimeoutMs(config) },
    );
    // A malformed answer goes back as is, for the caller to reject.
    if (!report || !Array.isArray(report.issues)) return report;
    reports.push(report);
    onProgress?.({ done: reports.length, total: batches.length });
  }
  return mergeOrphanReports(reports);
};

/** Parse an OWL / RDF-XML / Turtle file into a Knowledge Graph model. */
export const importOwl = (file: File): Promise<KgDiagramResponse<KnowledgeGraphData>> => {
  const form = new FormData();
  form.append('owl_file', file);
  return apiClient.upload<KgDiagramResponse<KnowledgeGraphData>>('/import-owl', form, {
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
    '/kg-to-class-diagram',
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
  const { blob, headers } = await apiClient.downloadFile(`/export-kg-rdf/${format}`, {
    ...diagramBody(diagram),
    vocab,
  });
  return { blob, filename: filenameFromContentDisposition(headers.get('Content-Disposition')) };
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** User-facing text for a failed KG call: the request timing out, the server's
 *  limits being unavailable and mismatched batches get their own message (the
 *  raw ones are English or name milliseconds); anything else shows what the
 *  server or the network said, else `fallback`. */
export function kgApiErrorMessage(error: unknown, t: TFunction, fallback: string): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return t('import.kg.api.timedOut');
  if (error instanceof KgConfigUnavailableError) return t('import.kg.api.configUnavailable');
  if (error instanceof KgBatchMismatchError) return t('import.kg.api.batchMismatch');
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
