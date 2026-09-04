import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

import { isPilotSession } from '../../services/telemetry/pilotTelemetry';

/**
 * One unobtrusive transparency line shown in the assistant chat surfaces
 * while a pilot-experiment session is active (tab opened via a facilitator's
 * `?pilot=` link): "This pilot session is recorded for research purposes."
 *
 * Renders nothing for regular sessions, so it can be mounted unconditionally.
 */
export const PilotSessionNotice: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  if (!isPilotSession()) {
    return null;
  }
  return (
    <p className={cn('text-center text-[11px] leading-relaxed text-muted-foreground/60', className)}>
      {t('assistant.pilotNotice')}
    </p>
  );
};
