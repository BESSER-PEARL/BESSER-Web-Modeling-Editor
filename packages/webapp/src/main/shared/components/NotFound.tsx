import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 404 page displayed when no route matches the current URL.
 */
export const NotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-md text-center">
        <FileQuestion className="mx-auto mb-4 size-16 text-muted-foreground" />
        <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">{t('shared.notFound.title')}</p>
        <p className="mb-8 text-sm text-muted-foreground">
          {t('shared.notFound.description')}
        </p>
        <Button asChild>
          <Link to="/">
            <Home className="size-4" />
            {t('shared.notFound.backHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
};
