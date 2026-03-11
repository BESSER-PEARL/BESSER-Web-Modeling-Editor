import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Editor error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm dark:border-red-800 dark:bg-slate-900">
            <h3 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-300">
              Editor Error
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              The editor encountered an unexpected error. Your work has been saved.
            </p>
            <p className="mb-4 rounded bg-red-50 p-2 font-mono text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              aria-label="Try again after error"
              className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
