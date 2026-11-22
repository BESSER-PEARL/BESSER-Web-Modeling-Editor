import React from 'react';
import { useTranslation } from 'react-i18next';
import { DbFields, SectionHeader, Toggle } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function DatabaseSection({ runtime: { form, setMonitoring, setStreamlitDb } }: ConfigSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader title={t('agentConfig.runtime.section.database.title')} description={t('agentConfig.runtime.section.database.desc')} />
      <div className="space-y-4">
        <div className="rounded-md border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p id="cfg-mon-enabled-label" className="text-sm font-medium">{t('agentConfig.runtime.subsectionMonitoring')}</p>
            <Toggle aria-labelledby="cfg-mon-enabled-label" value={form.db.monitoring.enabled} onChange={v => setMonitoring({ enabled: v })} />
          </div>
          {form.db.monitoring.enabled && (
            <DbFields prefix="cfg-mon" value={form.db.monitoring} onChange={v => setMonitoring(v)} />
          )}
        </div>
        <div className="rounded-md border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p id="cfg-stdb-enabled-label" className="text-sm font-medium">{t('agentConfig.runtime.subsectionStreamlit')}</p>
            <Toggle aria-labelledby="cfg-stdb-enabled-label" value={form.db.streamlit_db.enabled} onChange={v => setStreamlitDb({ enabled: v })} />
          </div>
          {form.db.streamlit_db.enabled && (
            <DbFields prefix="cfg-stdb" value={form.db.streamlit_db} onChange={v => setStreamlitDb(v)} />
          )}
        </div>
      </div>
    </>
  );
}
