import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-800 dark:bg-slate-900">
            <AlertTriangle className="mx-auto mb-4 size-12 text-red-500 dark:text-red-400" />
            <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              An unexpected error occurred. Please reload the page to try again.
            </p>

            {isDev && this.state.error && (
              <pre className="mb-6 max-h-40 overflow-auto rounded bg-red-50 p-3 text-left font-mono text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            )}

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <RefreshCw className="size-4" />
                Reload
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="text-xs text-slate-500 underline-offset-2 hover:text-red-600 hover:underline dark:text-slate-400 dark:hover:text-red-400"
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
