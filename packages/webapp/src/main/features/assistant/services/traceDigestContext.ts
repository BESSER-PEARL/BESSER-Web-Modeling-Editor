import i18n from '../../../shared/i18n';
import type { BesserProject } from '../../../shared/types/project';
import { buildTraceDigest, type TraceDigest } from '../../../shared/traceability/traceDigest';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { getProjectTrace, isTraceabilityEnabled } from '../../../shared/traceability/traceStore';
import { operationSummary } from '../../traceability';

/**
 * The `context.traceDigest` of a user message (cross-repo contract, section 3), or undefined, which leaves the
 * field out: the project does not record traces, its trace is not loaded yet, or nothing is recorded in it. The
 * agent then answers a question about the trace that nothing is recorded. `message` picks the focus artifacts;
 * without it (a voice message, whose transcript is not known yet) the focus is empty.
 */
export function buildAssistantTraceDigest(project: BesserProject | null | undefined, message?: string): TraceDigest | undefined {
  if (!project || !isTraceabilityEnabled(project)) return undefined;
  const trace = getProjectTrace(project.id);
  if (!trace || trace.operations.length === 0) return undefined;
  try {
    const english = i18n.getFixedT('en');
    return buildTraceDigest(trace, indexTrace(trace), message ?? '', {
      recording: true,
      summarize: (operation, index) => operationSummary(english, operation, index),
    });
  } catch (error) {
    // A digest is an aid: a trace it cannot read must not stop the message.
    console.warn('[assistant] could not build the trace digest', error);
    return undefined;
  }
}
