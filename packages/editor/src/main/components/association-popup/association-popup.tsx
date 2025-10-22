import React, { Component, createRef, RefObject, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { createPortal } from 'react-dom';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../controls/button/button';
import { Divider } from '../controls/divider/divider';
import { Popover } from '../controls/popover/popover';
import { Body, Header } from '../controls/typography/typography';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { ModelState } from '../store/model-state';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../utils/actions/actions';
import { AssociationPopup } from '../../services/uml-element/connectable/association-popup-repository';
import { diagramBridge } from '../../services/diagram-bridge';
import { CanvasContext } from '../canvas/canvas-context';
import { withCanvas } from '../canvas/with-canvas';
import { RootContext } from '../root/root-context';
import { withRoot } from '../root/with-root';
import { Point } from '../../utils/geometry/point';
import { uuid } from '../../utils/uuid';
import { PreviewElement as BasePreviewElement } from '../../packages/compose-preview';
import { UMLObjectLink } from '../../packages/uml-object-diagram/uml-object-link/uml-object-link';
import { Direction } from '../../services/uml-element/uml-element-port';

type PreviewElement = BasePreviewElement & {
  classId?: string;
  ownedElements?: any[];
};

const PopupContainer = styled.div`
  min-width: 300px;
  max-width: 500px;
  max-height: 400px;
  overflow-y: auto;
`;

const AssociationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const AssociationItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f9f9f9;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background: #f0f0f0;
  }
`;

const AssociationInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AssociationName = styled.span`
  font-weight: 500;
  color: #333;
`;

const AssociationDetails = styled.span`
  font-size: 12px;
  color: #666;
`;

const NoAssociationsMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
`;

type OwnProps = {};

type StateProps = {
  isOpen: boolean;
  sourceObjectId: string | null;
  isIconObjectDiagram: boolean | null;
  elements: { [id: string]: any };
  palette: PreviewElement[];
};

type DispatchProps = {
  closePopup: typeof AssociationPopup.close;
  createRelationship: AsyncDispatch<typeof UMLElementRepository.create>;
  create: typeof UMLElementRepository.create;
};

type Props = OwnProps & StateProps & DispatchProps & CanvasContext & RootContext;

const initialState = Object.freeze({
  position: null as { x: number; y: number } | null,
  placement: undefined as 'top' | 'right' | 'bottom' | 'left' | undefined,
  alignment: undefined as 'start' | 'center' | 'end' | undefined,
});

type State = typeof initialState;

class UnwrappedAssociationPopup extends Component<Props, State> {
  state = initialState;
  popover: RefObject<HTMLDivElement> = createRef();
  private ignoreNextDocumentClick = false;

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (!prevProps.isOpen && this.props.isOpen) {
      setTimeout(this.position, 0);
      this.ignoreNextDocumentClick = true;
    }
  }

  componentDidMount(): void {
    document.addEventListener('click', this.handleOutsideClick);
  }

  componentWillUnmount(): void {
    document.removeEventListener('click', this.handleOutsideClick);
  }

  render() {
    const { isOpen, sourceObjectId } = this.props;
    const { position } = this.state;

    if (!isOpen || !sourceObjectId || !position) {
      return null;
    }

    const availableTargets = this.getAvailableTargets(Object.values(this.props.elements));

    return createPortal(
      <Popover
        ref={this.popover}
        position={position}
        placement={this.state.placement}
        alignment={this.state.alignment}
        maxHeight={400}
      >
        <PopupContainer>
          <Header>{'Add and connect to new Object'}</Header>
          <Divider />
          {this.renderTargetSelection(availableTargets)}
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button onClick={this.handleClose}>{'Cancel'}</Button>
          </div>
        </PopupContainer>
      </Popover>,
      this.props.root,
    );
  }

  private renderTargetSelection(targets: any[]) {
    if (targets.length === 0) {
      return (
        <NoAssociationsMessage>
          {'No other objects available to connect to'}
        </NoAssociationsMessage>
      );
    }

    return (
      <AssociationList>
        {targets.map((target) => (
          <AssociationItem
            key={target.id}
            onClick={() => this.handleTargetSelect(target)}
          >
            <AssociationInfo>
              <AssociationName>{target.name}</AssociationName>
            </AssociationInfo>
          </AssociationItem>
        ))}
      </AssociationList>
    );
  }

  private getAvailableTargets(elements: any[]) {
    const objectsWithClassId = elements.find(
      (element: any) => element.classId && element.id === this.props.sourceObjectId
    );
    if (!objectsWithClassId) return [];
    const relatedClasses = diagramBridge.getRelatedClasses(objectsWithClassId.classId);
    return relatedClasses.map((cls: any) => ({
      id: cls.id,
      name: cls.name,
    }));
  }

  private handleTargetSelect = (target: any) => {
    const { sourceObjectId, elements, palette } = this.props;
    if (!sourceObjectId || !target) return;

    const sourceObject = JSON.parse(JSON.stringify(elements[sourceObjectId]));

    for (const object of palette) {
      if (object.classId && object.classId === target.id) {
        const newObject = {
          ...object,
        };
        const newId = uuid();
        newObject.id = newId;
        newObject.bounds.x = sourceObject.bounds.x;
        newObject.bounds.y = sourceObject.bounds.y + 100 + sourceObject.bounds.height;
        newObject.ownedElements = [];
        if (object.ownedElements) {
          for (const ownedElement of object.ownedElements) {
            for (const childObject of palette) {
              if (ownedElement === childObject.id) {
                const newOwnedElement = {
                  ...childObject,
                };
                const newOwnedId = uuid();
                newOwnedElement.id = newOwnedId;
                newObject.ownedElements.push(newOwnedId);
                newOwnedElement.owner = newId;
                this.props.create(newOwnedElement);
              }
            }
          }
        }
        this.props.create(newObject);
        this.createObjectLink(sourceObjectId, newObject.id);
        break;
      }
    }
    this.handleClose();
  };

  private createObjectLink = (source: string, target: string) => {
    const { isIconObjectDiagram } = this.props;
    const relationship = isIconObjectDiagram
      ? new UMLObjectLink({
          id: uuid(),
          name: '',
          owner: null,
          path: [],
          bounds: {},
          source: { element: source, direction: Direction.Down },
          target: { element: target, direction: Direction.Up },
        })
      : new UMLObjectLink({
          id: uuid(),
          name: '',
          owner: null,
          path: [],
          bounds: {},
          source: { element: source, direction: Direction.Down },
          target: { element: target, direction: Direction.Up },
        });
    this.props.createRelationship(relationship);
  };

  private handleClose = () => {
    this.props.closePopup();
  };

  private handleOutsideClick = (event: MouseEvent) => {
    if (this.ignoreNextDocumentClick) {
      this.ignoreNextDocumentClick = false;
      return;
    }
    if (this.popover.current && !this.popover.current.contains(event.target as Node)) {
      this.handleClose();
    }
  };

  private position = () => {
    const { sourceObjectId, canvas, root, elements } = this.props;
    if (!sourceObjectId || !canvas || !root) return;

    const sourceElement = elements[sourceObjectId];
    if (!sourceElement) return;

    let absolute: Point = new Point(sourceElement.bounds.x, sourceElement.bounds.y);

    if (canvas.origin && typeof canvas.origin === 'function') {
      const origin = canvas.origin();
      const rootRect = root.getBoundingClientRect();
      absolute = absolute.add(origin.x, origin.y).subtract(rootRect.x, rootRect.y);
    }

    const elementCenter: Point = absolute.add(
      sourceElement.bounds.width / 2,
      sourceElement.bounds.height / 2,
    );
    const position = absolute;

    const container: HTMLElement | null = canvas.layer && canvas.layer.parentElement;
    let placement: 'right' | 'left' = 'right';
    let alignment: 'start' | 'end' = 'start';
    if (container) {
      const canvasBounds: ClientRect = container.getBoundingClientRect();
      placement = elementCenter.x < canvasBounds.width / 2 ? 'right' : 'left';
      alignment = elementCenter.y < canvasBounds.height / 2 ? 'start' : 'end';
    }

    if (placement === 'right') {
      position.x += sourceElement.bounds.width;
    }
    if (alignment === 'end') {
      position.y += sourceElement.bounds.height;
    }

    this.setState({ position, alignment, placement });
  };
}

const enhance = compose<ComponentClass<OwnProps>>(
  withCanvas,
  withRoot,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      isOpen: state.associationPopup.isOpen,
      sourceObjectId: state.associationPopup.sourceObjectId,
      isIconObjectDiagram: state.associationPopup.isIconObjectDiagram,
      elements: state.elements,
      palette: state.palette,
    }),
    {
      closePopup: AssociationPopup.close,
      createRelationship: UMLElementRepository.create,
      create: UMLElementRepository.create,
    },
  ),
);

export const AssociationPopupComponent = enhance(UnwrappedAssociationPopup);