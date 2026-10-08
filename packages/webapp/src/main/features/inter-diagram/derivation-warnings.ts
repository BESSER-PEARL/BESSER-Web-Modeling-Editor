import type { TFunction } from 'i18next';
import { toast } from 'react-toastify';
import type { AgentDerivationWarning, DeploymentDerivationWarning, DerivationWarning } from './types';

export type AnyDerivationWarning = DerivationWarning | DeploymentDerivationWarning | AgentDerivationWarning;

/** Warnings listed in the toast; the rest collapse into "…and N more" (the console keeps all). */
export const MAX_LISTED_WARNINGS = 4;

/** One translated, human-readable sentence for a derivation warning. */
export function describeDerivationWarning(warning: AnyDerivationWarning, t: TFunction): string {
  const name = (value: string | undefined) => value?.trim() || t('interDiagram.warnings.unnamed');
  switch (warning.kind) {
    case 'dropped-task-in-non-agentic-lane':
      return t('interDiagram.warnings.droppedTask', { task: name(warning.taskName), lane: name(warning.laneName) });
    case 'capability-heavy-agent':
      return t('interDiagram.warnings.capabilityHeavyAgent', { lane: name(warning.laneName), count: warning.count });
    case 'capability-heavy-zone':
      return t('interDiagram.warnings.capabilityHeavyZone', { zone: warning.zone, count: warning.count });
    case 'dangling-agent-ref':
      return t('interDiagram.warnings.danglingAgentRef', { name: name(warning.taskName) });
    case 'flat-scaffold':
      return t('interDiagram.warnings.flatScaffold');
    case 'io-attached-to-entry':
      return t(
        warning.direction === 'in' ? 'interDiagram.warnings.ioUnresolvedIn' : 'interDiagram.warnings.ioUnresolvedOut',
        { peer: name(warning.peerName) },
      );
    case 'merge-no-producers':
      return t('interDiagram.warnings.mergeNoProducers', { gateway: name(warning.gatewayName) });
    case 'merge-no-successors':
      return t('interDiagram.warnings.mergeNoSuccessors', { gateway: name(warning.gatewayName) });
  }
}

/**
 * Multi-line toast text: the summary line, then one bullet per warning, capped
 * at MAX_LISTED_WARNINGS (same shape as the BPMN import warnings toast).
 */
export function formatDerivationWarnings(summary: string, warnings: AnyDerivationWarning[], t: TFunction): string {
  const messages = warnings.map((w) => describeDerivationWarning(w, t));
  const shown = messages.slice(0, MAX_LISTED_WARNINGS).map((m) => `• ${m}`);
  const hidden = messages.length - shown.length;
  if (hidden > 0) shown.push(`• ${t('interDiagram.warnings.more', { count: hidden })}`);
  return [summary, ...shown].join('\n');
}

/**
 * Show derivation warnings to the user (a multi-line warning toast) and log
 * every one of them readably. `summary` is the translated headline, e.g.
 * "Component diagram generated with 2 warnings:".
 */
export function reportDerivationWarnings(
  logPrefix: string,
  summary: string,
  warnings: AnyDerivationWarning[],
  t: TFunction,
): void {
  if (warnings.length === 0) return;
  const lines = warnings.map((w) => `- ${describeDerivationWarning(w, t)} (${JSON.stringify(w)})`);
  console.warn(`${logPrefix} ${summary}\n${lines.join('\n')}`);
  toast.warning(formatDerivationWarnings(summary, warnings, t), { style: { whiteSpace: 'pre-line' } });
}
