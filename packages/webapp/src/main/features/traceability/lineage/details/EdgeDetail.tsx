import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { TraceLogRecord } from '../../../../shared/types/traceability';
import { isCodeArtifact } from '../../../../shared/types/traceability';
import type { OutOfDateReason, TraceIndex } from '../../../../shared/traceability/traceQueries';
import { changedSince } from '../../../../shared/traceability/traceQueries';
import type { LineageEdge } from '../../../../shared/traceability/lineage';
import { actorNames, describeChange, formatTime, operationLabel, toolNames } from '../../traceLabels';
import { formatConfidence } from '../lineageLook';
import { describeEvidence, nodeLabel } from '../lineageLabels';
import { DetailPane, DetailSection } from './DetailPane';

/** One end of the selected link, which selects it. */
const LinkEnd: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className="min-w-0 max-w-[48%] truncate rounded border border-border px-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {label}
  </button>
);

/** A selected link: its ends, confidence, evidence, the operation that made it and whether it still holds. */
export const EdgeDetail: React.FC<{ index: TraceIndex; edge: LineageEdge; onSelectNode: (id: string) => void }> = ({ index, edge, onSelectNode }) => {
  const { t, i18n } = useTranslation();
  const { link } = edge;
  const operation = index.operations.get(link.operationId);
  const source = index.artifacts.get(link.sourceId)!;
  const target = index.artifacts.get(link.targetId)!;
  const tools = operation ? toolNames(operation, index) : '';
  const confidence = link.confidence?.value;
  return (
    <DetailPane>
      <h3 className="font-semibold">{t('traceability.lineage.linkTitle')}</h3>
      {/* One line: a long end (a prompt, a file path) is cut short, and its whole name is the tooltip. */}
      <div className="flex min-w-0 items-center gap-1 text-xs">
        <LinkEnd label={nodeLabel(t, index, source)} onClick={() => onSelectNode(source.id)} />
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <LinkEnd label={nodeLabel(t, index, target)} onClick={() => onSelectNode(target.id)} />
      </div>
      {isCodeArtifact(target) && target.parentId && <code className="block truncate text-xs text-muted-foreground">{target.path}</code>}

      <DetailSection title={t('traceability.lineage.confidence')}>
        {confidence === undefined ? (
          <p className="text-xs text-muted-foreground">{t('traceability.lineage.confidenceNotAssessedNote')}</p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted" aria-hidden>
              <div className="h-full bg-brand" style={{ width: `${confidence * 100}%` }} />
            </div>
            <span className="tabular-nums">{formatConfidence(confidence)}</span>
          </div>
        )}
        {link.confidence?.explanation && <p className="text-xs text-muted-foreground">{link.confidence.explanation}</p>}
      </DetailSection>

      <DetailSection title={t('traceability.lineage.evidence')}>
        <ul className="space-y-0.5 text-xs">
          {link.evidence.map((evidence) => (
            <li key={evidence.id} className="space-y-1">
              <div>{describeEvidence(t, evidence)}</div>
              <EvidenceLogs logs={(evidence.logIds ?? []).flatMap((id) => index.logs.get(id) ?? [])} />
            </li>
          ))}
          {link.evidence.length === 0 && <li className="text-muted-foreground">{t('traceability.lineage.noEvidence')}</li>}
        </ul>
      </DetailSection>

      {operation && (
        <section className="space-y-0.5 text-xs">
          <h4 className="font-semibold">{t('traceability.lineage.madeBy')}</h4>
          <p>{operationLabel(t, operation, index)} · {formatTime(link.timestamp, i18n.language)}</p>
          <p className="text-muted-foreground">
            {actorNames(operation, index, t)}
            {tools && ` · ${tools}`}
          </p>
        </section>
      )}

      <OutOfDateNote index={index} edge={edge} />
    </DetailPane>
  );
};

/** The log records an evidence rests on: what was asked and answered, in order. */
export const EvidenceLogs: React.FC<{ logs: TraceLogRecord[] }> = ({ logs }) => {
  const { t } = useTranslation();
  if (logs.length === 0) return null;
  return (
    <ol className="space-y-1 border-l-2 border-border pl-2">
      {logs.map((log) => (
        <li key={log.id}>
          <span className="block text-[10px] uppercase text-muted-foreground">
            {t(`traceability.timeline.logTypes.${log.logType}`, { defaultValue: log.logType })}
          </span>
          <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words">{log.content}</p>
        </li>
      ))}
    </ol>
  );
};

/** Whether the link still holds and, when not, each reason with the changes behind it. */
const OutOfDateNote: React.FC<{ index: TraceIndex; edge: LineageEdge }> = ({ index, edge }) => {
  const { t, i18n } = useTranslation();
  const { link } = edge;
  if (edge.outOfDate.length === 0) {
    return (
      <p className="flex items-start gap-1 text-xs text-success">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('traceability.lineage.outOfDate.upToDate')}
      </p>
    );
  }
  const changesFor = (reason: OutOfDateReason) =>
    reason === 'UPSTREAM_CHANGED' ? [] : changedSince(index, reason === 'SOURCE_CHANGED' ? link.sourceId : link.targetId, link);
  return (
    <section className="space-y-2">
      {edge.outOfDate.map((reason) => (
        <div key={reason} className="space-y-0.5">
          <p className="flex items-start gap-1 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t(`traceability.lineage.outOfDate.${reason}`)}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            {changesFor(reason).map(({ change }) => (
              <li key={change.id}>
                {describeChange(t, change, index)} <span className="text-muted-foreground">{formatTime(change.timestamp, i18n.language)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};
