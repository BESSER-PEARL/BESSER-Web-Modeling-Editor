import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../runtimeFields';
import { useYamlCodeMirror } from '../useYamlCodeMirror';
import type { ConfigSectionProps } from './types';

/** Read-only view of the full generated config.yaml. */
export function RawYamlSection({ runtime: { generatedYaml } }: ConfigSectionProps) {
  const { t } = useTranslation();
  const viewerRef = useYamlCodeMirror(generatedYaml);
  return (
    <>
      <SectionHeader
        title={t('agentConfig.yamlEditor.tab.raw')}
        description={t('agentConfig.runtime.section.raw.desc')}
      />
      <div
        ref={viewerRef}
        className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[400px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm [&_.CodeMirror]:bg-muted/30"
      />
    </>
  );
}
