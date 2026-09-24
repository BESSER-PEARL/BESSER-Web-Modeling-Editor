import React from 'react';
import { useTranslation } from 'react-i18next';
import { BoolField, SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function NlpSection({ runtime: { form, setNlp } }: ConfigSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader title={t('agentConfig.yamlEditor.section.nlp')} description={t('agentConfig.runtime.section.nlp.desc')} />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField id="cfg-nlp-lang" label="language" value={form.nlp.language} onChange={v => setNlp({ language: v })} description={t('agentConfig.runtime.field.nlp.languageDesc')} />
          <TextField id="cfg-nlp-region" label="region" value={form.nlp.region} onChange={v => setNlp({ region: v })} description={t('agentConfig.runtime.field.nlp.regionDesc')} />
          <TextField id="cfg-nlp-tz" label="timezone" value={form.nlp.timezone} onChange={v => setNlp({ timezone: v })} description={t('agentConfig.runtime.field.nlp.timezoneDesc')} />
          <TextField id="cfg-nlp-thresh" label="intent_threshold" value={form.nlp.intent_threshold} onChange={v => setNlp({ intent_threshold: v })} description={t('agentConfig.runtime.field.nlp.intentThresholdDesc')} />
        </div>
        <BoolField id="cfg-nlp-prep" label="pre_processing" value={form.nlp.pre_processing} onChange={v => setNlp({ pre_processing: v })} description={t('agentConfig.runtime.field.nlp.preProcessingDesc')} />
        <div className="rounded-md border border-border p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{t('agentConfig.runtime.apiKeys')}</p>
          <TextField id="cfg-nlp-hf-token" label={t('agentConfig.runtime.field.nlp.huggingfaceToken')} value={form.nlp.huggingface_token} onChange={v => setNlp({ huggingface_token: v })} description={t('agentConfig.runtime.field.nlp.huggingfaceTokenDesc')} />
          <TextField id="cfg-nlp-oai-key" label={t('agentConfig.runtime.field.nlp.openaiApiKey')} value={form.nlp.openai_api_key} onChange={v => setNlp({ openai_api_key: v })} description={t('agentConfig.runtime.field.nlp.openaiApiKeyDesc')} />
          <TextField id="cfg-nlp-rep-key" label={t('agentConfig.runtime.field.nlp.replicateApiKey')} value={form.nlp.replicate_api_key} onChange={v => setNlp({ replicate_api_key: v })} description={t('agentConfig.runtime.field.nlp.replicateApiKeyDesc')} />
        </div>
      </div>
    </>
  );
}
