import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnabledToggle, SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function A2ASection({ runtime: { form, setA2a } }: ConfigSectionProps) {
  const { t } = useTranslation();
  const a2a = form.platforms.a2a;
  return (
    <>
      <SectionHeader title={t('agentConfig.runtime.section.a2a.title')} description={t('agentConfig.runtime.section.a2a.desc')} />
      <div className="space-y-3">
        <EnabledToggle value={a2a.enabled} onChange={v => setA2a({ enabled: v })} />
        {a2a.enabled && (
          <TextField id="cfg-a2a-port" label="port" value={a2a.port} onChange={v => setA2a({ port: v })} description={t('agentConfig.runtime.field.a2a.portDesc')} />
        )}
      </div>
    </>
  );
}
