import React from 'react';
import { toast } from 'react-toastify';
import i18n from '../../shared/i18n';
import type { TraceabilityTarget } from './navigation';
import { useOpenTraceability } from './navigation';

/** A success message with a "View trace" link into the Traceability page. */
const TracedToastContent: React.FC<{ message: string; target: TraceabilityTarget; closeToast?: () => void }> = ({
  message, target, closeToast,
}) => {
  const open = useOpenTraceability();
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          open(target);
          closeToast?.();
        }}
        className="shrink-0 rounded px-1.5 py-0.5 text-sm font-medium text-brand-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand-light"
      >
        {i18n.t('traceability.entry.viewTrace')}
      </button>
    </div>
  );
};

/**
 * The success toast of something that was recorded in the trace (a generation run), with a link to it:
 * `toastTraced(t('generation.toasts.codeGenerationCompleted'), { tab: 'lineage', root: diagramId })`.
 * Rendered inside the router, which the app's toast container is.
 */
export function toastTraced(message: string, target: TraceabilityTarget): void {
  toast.success(<TracedToastContent message={message} target={target} />);
}
