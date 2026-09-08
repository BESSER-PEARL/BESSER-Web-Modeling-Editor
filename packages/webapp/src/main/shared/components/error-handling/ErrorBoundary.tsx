import React, { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '@/main/shared/i18n';

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
        <div className="flex h-full w-full items-center justify-center bg-background p-8">
          <div className="max-w-md rounded-lg border border-destructive/30 bg-card p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold text-destructive">
              {i18n.t('shared.errorBoundary.title')}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {i18n.t('shared.errorBoundary.description')}
            </p>
            <p className="mb-4 rounded bg-destructive/10 p-2 font-mono text-xs text-destructive">
              {this.state.error?.message || i18n.t('shared.errorBoundary.unknownError')}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              aria-label={i18n.t('shared.errorBoundary.tryAgainLabel')}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {i18n.t('shared.errorBoundary.tryAgain')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
