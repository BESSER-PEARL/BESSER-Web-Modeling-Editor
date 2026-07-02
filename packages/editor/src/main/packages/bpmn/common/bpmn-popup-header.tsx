import React, { Component } from 'react';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';

export interface BpmnPopupHeaderElement {
  id: string;
  name: string;
  fillColor?: string;
  lineColor?: string;
  textColor?: string;
}

interface Props {
  element: BpmnPopupHeaderElement;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type State = { colorOpen: boolean };

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

export class BpmnPopupHeader extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({ colorOpen: !state.colorOpen }));
  };

  render() {
    const { element, update } = this.props;

    return (
      <section>
        <Flex>
          <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
          <ColorButton onClick={this.toggleColor} />
          <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
            <TrashIcon />
          </Button>
        </Flex>
        <section>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={update}
            lineColor
            textColor
            fillColor
          />
        </section>
      </section>
    );
  }

  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}
