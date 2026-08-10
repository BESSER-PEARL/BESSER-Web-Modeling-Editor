import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { AgentState } from '../../packages/agent-state-diagram/agent-state/agent-state';
import { UMLStateInitialNode } from '../../packages/uml-state-diagram/uml-state-initial-node/uml-state-initial-node';
import { Comments } from '../../packages/common/comments/comments';
import { UMLDiagramType } from '../../packages/diagram-type';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { UMLElementFeatures } from '../../services/uml-element/uml-element-features';
import { ModelState } from '../store/model-state';
import { StoreProvider } from '../store/model-store';
import { PreviewElementComponent } from './preview-element-component';
import { UMLElement } from '../../services/uml-element/uml-element';
import { styled } from '../theme/styles';

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 40;
const INITIAL_NODE_SIZE = 30;
const COMMENT_WIDTH = 160;
const COMMENT_HEIGHT = 50;

const FloatingBox = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  padding: 10px 14px 10px;
  border-radius: 8px;
  border: 1px solid ${(props) => props.theme.color.gray};
  background: ${(props) => props.theme.color.background};
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  user-select: none;
`;

const PaletteItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
`;

const Divider = styled.div`
  width: 100%;
  border-top: 1px solid ${(props) => props.theme.color.gray};
  opacity: 0.4;
`;

const PaletteTitle = styled.p`
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  text-align: center;
  margin: 0 0 2px;
  white-space: nowrap;
`;

const DragLabel = styled.p`
  font-size: 11px;
  opacity: 0.55;
  text-align: center;
  margin: 0;
  white-space: nowrap;
`;

const FEATURES: UMLElementFeatures = {
  hoverable: false,
  selectable: false,
  movable: false,
  resizable: false,
  connectable: false,
  updatable: false,
  droppable: false,
  alternativePortVisualization: false,
};

type StateProps = { diagramType: string };
type DispatchProps = { create: typeof UMLElementRepository.create };

const enhance = compose<ComponentClass>(
  connect<StateProps, DispatchProps, {}, ModelState>(
    (state) => ({ diagramType: state.diagram.type }),
    { create: UMLElementRepository.create },
  ),
);

class AgentStateDragBoxComponent extends Component<StateProps & DispatchProps> {
  private readonly previewState: AgentState = new AgentState({
    name: 'AgentState',
    bounds: { x: 0, y: 0, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
  });

  private readonly previewInitialNode: UMLStateInitialNode = new UMLStateInitialNode({
    bounds: { x: 0, y: 0, width: INITIAL_NODE_SIZE, height: INITIAL_NODE_SIZE },
  });

  private readonly previewComment: Comments = new Comments({
    name: 'Comment',
    bounds: { x: 0, y: 0, width: COMMENT_WIDTH, height: COMMENT_HEIGHT },
  });

  private readonly previewStateElements = { [this.previewState.id]: { ...this.previewState } };
  private readonly previewInitialNodeElements = { [this.previewInitialNode.id]: { ...this.previewInitialNode } };
  private readonly previewCommentElements = { [this.previewComment.id]: { ...this.previewComment } };

  render() {
    if (this.props.diagramType !== UMLDiagramType.AgentDiagram) return null;

    return (
      <FloatingBox>
        <PaletteTitle>Drag and drop elements</PaletteTitle>
        {/* AgentState */}
        <PaletteItem>
          <StoreProvider initialState={{ elements: this.previewStateElements, editor: { features: FEATURES } }}>
            <div style={{ height: PREVIEW_HEIGHT, width: PREVIEW_WIDTH }}>
              <PreviewElementComponent element={this.previewState} create={this.handleCreate} />
            </div>
          </StoreProvider>
          <DragLabel>Add new state</DragLabel>
        </PaletteItem>

        <Divider />

        {/* StateInitialNode */}
        <PaletteItem>
          <StoreProvider initialState={{ elements: this.previewInitialNodeElements, editor: { features: FEATURES } }}>
            <div style={{ height: INITIAL_NODE_SIZE, width: INITIAL_NODE_SIZE }}>
              <PreviewElementComponent element={this.previewInitialNode} create={this.handleCreate} />
            </div>
          </StoreProvider>
          <DragLabel>Connect to the initial state</DragLabel>
        </PaletteItem>

        <Divider />

        {/* Comments */}
        <PaletteItem>
          <StoreProvider initialState={{ elements: this.previewCommentElements, editor: { features: FEATURES } }}>
            <div style={{ height: COMMENT_HEIGHT, width: COMMENT_WIDTH }}>
              <PreviewElementComponent element={this.previewComment} create={this.handleCreate} />
            </div>
          </StoreProvider>
          <DragLabel>Add a comment</DragLabel>
        </PaletteItem>
      </FloatingBox>
    );
  }

  private handleCreate = (element: UMLElement, owner?: string) => {
    this.props.create([element], owner);
  };
}

export const AgentStateDragBox = enhance(AgentStateDragBoxComponent);
