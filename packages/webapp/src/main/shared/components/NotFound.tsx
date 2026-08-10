import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Home } from 'lucide-react';

/**
 * 404 page displayed when no route matches the current URL.
 */
export const NotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <FileQuestion className="mx-auto mb-4 size-16 text-slate-400 dark:text-slate-500" />
        <h1 className="mb-2 text-4xl font-bold text-slate-900 dark:text-slate-100">404</h1>
        <p className="mb-6 text-lg text-slate-600 dark:text-slate-400">{t('shared.notFound.title')}</p>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-500">
          {t('shared.notFound.description')}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Home className="size-4" />
          {t('shared.notFound.backHome')}
        </Link>
      </div>
    </div>
  );
};
