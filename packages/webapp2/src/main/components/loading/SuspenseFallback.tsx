import React from 'react';
import { Loader2 } from 'lucide-react';

interface SuspenseFallbackProps {
  /** Optional message shown below the spinner */
  message?: string;
}

/**
 * Lightweight loading indicator used as a fallback for React.lazy / Suspense boundaries.
 * Renders a centered spinner that inherits the parent container's height so it works
 * both as a full-page placeholder and inside smaller panels.
 */
export const SuspenseFallback: React.FC<SuspenseFallbackProps> = ({ message = 'Loading...' }) => (
  <div className="flex h-full w-full items-center justify-center text-slate-500">
    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
    <span className="text-sm font-medium">{message}</span>
  </div>
);
