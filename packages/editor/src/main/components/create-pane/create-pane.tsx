import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { UMLDiagramType } from '../../packages/diagram-type';
import { composeActivityPreview } from '../../packages/uml-activity-diagram/activity-preview';
import { composeClassPreview } from '../../packages/uml-class-diagram/class-preview';
import { composeCommunicationPreview } from '../../packages/uml-communication-diagram/communication-preview';
import { composeComponentPreview } from '../../packages/uml-component-diagram/component-preview';
import { composeDeploymentPreview } from '../../packages/uml-deployment-diagram/deployment-preview';
import { composeObjectPreview } from '../../packages/uml-object-diagram/object-preview';
import { composeUserModelPreview } from '../../packages/user-modeling/user-model-preview';
import { composeUseCasePreview } from '../../packages/uml-use-case-diagram/use-case-preview';
import { UMLElement } from '../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../services/uml-element/uml-element-features';
import { UMLContainerRepository } from '../../services/uml-container/uml-container-repository';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { UMLElementState } from '../../services/uml-element/uml-element-types';
import { clone } from '../../utils/geometry/tree';
import { CanvasContext } from '../canvas/canvas-context';
import { withCanvas } from '../canvas/with-canvas';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { ModelState } from '../store/model-state';
import { StoreProvider } from '../store/model-store';
import { PreviewElementComponent } from './preview-element-component';
import { composePetriNetPreview } from '../../packages/uml-petri-net/petri-net-preview';
import { composeReachabilityGraphPreview } from '../../packages/uml-reachability-graph/reachability-graph-preview';
import { PreviewElement } from '../../packages/compose-preview';
import { composeSyntaxTreePreview } from '../../packages/syntax-tree/syntax-tree-preview';
import { composeFlowchartPreview } from '../../packages/flowchart/flowchart-diagram-preview';
import { ColorLegend } from '../../packages/common/color-legend/color-legend';
import { Comments } from '../../packages/common/comments/comments';
import { Separator } from './create-pane-styles';
import { composeBPMNPreview } from '../../packages/bpmn/bpmn-diagram-preview';
import { BPMNPool } from '../../packages/bpmn/bpmn-pool/bpmn-pool';
import { composeStatePreview } from '../../packages/uml-state-diagram/state-preview';
import { composeNNPreview } from '../../packages/nn-diagram/nn-preview';
import { composeBotPreview } from '../../packages/agent-state-diagram/agent-state-preview';

import { setPalette } from '../../services/palette/palette-types';
import { settingsService } from '../../services/settings/settings-service';

import { BPMNElementType } from '../../packages/bpmn';

type OwnProps = {};

type StateProps = {
  type: UMLDiagramType;
  colorEnabled: boolean;
  previewScaleFactor?: number;
  elements: UMLElementState;
};

type DispatchProps = {
  create: typeof UMLElementRepository.create;
  append: typeof UMLContainerRepository.append;
  remove: typeof UMLContainerRepository.remove;
  update: typeof UMLElementRepository.update;
  setPalette: typeof setPalette;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext & CanvasContext;

const getInitialState = ({ type, canvas, colorEnabled }: Props) => {
  const previews: PreviewElement[] = [];
  const utils: PreviewElement[] = [];

  switch (type) {
    case UMLDiagramType.ClassDiagram:
      previews.push(...composeClassPreview(canvas));
      break;
    case UMLDiagramType.NNDiagram:
      previews.push(...composeNNPreview(canvas));
      break;
    case UMLDiagramType.ObjectDiagram:
      // Use the same object preview for both normal and icon mode
      // The individual components will decide how to render based on settings
      previews.push(...composeObjectPreview(canvas));
      break;
    case UMLDiagramType.ActivityDiagram:
      previews.push(...composeActivityPreview(canvas));
      break;
    case UMLDiagramType.UseCaseDiagram:
      previews.push(...composeUseCasePreview(canvas));
      break;
    case UMLDiagramType.CommunicationDiagram:
      previews.push(...composeCommunicationPreview(canvas));
      break;
    case UMLDiagramType.ComponentDiagram:
      previews.push(...composeComponentPreview(canvas));
      break;
    case UMLDiagramType.DeploymentDiagram:
      previews.push(...composeDeploymentPreview(canvas));
      break;
    case UMLDiagramType.PetriNet:
      previews.push(...composePetriNetPreview(canvas));
      break;
    case UMLDiagramType.ReachabilityGraph:
      previews.push(...composeReachabilityGraphPreview(canvas));
      break;
    case UMLDiagramType.SyntaxTree:
      previews.push(...composeSyntaxTreePreview(canvas));
      break;
    case UMLDiagramType.Flowchart:
      previews.push(...composeFlowchartPreview(canvas));
      break;
    case UMLDiagramType.BPMN:
      previews.push(...composeBPMNPreview(canvas));
      break;
    case UMLDiagramType.StateMachineDiagram:
      previews.push(...composeStatePreview(canvas));
      break;
    case UMLDiagramType.AgentDiagram:
      previews.push(...composeBotPreview(canvas));
      break;
    case UMLDiagramType.UserDiagram:
      // Use dedicated user modeling preview
      previews.push(...composeUserModelPreview(canvas));
      break;
  }
  if (colorEnabled) {
    // utils.push(
    //   new ColorLegend({
    //     name: 'Color Legend',
    //   }),
    // );
    utils.push(
      new Comments({
        name: 'Comment',
      }),
    );
  }

  return { previews, utils };
};

type State = ReturnType<typeof getInitialState>;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  withCanvas,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      type: state.diagram.type,
      colorEnabled: state.editor.colorEnabled,
      elements: state.elements,
    }),
    {
      create: UMLElementRepository.create,
      append: UMLContainerRepository.append,
      remove: UMLContainerRepository.remove,
      update: UMLElementRepository.update,
      setPalette,
    },
  ),
);

function boundsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

class CreatePaneComponent extends Component<Props, State> {
  state = getInitialState(this.props);

  componentDidMount() {
    this.props.setPalette(this.state.previews);
  }

  componentDidUpdate(prevProps: Props) {
    this.props.setPalette(this.state.previews);
  }

  getElementArray = (previews: PreviewElement[]) => {
    const STACK_GAP = 4;

    return Object.values(previews)
      .filter((preview) => !preview.owner)
      .map((preview, index) => {
        const { styles: previewStyles } = preview;

        const sanitizedStyles: React.CSSProperties = {
          ...previewStyles,
          position: 'static',
          top: 'auto',
          left: 'auto',
          transform: 'none',
          margin: 0,
        };

        return (
          <div
            style={{
              ...sanitizedStyles,
              height: preview.bounds.height,
              marginTop: index === 0 ? 0 : STACK_GAP,
            }}
            key={preview.id ?? index}
          >
            <PreviewElementComponent element={preview} create={this.create} />
          </div>
        );
      });
  };

  render() {
    const features: UMLElementFeatures = {
      hoverable: false,
      selectable: false,
      movable: false,
      resizable: false,
      connectable: false,
      updatable: false,
      droppable: false,
      alternativePortVisualization: false,
    };

    const { previews, utils } = this.state;

    const elements = [...previews, ...utils].reduce<UMLElementState>(
      (state, preview) => ({
        ...state,
        [preview.id]: { ...preview },
      }),
      {},
    );

    return (
      <StoreProvider initialState={{ elements, editor: { features } }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {this.getElementArray(previews)}
        </div>

        {utils && utils.length > 0 ? (
          <>
            <Separator />
            {this.getElementArray(utils)}
          </>
        ) : null}
      </StoreProvider>
    );
  }

  create = (preview: UMLElement, owner?: string) => {
    if (preview.type === BPMNElementType.BPMNSwimlane) {
      if (!owner) {
        return;
      }

      const ownerElement = this.props.elements[owner];
      let resolvedOwner = owner;

      if (ownerElement?.type === BPMNElementType.BPMNSwimlane) {
        const parentOwner = ownerElement.owner ? this.props.elements[ownerElement.owner] : undefined;

        if (parentOwner?.type !== BPMNElementType.BPMNPool || !ownerElement.owner) {
          return;
        }

        resolvedOwner = ownerElement.owner;
      } else if (ownerElement?.type !== BPMNElementType.BPMNPool) {
        return;
      }

      // Collect the pool's non-lane children before create() mutates the store,
      // so they can be re-parented into the new lane. (Guide 16.)
      const poolState = this.props.elements[resolvedOwner];
      const ownedIds =
        poolState && 'ownedElements' in poolState ? (poolState as { ownedElements: string[] }).ownedElements : [];
      const nonLaneChildIds = ownedIds.filter((id) => this.props.elements[id]?.type !== BPMNElementType.BPMNSwimlane);
      // Only re-parent when no lanes existed yet. For multi-lane pools the
      // new lane's y is hard to compute here, but tasks are already in the
      // existing lanes so nonLaneChildIds would be empty anyway. (Guide 16-FU1.)
      const poolHadNoLanes = ownedIds.every((id) => this.props.elements[id]?.type !== BPMNElementType.BPMNSwimlane);

      const elements = clone(preview, this.state.previews);
      this.props.create(elements, resolvedOwner);
      if (nonLaneChildIds.length > 0 && poolHadNoLanes) {
        // The layout saga is async; lane.bounds still has the raw drop-position
        // origin. Pre-position the lane to its layout-correct values so the
        // append reducer converts task coordinates from the right origin.
        // Pool bounds are unchanged at this point (pool hasn't been re-rendered
        // yet). (Guide 16-FU1.)
        const poolBounds = this.props.elements[resolvedOwner].bounds;
        this.props.update(elements[0].id, {
          bounds: {
            x: BPMNPool.HEADER_WIDTH,
            y: 0,
            width: poolBounds.width - BPMNPool.HEADER_WIDTH,
            height: poolBounds.height,
          },
        });
        // Remove tasks from the pool's ownedElements before appending to the
        // lane. APPEND only adds to the new container — it never removes from
        // the old one — so without this step both pool and lane list the same
        // element IDs and each element is rendered twice. (Guide 16-FU2.)
        this.props.remove(nonLaneChildIds);
        // Move pool-level tasks/events into the new lane. The append reducer
        // re-positions them relative to the pre-positioned lane. (Guide 16.)
        this.props.append(nonLaneChildIds, elements[0].id);
      }
      return;
    }
    const elements = clone(preview, this.state.previews);
    const dropped = elements[0];

    // BPMNPool must live at root level; a pool's Droppable would otherwise capture
    // the event and set owner to the existing pool's id, nesting the new pool inside it.
    const effectiveOwner = preview.type === BPMNElementType.BPMNPool ? undefined : owner;

    // Elements are stored in parent-local coordinates. The drop position from
    // DraggableLayer is canvas-absolute, so we subtract the accumulated owner chain
    // offsets to get a localBounds comparable to sibling.bounds in the same space.
    const localBounds = { ...dropped.bounds };
    if (effectiveOwner) {
      let curId: string | null = effectiveOwner;
      let depth = 0;
      while (curId && this.props.elements[curId] && depth < 20) {
        const el = this.props.elements[curId];
        localBounds.x -= el.bounds.x;
        localBounds.y -= el.bounds.y;
        curId = el.owner;
        depth++;
      }
    }

    const GAP = 20;
    const MAX_ITERS = 50;
    const siblings = Object.values(this.props.elements).filter(
      (el) => (el.owner ?? null) === (effectiveOwner ?? null) && el.bounds.width > 0 && el.bounds.height > 0,
    );
    let iter = 0;
    while (iter < MAX_ITERS && siblings.some((sib) => boundsOverlap(localBounds, sib.bounds))) {
      localBounds.x += GAP;
      dropped.bounds.x += GAP;
      iter++;
    }

    // If the nudged position overflows the BPMN container, widen it to fit rather
    // than letting the element escape the pool/lane boundary.
    if (effectiveOwner) {
      const ownerEl = this.props.elements[effectiveOwner];
      if (ownerEl) {
        const PADDING = 10;
        const rightEdge = localBounds.x + dropped.bounds.width + PADDING;

        if (rightEdge > ownerEl.bounds.width) {
          const newOwnerWidth = rightEdge;

          if (ownerEl.type === BPMNElementType.BPMNSwimlane) {
            this.props.update(effectiveOwner, { bounds: { ...ownerEl.bounds, width: newOwnerWidth } });
            if (ownerEl.owner) {
              const poolEl = this.props.elements[ownerEl.owner];
              if (poolEl && poolEl.type === BPMNElementType.BPMNPool) {
                this.props.update(ownerEl.owner, {
                  bounds: { ...poolEl.bounds, width: newOwnerWidth + BPMNPool.HEADER_WIDTH },
                });
                const ownedIds =
                  'ownedElements' in poolEl ? (poolEl as { ownedElements: string[] }).ownedElements : [];
                for (const sibId of ownedIds) {
                  if (sibId !== effectiveOwner) {
                    const sibEl = this.props.elements[sibId];
                    if (sibEl && sibEl.type === BPMNElementType.BPMNSwimlane) {
                      this.props.update(sibId, { bounds: { ...sibEl.bounds, width: newOwnerWidth } });
                    }
                  }
                }
              }
            }
          } else if (ownerEl.type === BPMNElementType.BPMNPool) {
            this.props.update(effectiveOwner, { bounds: { ...ownerEl.bounds, width: newOwnerWidth } });
          }
        }
      }
    }

    this.props.create(elements, effectiveOwner);
  };
}

export const CreatePane = enhance(CreatePaneComponent);
