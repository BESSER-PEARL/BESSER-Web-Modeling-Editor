import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { AgentStateTransition, IUMLStateTransition } from './agent-state-transition';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const ParamContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const ParamControls = styled.div`
  display: flex;
  gap: 4px;
`;

type State = { 
  colorOpen: boolean;
  paramIds: string[];
};

type OwnProps = {
  element: AgentStateTransition;
};

type StateProps = {
  elements: { [id: string]: any };
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

class AgentStateTransitionUpdateClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      colorOpen: false,
      paramIds: Object.keys(props.element.params).length > 0 
        ? Object.keys(props.element.params).sort() 
        : ['0']
    };
  }

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };


  render() {
    const { element, elements } = this.props;
    // Get intent names from current model state instead of localStorage
    const intentNames: string[] = Object.values(elements)
      .filter((el: any) => el.type === "AgentIntent" && typeof el.name === "string")
      .map((el: any) => el.name);

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('packages.AgentDiagram.StateTransition')}
            </Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
              <ExchangeIcon />
            </Button>
            <Button color="link" onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <Divider />
        </section>
        <section>
        </section>
        <section>
          <Header>Condition</Header>
          <Dropdown
            value={element.condition || 'when_intent_matched'}
            onChange={value =>
              this.props.update<AgentStateTransition>(element.id, { condition: value })
            }
          >
            <Dropdown.Item value="when_intent_matched">When Intent Matched</Dropdown.Item>
            <Dropdown.Item value="when_no_intent_matched">When No Intent Matched</Dropdown.Item>
            <Dropdown.Item value="when_variable_operation_matched">Variable Operation Matched</Dropdown.Item>
            <Dropdown.Item value="when_file_received">File Received</Dropdown.Item>
            <Dropdown.Item value="auto">Auto Transition</Dropdown.Item>
          </Dropdown>
          {/* Intent name dropdown, only shown if condition is "when_intent_matched" */}
          {element.condition === "when_intent_matched" && (
            <Dropdown
              value={element.intentName || '__placeholder__'}
              onChange={value =>
                this.props.update<AgentStateTransition>(element.id, { intentName: value === '__placeholder__' ? '' : value })
              }
            >
              {[
                <Dropdown.Item value="__placeholder__" key="intent-placeholder">Select intent</Dropdown.Item>,
                ...intentNames.map((name, idx) => (
                  <Dropdown.Item key={idx} value={name}>
                    {name}
                  </Dropdown.Item>
                ))
              ]}
            </Dropdown>
          )}
          {/* Variable match fields, only shown if condition is "variable_matched" */}
          {element.condition === "when_variable_operation_matched" && (
            <React.Fragment>
              <Textfield
                value={element.variable || ""}
                onChange={value =>
                  this.props.update<AgentStateTransition>(element.id, { variable: value })
                }
                placeholder="Variable"
                style={{ marginBottom: "8px" }}
              />
              <Dropdown
                value={element.operator || '=='}
                onChange={value =>
                  this.props.update<AgentStateTransition>(element.id, { operator: value })
                }
              >
                <Dropdown.Item value="<">&lt;</Dropdown.Item>
                <Dropdown.Item value="<=">&le;</Dropdown.Item>
                <Dropdown.Item value="==">==</Dropdown.Item>
                <Dropdown.Item value=">=">&ge;</Dropdown.Item>
                <Dropdown.Item value=">">&gt;</Dropdown.Item>
                <Dropdown.Item value="!=">!=</Dropdown.Item>
              </Dropdown>
              <Textfield
                value={element.targetValue || ""}
                onChange={value =>
                  this.props.update<AgentStateTransition>(element.id, { targetValue: value })
                }
                placeholder="Target value"
              />
            </React.Fragment>
          )}
          {element.condition === "when_file_received" && (
            <Dropdown
              value={element.fileType || '__placeholder__'}
              onChange={value =>
                this.props.update<AgentStateTransition>(element.id, { fileType: value === '__placeholder__' ? '' : value })
              }
            >
              {[
                <Dropdown.Item value="__placeholder__" key="filetype-placeholder">Select file type</Dropdown.Item>,
                <Dropdown.Item value="PDF" key="pdf">PDF</Dropdown.Item>,
                <Dropdown.Item value="TXT" key="txt">TXT</Dropdown.Item>,
                <Dropdown.Item value="JSON" key="json">JSON</Dropdown.Item>
              ]}
            </Dropdown>
          )}
        </section>

        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          lineColor
          textColor
        />
      </div>
    );
  }

  private rename = (name: string) => {
    this.props.update<AgentStateTransition>(this.props.element.id, { name });
  };
}

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      elements: state.elements,
    }),
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      flip: UMLRelationshipRepository.flip,
    }
  ),
);

export const AgentStateTransitionUpdate = enhance(AgentStateTransitionUpdateClass);
