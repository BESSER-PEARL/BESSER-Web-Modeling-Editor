import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Code2, Copy } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import pythonLang from 'highlight.js/lib/languages/python';
import { Button } from '@/components/ui/button';
import '@/components/chatbot-kit/ui/code-surface.css';

if (!hljs.getLanguage('python')) {
  hljs.registerLanguage('python', pythonLang);
}

interface AgentCodeViewerProps {
  code: string | null;
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
      {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Highlighted code body
// ---------------------------------------------------------------------------

function HighlightedCode({ code }: { code: string }) {
  // Same highlighter and palette as the app's other code viewers (code-surface.css).
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: 'python' }).value;
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [code]);

  return (
    <pre className="m-0 min-w-max p-4 font-mono text-xs leading-5">
      <code dangerouslySetInnerHTML={{ __html: html }} />
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
      <div className="code-surface min-h-0 flex-1 overflow-auto">
        <HighlightedCode code={code} />
      </div>
    </div>
  );
};
