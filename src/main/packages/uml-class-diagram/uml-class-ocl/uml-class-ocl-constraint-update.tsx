import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { ClassOCLConstraint, IUMLClassOCLConstraint } from './uml-class-ocl-constraint';

const Flex = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
`;

const StyledTextarea = styled.textarea`
  font-family: inherit;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: both;
  min-width: 200px;
  min-height: 100px;
  height: 150px;
  line-height: 1.4;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  padding: 8px;
`;

type State = { colorOpen: boolean };

class ClassOCLConstraintUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <StyledTextarea
              value={element.constraint || ''}
              placeholder={this.props.translate('packages.OCLConstraint.Constraint')}
              onChange={(e) => this.onUpdate(e.target.value)}
              autoFocus
            />
            <ButtonRow>
              <ColorButton onClick={this.toggleColor} />
              <Button color="link" tabIndex={-1} onClick={() => this.props.delete(element.id)}>
                <TrashIcon />
              </Button>
            </ButtonRow>
          </Flex>
        </section>
        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          lineColor
          textColor
          fillColor
        />
      </div>
    );
  }
  private onUpdate = (constraint: string) => {
    const { element, update } = this.props;
    const currentBounds = element.bounds;
    
    update(element.id, { 
      constraint,
      bounds: {
        ...currentBounds,
        // Keep existing width/height if manually resized
        width: currentBounds.width,
        height: currentBounds.height
      }
    } as Partial<IUMLClassOCLConstraint>);
  };
}

type OwnProps = {
  element: ClassOCLConstraint;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: AsyncDispatch<typeof UMLElementRepository.delete>;
};

export type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
  }),
);

export const ClassOCLConstraintUpdate = enhance(ClassOCLConstraintUpdateComponent);