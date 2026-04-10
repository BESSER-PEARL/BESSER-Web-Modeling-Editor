import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { NNReference } from './nn-reference';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { NNElementType } from '..';
import { IUMLElement } from '../../../services/uml-element/uml-element';

interface OwnProps {
  element: NNReference;
}

interface StateProps {
  nnContainers: IUMLElement[];
}

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      // Get all NNContainer elements from the model
      nnContainers: Object.values(state.elements).filter(
        (el) => el.type === NNElementType.NNContainer
      ),
    }),
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
    }
  ),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

type State = { colorOpen: boolean };

class NNReferenceUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element, nnContainers } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <span style={{ fontWeight: 'bold' }}>
              {this.props.translate('packages.NNDiagram.NNReference')}
            </span>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <Divider />
        </section>
        <section>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
            fillColor
          />
        </section>
        <section>
          <Label>{this.props.translate('packages.NNDiagram.SelectNN')}</Label>
          <Dropdown
            value={element.referencedNN || ''}
            onChange={this.changeReferencedNN(element.id)}
          >
            {[
              { id: '__placeholder__', name: '' },
              ...nnContainers.map(nn => ({ id: nn.id, name: nn.name }))
            ].map((item) => (
              <Dropdown.Item key={item.id} value={item.name}>
                {item.name || this.props.translate('packages.NNDiagram.SelectNNPlaceholder')}
              </Dropdown.Item>
            ))}
          </Dropdown>
        </section>
      </div>
    );
  }

  /**
   * Change the referenced NN
   * @param id The ID of the NNReference element
   */
  private changeReferencedNN = (id: string) => (value: string) => {
    this.props.update<NNReference>(id, {
      referencedNN: value,
      name: value || 'SubNN',
    });
  };

  /**
   * Delete the NNReference
   * @param id The ID of the element to delete
   */
  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const NNReferenceUpdate = enhance(NNReferenceUpdateComponent);
