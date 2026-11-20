import React from 'react';
import { useTranslation } from 'react-i18next';

/** The change at `/c/:changeId`. Placeholder until W5-B builds the change view. */
export const LabChangeView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <p className="px-6 py-10 text-sm text-muted-foreground">
      {t('lab.app.placeholder.change', { defaultValue: 'The change view is not built yet.' })}
    </p>
  );
};

export default LabChangeView;
