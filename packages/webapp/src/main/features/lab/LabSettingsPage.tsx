import React from 'react';
import { useTranslation } from 'react-i18next';

/** Settings and usage at `/settings`. Placeholder until W4-C builds the page. */
export const LabSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <p className="px-6 py-10 text-sm text-muted-foreground">
      {t('lab.app.placeholder.settings', { defaultValue: 'The settings and usage page is not built yet.' })}
    </p>
  );
};

export default LabSettingsPage;
