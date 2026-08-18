import React, { ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentRagElement } from './agent-rag-element';
import { AgentElementType } from '..';

const AGENT_LLM_TYPE = (AgentElementType as Record<string, string>).AgentLLM ?? 'AgentLLM';

type OwnProps = {
  element: AgentRagElement;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const Section = styled.section`
  padding: 8px 0;
`;

const Select = styled.select`
  width: 100%;
  height: 30px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: transparent;
  color: inherit;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${(props) => props.theme.color.gray};
  margin: 8px 0;
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.85em;
  font-weight: 600;
`;

const DisabledTextfield = styled.div<{ disabled: boolean }>`
  opacity: ${(props) => (props.disabled ? 0.4 : 1)};
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
`;

const AgentRagElementUpdateComponent: React.FC<Props> = ({ element, update, elements, translate }) => {
  const llmNames = Array.from(
    new Set(
      Object.values(elements)
        .filter((el: any) => el.type === AGENT_LLM_TYPE && typeof el.name === 'string')
        .map((el: any) => el.name.trim())
        .filter((name: string) => name.length > 0),
    ),
  );

  return (
    <div>
      <Section>
        <Header>{translate('popup.agent.rag.name')}</Header>
        <Textfield value={element.name} onChange={(name) => update(element.id, { name })} autoFocus />
      </Section>
      <Section>
        <Header>{translate('popup.agent.llm.label')}</Header>
        <Select
          value={element.llm_name || ''}
          onChange={(event) => update<AgentRagElement>(element.id, { llm_name: event.target.value })}
        >
          <option value="">{translate('popup.agent.llm.useDefault')}</option>
          {llmNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.llmPromptPrefix')}</Header>
        <Textfield
          value={element.llm_prompt || ''}
          onChange={(llm_prompt) => update<AgentRagElement>(element.id, { llm_prompt })}
          multiline
          enterToSubmit={false}
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.retrievedChunks')}</Header>
        <Textfield
          value={element.k ?? 4}
          onChange={(k) => update<AgentRagElement>(element.id, { k: Math.max(1, k) })}
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.numPreviousMessages')}</Header>
        <Textfield
          value={element.num_previous_messages ?? 0}
          onChange={(num_previous_messages) =>
            update<AgentRagElement>(element.id, {
              num_previous_messages: Math.max(0, num_previous_messages),
            })
          }
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.embeddingProvider')}</Header>
        <Select
          value={element.embedding_provider || 'openai'}
          onChange={(event) => {
            const provider = event.target.value as 'openai' | 'ollama';
            const updates: Partial<AgentRagElement> = { embedding_provider: provider };
            if (provider === 'ollama' && !element.embedding_base_url) {
              updates.embedding_base_url = 'http://localhost:11434';
            }
            update<AgentRagElement>(element.id, updates);
          }}
        >
          <option value="openai">{translate('packages.AgentDiagram.openai')}</option>
          <option value="ollama">{translate('packages.AgentDiagram.ollamaLocal')}</option>
        </Select>
      </Section>
      {element.embedding_provider === 'ollama' && (
        <>
          <Section>
            <Header>{translate('packages.AgentDiagram.embeddingBaseUrl')}</Header>
            <Textfield
              value={element.embedding_base_url || 'http://localhost:11434'}
              onChange={(embedding_base_url) => update<AgentRagElement>(element.id, { embedding_base_url })}
              placeholder={translate('packages.AgentDiagram.embeddingBaseUrlPlaceholder')}
            />
          </Section>
          <Section>
            <Header>{translate('packages.AgentDiagram.embeddingModel')}</Header>
            <Textfield
              value={element.embedding_model || ''}
              onChange={(embedding_model) => update<AgentRagElement>(element.id, { embedding_model })}
            />
          </Section>
        </>
      )}
      <Divider />
      <Section>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={element.use_hybrid_rag === true}
            onChange={(e) => update<AgentRagElement>(element.id, { use_hybrid_rag: e.target.checked })}
          />
          Hybrid RAG (BM25)
        </CheckboxRow>
      </Section>
      <DisabledTextfield disabled={!element.use_hybrid_rag}>
        <Section>
          <Header>BM25 Weight</Header>
          <Textfield
            value={String(element.bm25_weight ?? 0.6)}
            onSubmit={(raw) => {
              const parsed = parseFloat(String(raw));
              const val = !isNaN(parsed) && parsed > 0 && parsed < 1 ? parsed : 0.6;
              update<AgentRagElement>(element.id, { bm25_weight: val });
            }}
          />
        </Section>
      </DisabledTextfield>
    </div>
  );
};

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>((state) => ({ elements: state.elements }), {
    update: UMLElementRepository.update,
  }),
);

export const AgentRagElementUpdate = enhance(AgentRagElementUpdateComponent);
