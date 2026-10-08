import React, { Component, ComponentType } from 'react';
import { findDOMNode } from 'react-dom';
import { connect, ConnectedComponent } from 'react-redux';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { ModelState } from '../../store/model-state';
import { UMLElementComponentProps } from '../uml-element-component-props';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { FloatingButton } from './FloatingButton';
import { EditIcon } from './icons/EditIcon';
import { AddIcon } from './icons/AddIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { IPoint } from '../../../utils/geometry/point';
import { IPath } from '../../../utils/geometry/path';
import { AssociationPopup } from '../../../services/uml-element/connectable/association-popup-repository';
import { I18nConsumer } from '../../i18n/i18n-context';


const initialState = {};

type StateProps = {
  hovered: boolean;
  selected: boolean;
  isObjectDiagram: boolean;
};

type DispatchProps = {
  updateStart: AsyncDispatch<typeof UMLElementRepository.updateStart>;
  deleteElement: AsyncDispatch<typeof UMLElementRepository.delete>;
  openAssociationPopup: AsyncDispatch<typeof AssociationPopup.open>;
  getElementById: (id: string) => UMLElement | null;
  getRelationshipById: (id: string) => UMLElement | null;
};

type Props = UMLElementComponentProps & StateProps & DispatchProps;

type State = typeof initialState;

const enhance = connect<StateProps, DispatchProps, UMLElementComponentProps, ModelState>(
  (state, props) => {
    const isObjectDiagram = state.diagram.type === 'ObjectDiagram' || state.diagram.type === 'UserDiagram';
    return {
      hovered: state.hovered[0] === props.id,
      selected: state.selected.includes(props.id),
      isObjectDiagram
    };
  },
  {
    updateStart: UMLElementRepository.updateStart,
    deleteElement: UMLElementRepository.delete,
    openAssociationPopup: AssociationPopup.open,
    getElementById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
    getRelationshipById: UMLRelationshipRepository.getById as any as AsyncDispatch<
      typeof UMLRelationshipRepository.getById
    >,
  },
);

export const updatable = (
  WrappedComponent: ComponentType<UMLElementComponentProps>,
): ConnectedComponent<ComponentType<Props>, UMLElementComponentProps> => {
  class Updatable extends Component<Props, State> {
    state = initialState;

    componentDidMount() {
      const node = findDOMNode(this) as HTMLElement;
      node.addEventListener('dblclick', this.onStartUpdate);
    }

    componentWillUnmount() {
      const node = findDOMNode(this) as HTMLElement;
      node.removeEventListener('dblclick', this.onStartUpdate);
    }

    /**
     * Determine the rightmost point in a path
     * @param path The path for which the rightmost point should be determined
     */
    private findRightmostPoint(path: IPath): IPoint | undefined {
      let rightmostPoint = undefined;

      for (const currentPoint of path) {
        if (rightmostPoint === undefined || currentPoint.x > rightmostPoint.x) {
          rightmostPoint = currentPoint;
        }
      }

      return rightmostPoint;
    }

    /**
     * Helper function to determine the base coordinates for the context actions
     * @param element The element for which the context action base coordinates should be determined
     */
    private getContextActionBaseCoordinates(element: UMLElement): IPoint {
      const isRelationship = UMLRelationship.isUMLRelationship(element);

      if (!isRelationship) {
        return {
          x: element.bounds.width,
          y: -30,
        };
      }

      const relationship = element as UMLRelationship;

      const rightmostPoint = this.findRightmostPoint(relationship.path);

      return {
        x: (rightmostPoint?.x ?? 0) - 40,
        y: (rightmostPoint?.y ?? 0) - 30,
      };
    }

    render() {
      const { updateStart, deleteElement, getElementById, getRelationshipById, hovered, selected, isObjectDiagram, openAssociationPopup, ...props } =
        this.props;

      const element = getElementById(props.id);
      const relationship = getRelationshipById(props.id);

      const baseCoordinates = this.getContextActionBaseCoordinates((element || relationship)!);

      return (
        <I18nConsumer>
          {(i18n) => {
            const label = (key: string, fallback: string) => i18n?.translate(key) || fallback;
            return (
              <WrappedComponent {...props}>
                <FloatingButton
                  style={{
                    opacity: selected ? 1 : 0,
                    transform: `translate(${baseCoordinates.x}px, ${baseCoordinates.y - 10}px)`,
                  }}
                  onClick={this.onStartUpdate}
                  label={label('actions.edit', 'Edit')}
                  active={selected}
                >
                  <EditIcon x={7} y={7} />
                </FloatingButton>
                <FloatingButton
                  style={{
                    opacity: selected ? 1 : 0,
                    transform: `translate(${baseCoordinates.x}px, ${baseCoordinates.y - 50}px)`,
                  }}
                  onClick={this.onDelete}
                  label={label('actions.delete', 'Delete')}
                  active={selected}
                >
                  <DeleteIcon x={7} y={7} />
                </FloatingButton>
                {isObjectDiagram && (
                  <FloatingButton
                    style={{
                      opacity: selected ? 1 : 0,
                      transform: `translate(${baseCoordinates.x}px, ${baseCoordinates.y - 90}px)`,
                    }}
                    onClick={this.onAdd}
                    label={label('actions.addConnectedObject', 'Add connected object')}
                    active={selected}
                  >
                    <AddIcon x={7} y={7} />
                  </FloatingButton>
                )}
              </WrappedComponent>
            );
          }}
        </I18nConsumer>
      );
    }

    /**
     * Show the update dialog of the wrapped element.
     *
     * Stops propagation so that when a child element nested inside a container
     * (e.g. an NN layer inside an NNContainer) is double-clicked, only the
     * deepest element opens its update panel — without this, the dblclick
     * bubbles to the container and overrides the child's updateStart.
     */
    private onStartUpdate = (event?: Event | React.SyntheticEvent) => {
      if (event && typeof (event as { stopPropagation?: () => void }).stopPropagation === 'function') {
        (event as { stopPropagation: () => void }).stopPropagation();
      }
      this.props.updateStart(this.props.id);
    };

    /**
     * Show the delete dialog of the wrapped element
     */
    private onDelete = () => {
      this.props.deleteElement(this.props.id);
    };

    /**
     * Show the add dialog of the wrapped element
     */
    private onAdd = () => {
      this.props.openAssociationPopup(this.props.id, this.props.isObjectDiagram);
    };
  }

  return enhance(Updatable);
};
