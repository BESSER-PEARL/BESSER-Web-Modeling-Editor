import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

import { isPilotSession } from '../../services/telemetry/pilotTelemetry';

/**
 * The study-mode disclosure shown in the assistant chat surfaces while
 * research telemetry is active (tab opened with a study link): what is
 * recorded, that the link turned it on, and how to stop.
 *
 * Renders nothing for regular sessions, so it can be mounted unconditionally.
 */
export const PilotSessionNotice: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  if (!isPilotSession()) {
    return null;
  }
  return (
    <p role="note" className={cn('text-center text-[11px] leading-relaxed text-muted-foreground', className)}>
      {t('assistant.pilotNotice')}
    </p>
  );
};
