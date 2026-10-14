// "New action" picker below an agent state body: section tabs, action-type options, add button.
import React from 'react';
import {
  ACTION_DESCRIPTION_KEYS,
  ActionSection,
  PLACEHOLDER_ACTIONS,
  PLACEHOLDER_WARNING_KEYS,
  SIMPLE_LEFT_COLUMN,
  SIMPLE_RIGHT_COLUMN,
  Translate,
  WS_REPLY_TYPES,
} from './agent-state-update-constants';
import {
  ActionDesc,
  AddActionButton,
  NewActionLabel,
  NewActionOptionBtn,
  NewActionOptionList,
  SectionTab,
  SectionTabRow,
  WsWarning,
} from './agent-state-update-styles';

export interface NewActionPickerOptions {
  translate: Translate;
  actionTypeLabel: (replyType: string) => string;
  section: ActionSection;
  setSection: (section: ActionSection) => void;
  sectionTypes: string[];
  selectedActionType: string;
  setNewActionType: (replyType: string) => void;
  hasWebSocketPlatform: boolean;
  hasCompatibleChatLlm: boolean;
  onAdd: () => void;
}

export const renderNewActionPicker = ({
  translate,
  actionTypeLabel,
  section,
  setSection,
  sectionTypes,
  selectedActionType,
  setNewActionType,
  hasWebSocketPlatform,
  hasCompatibleChatLlm,
  onAdd,
}: NewActionPickerOptions): React.ReactNode => (
  <>
    <NewActionLabel>{translate('packages.AgentDiagram.newActionLabel')}</NewActionLabel>
    <SectionTabRow>
      <SectionTab active={section === 'simple'} onClick={() => setSection('simple')}>
        {translate('packages.AgentDiagram.simpleReplies')}
      </SectionTab>
      <SectionTab active={section === 'ai'} onClick={() => setSection('ai')}>
        {translate('packages.AgentDiagram.aiReplies')}
      </SectionTab>
      <SectionTab active={section === 'data'} onClick={() => setSection('data')}>
        {translate('packages.AgentDiagram.dataQuery')}
      </SectionTab>
    </SectionTabRow>
    {section === 'simple' ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
        <NewActionOptionList>
          {SIMPLE_LEFT_COLUMN.map((type) => {
            const isWarn = WS_REPLY_TYPES.has(type) && !hasWebSocketPlatform;
            return (
              <NewActionOptionBtn
                key={type}
                active={selectedActionType === type}
                warn={isWarn}
                onClick={() => setNewActionType(type)}
              >
                {actionTypeLabel(type)}
              </NewActionOptionBtn>
            );
          })}
        </NewActionOptionList>
        <NewActionOptionList>
          {SIMPLE_RIGHT_COLUMN.map((type) => (
            <NewActionOptionBtn
              key={type}
              active={selectedActionType === type}
              dimmed
              onClick={() => setNewActionType(type)}
            >
              {actionTypeLabel(type)}
            </NewActionOptionBtn>
          ))}
        </NewActionOptionList>
      </div>
    ) : (
      <NewActionOptionList>
        {sectionTypes.map((type) => {
          const isWarn = WS_REPLY_TYPES.has(type) && !hasWebSocketPlatform;
          const isChatWarn = type === 'llm_chat' && !hasCompatibleChatLlm;
          return (
            <NewActionOptionBtn
              key={type}
              active={selectedActionType === type}
              warn={isWarn || isChatWarn}
              onClick={() => setNewActionType(type)}
            >
              {actionTypeLabel(type)}
            </NewActionOptionBtn>
          );
        })}
      </NewActionOptionList>
    )}
    {ACTION_DESCRIPTION_KEYS[selectedActionType] && (
      <ActionDesc>{translate(ACTION_DESCRIPTION_KEYS[selectedActionType])}</ActionDesc>
    )}
    {PLACEHOLDER_ACTIONS.has(selectedActionType) && PLACEHOLDER_WARNING_KEYS[selectedActionType] && (
      <WsWarning style={{ marginTop: 2, marginBottom: 4 }}>
        ⚠ {translate(PLACEHOLDER_WARNING_KEYS[selectedActionType])}
      </WsWarning>
    )}
    <div style={{ marginTop: 6 }}>
      <AddActionButton onClick={onAdd}>
        {`${translate('packages.AgentDiagram.addAction')} ${actionTypeLabel(selectedActionType)}`}
      </AddActionButton>
    </div>
  </>
);
