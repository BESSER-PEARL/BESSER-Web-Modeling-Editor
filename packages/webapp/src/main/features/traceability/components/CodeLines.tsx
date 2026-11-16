import React from 'react';
import { cn } from '@/lib/utils';

interface CodeLinesProps {
  lines: string[];
  /** The number of the first line (a fragment's start line). */
  firstLine?: number;
  className?: string;
}

/** Lines of generated code with their line numbers, scrolling within a capped height. */
export const CodeLines: React.FC<CodeLinesProps> = ({ lines, firstLine = 1, className }) => (
  <pre className={cn('max-h-72 overflow-auto bg-background py-1 font-mono text-xs leading-5', className)}>
    {lines.map((line, i) => (
      <div key={i} className="flex">
        <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/80">{firstLine + i}</span>
        <code className="whitespace-pre pr-3">{line}</code>
      </div>
    ))}
  </pre>
);
