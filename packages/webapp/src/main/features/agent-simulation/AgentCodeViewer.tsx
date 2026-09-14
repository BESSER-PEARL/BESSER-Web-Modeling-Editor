import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Code2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgentCodeViewerProps {
  code: string | null;
}

// ---------------------------------------------------------------------------
// Types for shiki token output
// ---------------------------------------------------------------------------

interface ShikiToken {
  content: string;
  htmlStyle?: string | Record<string, string>;
}

// ---------------------------------------------------------------------------
// Hook: syntax-highlight Python code using shiki
// ---------------------------------------------------------------------------

function useHighlightedTokens(code: string | null) {
  const [lines, setLines] = useState<ShikiToken[][] | null>(null);

  useEffect(() => {
    if (!code) {
      setLines(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { codeToTokens } = await import('shiki/bundle/web');
        const { tokens } = await codeToTokens(code, {
          lang: 'python',
          defaultColor: false,
          themes: { light: 'github-light', dark: 'github-dark' },
        });
        if (!cancelled) setLines(tokens as ShikiToken[][]);
      } catch {
        // fall through to plain-text fallback
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  return lines;
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyCodeButton({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title={t('agentSimulation.codeViewer.copyTitle')}
      aria-label={t('agentSimulation.codeViewer.copyLabel')}
    >
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Highlighted code body
// ---------------------------------------------------------------------------

function HighlightedCode({ code }: { code: string }) {
  const lines = useHighlightedTokens(code);

  if (!lines) {
    return (
      <pre className="min-w-max p-4 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    );
  }

  return (
    <pre className="min-w-max p-4 font-mono text-xs leading-relaxed">
      <code>
        {lines.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            <span>
              {line.map((token, tokenIndex) => {
                const style =
                  typeof token.htmlStyle === 'string' ? undefined : token.htmlStyle;
                return (
                  <span
                    key={tokenIndex}
                    className="text-shiki-light bg-shiki-light-bg dark:text-shiki-dark dark:bg-shiki-dark-bg"
                    style={style}
                  >
                    {token.content}
                  </span>
                );
              })}
            </span>
            {lineIndex !== lines.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </code>
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AgentCodeViewer: React.FC<AgentCodeViewerProps> = ({ code }) => {
  const { t } = useTranslation();
  if (!code) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Code2 className="size-10 text-muted-foreground/25" />
        <p className="text-sm font-medium text-muted-foreground">{t('agentSimulation.codeViewer.emptyTitle')}</p>
        <p className="text-xs text-muted-foreground/60">
          {t('agentSimulation.codeViewer.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5">
        <Code2 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-muted-foreground">{t('agentSimulation.codeViewer.header')}</span>
        <CopyCodeButton code={code} />
      </div>

      {/* Code */}
      <div className="min-h-0 flex-1 overflow-auto">
        <HighlightedCode code={code} />
      </div>
    </div>
  );
};
