import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnabledToggle, SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function WebSocketSection({ runtime: { form, setWs } }: ConfigSectionProps) {
  const { t } = useTranslation();
  const ws = form.platforms.websocket;
  return (
    <>
      <SectionHeader title={t('agentConfig.runtime.section.websocket.title')} description={t('agentConfig.runtime.section.websocket.desc')} />
      <div className="space-y-3">
        <EnabledToggle value={ws.enabled} onChange={v => setWs({ enabled: v })} />
        {ws.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="cfg-ws-host" label="host" value={ws.host} onChange={v => setWs({ host: v })} description={t('agentConfig.runtime.field.websocket.hostDesc')} />
              <TextField id="cfg-ws-port" label="port" value={ws.port} onChange={v => setWs({ port: v })} description={t('agentConfig.runtime.field.websocket.portDesc')} />
            </div>
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{t('agentConfig.runtime.subsectionStreamlit')}</p>
              <div className="grid grid-cols-2 gap-3">
                <TextField id="cfg-ws-st-host" label="host" value={ws.streamlit_host} onChange={v => setWs({ streamlit_host: v })} description={t('agentConfig.runtime.field.websocket.streamlitHostDesc')} />
                <TextField id="cfg-ws-st-port" label="port" value={ws.streamlit_port} onChange={v => setWs({ streamlit_port: v })} description={t('agentConfig.runtime.field.websocket.streamlitPortDesc')} />
              </div>
              <div className="rounded-md border border-border/60 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('agentConfig.runtime.subsectionChat')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="cfg-ws-chat-size" label="size" value={ws.chat_size} onChange={v => setWs({ chat_size: v })} description={t('agentConfig.runtime.field.websocket.chatSizeDesc')} />
                  <TextField id="cfg-ws-chat-font" label="font" value={ws.chat_font} onChange={v => setWs({ chat_font: v })} description={t('agentConfig.runtime.field.websocket.chatFontDesc')} />
                  <TextField id="cfg-ws-chat-ls" label="line_spacing" value={ws.chat_line_spacing} onChange={v => setWs({ chat_line_spacing: v })} description={t('agentConfig.runtime.field.websocket.chatLineSpacingDesc')} />
                  <TextField id="cfg-ws-chat-align" label="alignment" value={ws.chat_alignment} onChange={v => setWs({ chat_alignment: v })} description={t('agentConfig.runtime.field.websocket.chatAlignmentDesc')} />
                  <TextField id="cfg-ws-chat-color" label="color" value={ws.chat_color} onChange={v => setWs({ chat_color: v })} description={t('agentConfig.runtime.field.websocket.chatColorDesc')} />
                  <TextField id="cfg-ws-chat-contrast" label="contrast" value={ws.chat_contrast} onChange={v => setWs({ chat_contrast: v })} description={t('agentConfig.runtime.field.websocket.chatContrastDesc')} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
