import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '@/main/shared/i18n';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that wraps the entire application.
 *
 * React error boundaries **must** be class components. This component catches
 * unhandled render errors anywhere in the tree and displays a friendly
 * fallback UI with a reload button instead of a blank white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleResetAndReload = (): void => {
    // Opt-in recovery for genuinely-corrupted storage. Wipes besser_* keys
    // and known legacy keys, then reloads. Triggered only by the user
    // clicking the "Reset and reload" button in the fallback UI — never
    // automatically, because that silently destroys the user's project.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('besser_')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    ['latestDiagram', 'agentConfig', 'agentPersonalization', 'github_session',
     'github_username', 'last_published_token', 'last_published_type',
     'umlAgentRateLimiterState'].forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-8">
          <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-card p-8 text-center text-card-foreground shadow-elevation-3">
            <AlertTriangle className="mx-auto mb-4 size-12 text-destructive" />
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              {i18n.t('shared.appErrorBoundary.title')}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {i18n.t('shared.appErrorBoundary.description')}
            </p>

            {isDev && this.state.error && (
              <pre className="mb-6 max-h-40 overflow-auto rounded border border-destructive/30 bg-destructive/10 p-3 text-left font-mono text-xs text-foreground">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            )}

            <div className="flex flex-col items-center gap-2">
              <Button onClick={this.handleReload}>
                <RefreshCw className="size-4" />
                {i18n.t('shared.appErrorBoundary.reload')}
              </Button>
              <button
                onClick={this.handleResetAndReload}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
              >
                Reset local data and reload (deletes your projects)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
