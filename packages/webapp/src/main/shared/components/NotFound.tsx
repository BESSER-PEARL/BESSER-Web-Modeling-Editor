import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

/**
 * 404 page displayed when no route matches the current URL.
 */
export const NotFound: React.FC = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
    <div className="w-full max-w-md text-center">
      <FileQuestion className="mx-auto mb-4 size-16 text-slate-400 dark:text-slate-500" />
      <h1 className="mb-2 text-4xl font-bold text-slate-900 dark:text-slate-100">404</h1>
      <p className="mb-6 text-lg text-slate-600 dark:text-slate-400">Page not found</p>
      <p className="mb-8 text-sm text-slate-500 dark:text-slate-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        <Home className="size-4" />
        Back to Home
      </Link>
    </div>
  </div>
);
