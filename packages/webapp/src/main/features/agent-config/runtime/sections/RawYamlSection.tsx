import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../runtimeFields';
import { YamlCodeEditor } from '../YamlCodeEditor';
import type { ConfigSectionProps } from './types';

/** Read-only view of the full generated config.yaml. */
export function RawYamlSection({ runtime: { generatedYaml } }: ConfigSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader
        title={t('agentConfig.yamlEditor.tab.raw')}
        description={t('agentConfig.runtime.section.raw.desc')}
      />
      <YamlCodeEditor value={generatedYaml} minHeightClass="[&_.cm-editor]:min-h-[400px]" className="bg-muted/30" />
    </>
  );
}
