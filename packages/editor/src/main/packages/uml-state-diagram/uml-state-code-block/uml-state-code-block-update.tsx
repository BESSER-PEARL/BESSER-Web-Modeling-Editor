import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { IUMLStateCodeBlock, UMLStateCodeBlock } from './uml-state-code-block';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;


const StyledTextArea = styled.textarea`
  padding: 8px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  width: 100%;
  max-width: 100%;
  min-height: 150px;
  font-family: monospace;

  white-space: pre;
  tab-size: 4;
  box-sizing: border-box;
  overflow-x: auto;
  
  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.color.primary};
  }
`;

type State = { colorOpen: boolean };


type OwnProps = {
  element: UMLStateCodeBlock;
};

type StateProps = {};

type DispatchProps = {
  update: (id: string, values: Partial<IUMLStateCodeBlock>) => void;
  deleteElement: typeof UMLElementRepository.delete;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

class StateCodeBlockUpdate extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private updateCode = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = event.target.value;
    const { element, update } = this.props;
    update(element.id, { 
      code: content
    });
  };

  private handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow tab key to insert a tab character instead of changing focus
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const value = target.value;
      const newValue = value.substring(0, start) + '\t' + value.substring(end);
      
      // Update the value directly
      target.value = newValue;
      
      // Update the cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
      
      // Trigger the update with the new value
      this.updateCode({
        target: target,
        currentTarget: target,
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }
  };

  private onUpdateSize = (dimension: 'width' | 'height') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      const { element, update } = this.props;
      update(element.id, {
        bounds: {
          ...element.bounds,
          [dimension]: value
        }
      });
    }
  };

  render() {
    const { element, update, deleteElement } = this.props;
    
    return (
      <div>
        <section>
          <Flex>
            <Header>Python Code Block</Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={() => deleteElement(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={update}
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>

        <section>
          <StyledTextArea
            value={element.code || ''}
            onChange={this.updateCode}
            onKeyDown={this.handleKeyDown}
            autoFocus
            spellCheck={false}
          />
        </section>
      </div>
    );
  }
}

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update as any as (id: string, values: Partial<IUMLStateCodeBlock>) => void,
    deleteElement: UMLElementRepository.delete,
  }),
);

export const UMLStateCodeBlockUpdate = enhance(StateCodeBlockUpdate);
