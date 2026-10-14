import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../runtimeFields';
import { useYamlCodeMirror } from '../useYamlCodeMirror';
import type { ConfigSectionProps } from './types';

export function CustomYamlSection({ runtime: { customYaml, customYamlError, updateCustomYaml } }: ConfigSectionProps) {
  const { t } = useTranslation();
  const editorRef = useYamlCodeMirror(customYaml, updateCustomYaml);
  return (
    <>
      <SectionHeader
        title={t('agentConfig.runtime.section.custom.title')}
        description={t('agentConfig.runtime.section.custom.desc')}
      />
      <div className="space-y-2">
        {customYamlError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-semibold">{t('agentConfig.yamlEditor.syntaxError')}</span> {customYamlError}
          </div>
        )}
        <div
          ref={editorRef}
          className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[200px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm"
        />
      </div>
    </>
  );
}
