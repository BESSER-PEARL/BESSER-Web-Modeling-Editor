import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnabledToggle, SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function TelegramSection({ runtime: { form, setTelegram } }: ConfigSectionProps) {
  const { t } = useTranslation();
  const telegram = form.platforms.telegram;
  return (
    <>
      <SectionHeader title={t('agentConfig.runtime.section.telegram.title')} description={t('agentConfig.runtime.section.telegram.desc')} />
      <div className="space-y-3">
        <EnabledToggle value={telegram.enabled} onChange={v => setTelegram({ enabled: v })} />
        {telegram.enabled && (
          <TextField id="cfg-tg-token" label="token" value={telegram.token} onChange={v => setTelegram({ token: v })} description={t('agentConfig.runtime.field.telegram.tokenDesc')} />
        )}
      </div>
    </>
  );
}
