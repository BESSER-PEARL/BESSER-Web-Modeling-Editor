import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnabledToggle, SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

/** GitHub and GitLab share the same fields (personal token, webhook token and port). */
export function GitPlatformSection({ runtime, platform }: ConfigSectionProps & { platform: 'github' | 'gitlab' }) {
  const { t } = useTranslation();
  const value = runtime.form.platforms[platform];
  const set = platform === 'github' ? runtime.setGithub : runtime.setGitlab;
  const idPrefix = platform === 'github' ? 'cfg-gh' : 'cfg-gl';
  return (
    <>
      <SectionHeader title={t(`agentConfig.runtime.section.${platform}.title`)} description={t(`agentConfig.runtime.section.${platform}.desc`)} />
      <div className="space-y-3">
        <EnabledToggle value={value.enabled} onChange={v => set({ enabled: v })} />
        {value.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <TextField id={`${idPrefix}-pt`} label="personal_token" value={value.personal_token} onChange={v => set({ personal_token: v })} description={t(`agentConfig.runtime.field.${platform}.personalTokenDesc`)} />
            <TextField id={`${idPrefix}-wt`} label="webhook_token" value={value.webhook_token} onChange={v => set({ webhook_token: v })} description={t(`agentConfig.runtime.field.${platform}.webhookTokenDesc`)} />
            <TextField id={`${idPrefix}-wp`} label="webhook_port" value={value.webhook_port} onChange={v => set({ webhook_port: v })} description={t(`agentConfig.runtime.field.${platform}.webhookPortDesc`)} />
          </div>
        )}
      </div>
    </>
  );
}
