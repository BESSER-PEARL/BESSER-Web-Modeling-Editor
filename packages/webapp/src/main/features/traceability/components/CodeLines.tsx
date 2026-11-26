import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface CodeLinesProps {
  lines: string[];
  /** The number of the first line (a fragment's start line). */
  firstLine?: number;
  className?: string;
}

/** The mark the backend puts in a stored copy of a file in place of a credential. */
const REDACTION_MARK = '[REDACTED]';

/**
 * Lines of generated code with their line numbers, scrolling within a capped height. A stored copy can hold
 * `[REDACTED]` marks (its hash is that of the delivered file), so a note says so when one is shown.
 */
export const CodeLines: React.FC<CodeLinesProps> = ({ lines, firstLine = 1, className }) => {
  const { t } = useTranslation();
  const redacted = lines.some((line) => line.includes(REDACTION_MARK));
  return (
    <>
      <pre className={cn('max-h-72 overflow-auto bg-background py-1 font-mono text-xs leading-5', className)}>
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/80">{firstLine + i}</span>
            <code className="whitespace-pre pr-3">{line}</code>
          </div>
        ))}
      </pre>
      {redacted && <p className="border-t border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">{t('traceability.redactedCodeNote')}</p>}
    </>
  );
};
