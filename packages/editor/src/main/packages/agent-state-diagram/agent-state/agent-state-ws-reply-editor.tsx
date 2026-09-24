// Editor of the WebSocket-only reply actions (markdown, HTML, speech, options, location, placeholders).
import React from 'react';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ActionEditorContext } from './agent-state-action-fields';
import { AgentStateMember } from './agent-state-member';
import { CheckboxRow, DbFieldRow, LlmFieldRow, VarHint, WsWarning } from './agent-state-update-styles';

export const renderWebSocketReplyEditor = (
  ctx: ActionEditorContext,
  action: AgentStateMember,
  hasWebSocketPlatform: boolean,
): React.ReactNode => {
  const { translate, update } = ctx;
  const platformWarning = !hasWebSocketPlatform ? (
    <WsWarning style={{ marginBottom: 6 }}>
      {translate('packages.AgentDiagram.requiresWebSocketWarning')}
    </WsWarning>
  ) : null;

  let content: React.ReactNode = null;
  switch (action.replyType) {
    case 'ws_markdown':
    case 'ws_html':
      content = (
        <LlmFieldRow>
          <Header>{translate('packages.AgentDiagram.message')}</Header>
          <Textfield
            outline
            multiline
            enterToSubmit={false}
            value={action.ws_message || ''}
            onChange={(v) =>
              update<AgentStateMember>(action.id, {
                ws_message: v,
                name: v
                  ? v.slice(0, 40)
                  : action.replyType === 'ws_markdown'
                    ? translate('packages.AgentDiagram.markdownEmpty')
                    : translate('packages.AgentDiagram.htmlEmpty'),
              })
            }
            placeholder={action.replyType === 'ws_markdown'
              ? translate('packages.AgentDiagram.markdownPlaceholder')
              : translate('packages.AgentDiagram.htmlPlaceholder')}
          />
          <CheckboxRow style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={action.useSessionVars || false}
              onChange={(e) => update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateVarsInMessage')}
          </CheckboxRow>
          {action.useSessionVars && (
            <VarHint>{translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
          )}
        </LlmFieldRow>
      );
      break;
    case 'ws_speech':
      content = (
        <LlmFieldRow>
          <Header>{translate('packages.AgentDiagram.message')}</Header>
          <Textfield
            outline
            multiline
            enterToSubmit={false}
            value={action.ws_message || ''}
            onChange={(v) => update<AgentStateMember>(action.id, { ws_message: v })}
            placeholder={translate('packages.AgentDiagram.speechPlaceholder')}
          />
          <CheckboxRow style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={action.useSessionVars || false}
              onChange={(e) => update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateVarsInMessage')}
          </CheckboxRow>
          {action.useSessionVars && (
            <VarHint>{translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
          )}
          <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.audioSpeedOptional')}</Header>
          <Textfield
            outline
            value={action.ws_audio_speed ?? ''}
            onChange={(v) => {
              const parsed = parseFloat(String(v));
              update<AgentStateMember>(action.id, {
                ws_audio_speed: String(v) === '' || isNaN(parsed) ? null : parsed,
              });
            }}
            placeholder={translate('packages.AgentDiagram.default')}
          />
        </LlmFieldRow>
      );
      break;
    case 'ws_options':
      content = (
        <LlmFieldRow>
          <Header>{translate('packages.AgentDiagram.optionsOnePerLine')}</Header>
          <Textfield
            outline
            multiline
            enterToSubmit={false}
            value={action.ws_options || ''}
            onChange={(v) => {
              const count = v.split('\n').filter(Boolean).length;
              update<AgentStateMember>(action.id, {
                ws_options: v,
                name: count > 0
                  ? `${translate('packages.AgentDiagram.optionsItemsCountPrefix')} ${count} ${translate('packages.AgentDiagram.optionItems')}`
                  : translate('packages.AgentDiagram.optionsNoOptions'),
              });
            }}
            placeholder={translate('packages.AgentDiagram.optionsPlaceholder')}
          />
        </LlmFieldRow>
      );
      break;
    case 'ws_location':
      content = (
        <LlmFieldRow>
          <DbFieldRow>
            <label>{translate('packages.AgentDiagram.latitude')}</label>
            <Textfield
              outline
              value={String(action.ws_latitude ?? 0)}
              onChange={(v) => {
                const p = parseFloat(String(v).replace(',', '.'));
                if (!isNaN(p)) update<AgentStateMember>(action.id, { ws_latitude: p });
              }}
              placeholder={translate('packages.AgentDiagram.eg48')}
            />
          </DbFieldRow>
          <DbFieldRow>
            <label>{translate('packages.AgentDiagram.longitude')}</label>
            <Textfield
              outline
              value={String(action.ws_longitude ?? 0)}
              onChange={(v) => {
                const p = parseFloat(String(v).replace(',', '.'));
                if (!isNaN(p)) update<AgentStateMember>(action.id, { ws_longitude: p });
              }}
              placeholder={translate('packages.AgentDiagram.eg23')}
            />
          </DbFieldRow>
        </LlmFieldRow>
      );
      break;
    case 'ws_file':
      content = (
        <WsWarning>{translate('packages.AgentDiagram.placeholderWarning.wsFile')}</WsWarning>
      );
      break;
    case 'ws_image':
      content = (
        <WsWarning>{translate('packages.AgentDiagram.placeholderWarning.wsImage')}</WsWarning>
      );
      break;
    case 'ws_dataframe':
      content = (
        <WsWarning>{translate('packages.AgentDiagram.placeholderWarning.wsDataframe')}</WsWarning>
      );
      break;
    case 'ws_plotly':
      content = (
        <WsWarning>{translate('packages.AgentDiagram.placeholderWarning.wsPlotly')}</WsWarning>
      );
      break;
    default:
      break;
  }
  return (
    <>
      {platformWarning}
      {content}
    </>
  );
};
