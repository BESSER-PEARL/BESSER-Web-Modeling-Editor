import {
  classifyOrphansWithLlm,
  getKgConfig,
  type ClassifyOrphansRequest,
  type KgIssue,
  type KgPreflightReport,
} from '../../../shared/api/knowledgeGraph';

/** The server answered a batch with something that is not a preflight report. */
export class InvalidOrphanReportError extends Error {
  constructor() {
    super('The orphan classification returned no list of issues.');
    this.name = 'InvalidOrphanReportError';
  }
}

export interface OrphanBatchProgress {
  done: number;
  total: number;
}

export interface ClassifyOrphansInBatchesRequest extends ClassifyOrphansRequest {
  /** Called before the first batch and after each one, with how many of
   *  `total` batches are done. */
  onProgress?: (progress: OrphanBatchProgress) => void;
}

/**
 * One report out of the reports of several batches of the same graph.
 *
 * Every batch is sent against the same diagram and signature (the server
 * rejects a request whose signature does not match its diagram), the batches
 * hold disjoint node ids, and the server derives an issue's id from its action
 * and the nodes it touches. So the issues are concatenated (an id seen twice is
 * kept once) and the first report's signature stands for all of them.
 */
export function mergeOrphanReports(reports: readonly KgPreflightReport[]): KgPreflightReport {
  if (reports.length === 0) throw new Error('mergeOrphanReports needs at least one report');
  const [first] = reports;
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
 * Ask the LLM to place every node in `nodeIds`, however many there are.
 *
 * The server takes at most `maxOrphanClassifyNodes` ids per request (from
 * `getKgConfig`), so the list is sent in batches of that size, one after the
 * other (each batch is already a chain of LLM calls on the server; running them
 * in parallel would only multiply the load on the user's key), and the reports
 * are merged into one that the AI tab reviews and applies in a single step.
 *
 * A failed or malformed batch fails the whole call. Aborting `signal` cancels
 * the running batch and sends no further one; the call then rejects with the
 * signal's reason.
 */
export async function classifyOrphansInBatches({
  nodeIds,
  onProgress,
  signal,
  ...request
}: ClassifyOrphansInBatchesRequest): Promise<KgPreflightReport> {
  const { maxOrphanClassifyNodes: size } = await getKgConfig();
  const ids = [...new Set(nodeIds)];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));

  const reports: KgPreflightReport[] = [];
  onProgress?.({ done: 0, total: batches.length });
  for (const batch of batches) {
    if (signal?.aborted) throw signal.reason;
    const report = await classifyOrphansWithLlm({ ...request, nodeIds: batch, signal });
    if (!report || !Array.isArray(report.issues)) throw new InvalidOrphanReportError();
    reports.push(report);
    onProgress?.({ done: reports.length, total: batches.length });
  }
  return mergeOrphanReports(reports);
}
