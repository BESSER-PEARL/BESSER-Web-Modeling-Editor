import React, { Component, ComponentClass, SVGProps } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Components } from '../../packages/components';
import { UMLElementType } from '../../packages/uml-element-type';
import { NNElementType } from '../../packages/nn-diagram';
import { ApollonView } from '../../services/editor/editor-types';
import { UMLContainer } from '../../services/uml-container/uml-container';
import { IUMLElement } from '../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { ModelState } from '../store/model-state';
import { withTheme, withThemeProps } from '../theme/styles';
import { UMLElementComponentProps } from './uml-element-component-props';
import { UMLElementSelectorType } from '../../packages/uml-element-selector-type';

const STROKE = 5;
const SELECTED_STROKE = 2;

type OwnProps = { child?: ComponentClass<UMLElementComponentProps> } & UMLElementComponentProps &
  SVGProps<SVGSVGElement>;

type StateProps = {
  hovered: boolean;
  selected: boolean;
  remoteSelectors: UMLElementSelectorType[];
  moving: boolean;
  interactive: boolean;
  interactable: boolean;
  element: IUMLElement | undefined;
  zoomFactor: number;
  selectionBoxActive: boolean;
  /** Ids of the owned elements to render (existing ones; NN layers only their mandatory attributes). */
  childIds: string[];
};

type DispatchProps = {};

type Props = OwnProps & StateProps & DispatchProps & withThemeProps;

const NO_IDS: string[] = [];
const NO_SELECTORS: UMLElementSelectorType[] = [];

const visibleChildIds = (element: IUMLElement | undefined, elements: ModelState['elements']): string[] => {
  if (!element || !UMLContainer.isUMLContainer(element)) return NO_IDS;
  // For NN layers only, hide optional attributes from the canvas (they persist in state).
  const isNNParent = (element.type as string) in NNElementType;
  return element.ownedElements.filter((id) => {
    const child = elements[id];
    if (!child) return false;
    if (isNNParent && 'isMandatory' in child) {
      return (child as { isMandatory?: boolean }).isMandatory === true;
    }
    return true;
  });
};

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

// Per-instance selector: the child-id list keeps its identity while unchanged, so moving
// one element (a new `state.elements` object) doesn't re-render every other element.
const makeMapState = () => {
  let lastChildIds: string[] = NO_IDS;
  return (state: ModelState, props: OwnProps): StateProps => {
    const element = state.elements[props.id];
    const childIds = visibleChildIds(element, state.elements);
    if (!sameIds(childIds, lastChildIds)) lastChildIds = childIds;
    return {
      hovered: state.hovered[0] === props.id,
      selected: state.selected.includes(props.id),
      remoteSelectors: state.remoteSelection[props.id] || NO_SELECTORS,
      moving: state.moving.includes(props.id),
      interactive: state.interactive.includes(props.id),
      interactable: state.editor.view === ApollonView.Exporting || state.editor.view === ApollonView.Highlight,
      element,
      zoomFactor: state.editor.zoomFactor,
      selectionBoxActive: state.editor.selectionBoxActive,
      childIds: lastChildIds,
    };
  };
};

const enhance = compose<ComponentClass<OwnProps>>(
  withTheme,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(makeMapState, {}),
);

class CanvasElementComponent extends Component<Props> {
  render() {
    const {
      hovered,
      selected,
      remoteSelectors,
      moving,
      interactive,
      interactable,
      element,
      child: ChildComponent,
      children,
      theme,
      zoomFactor: _zoomFactor,
      selectionBoxActive: _selectionBoxActive,
      childIds,
      id: _id,
      type: _type,
      name: _name,
      ...props
    } = this.props;

    // Guard against undefined elements
    if (!element) {
      return null;
    }

    let elements = null;
    if (UMLContainer.isUMLContainer(element) && ChildComponent) {
      elements = childIds.map((id) => <ChildComponent key={id} id={id} />);
    }
    const ElementComponent = Components[element.type as UMLElementType];

    const highlight =
      interactable && interactive
        ? theme.interactive.normal
        : interactable && hovered
          ? theme.interactive.hovered
          : element.highlight
            ? element.highlight
            : element.fillColor
              ? element.fillColor
              : theme.color.background;

    return (
      <svg
        {...props}
        {...element.bounds}
        overflow="visible"
        pointerEvents={moving ? 'none' : undefined}
        fillOpacity={moving ? 0.7 : undefined}
        fill={highlight}
      >
        <ElementComponent fillColor={highlight} element={UMLElementRepository.get(element)}>
          {elements}
        </ElementComponent>
        {children}
        {!interactable && selected && (
          <rect
            x={-SELECTED_STROKE / 2}
            y={-SELECTED_STROKE / 2}
            width={element.bounds.width + SELECTED_STROKE}
            height={element.bounds.height + SELECTED_STROKE}
            fill="none"
            style={{ stroke: theme.color.primary }}
            strokeWidth={SELECTED_STROKE}
            pointerEvents="none"
          />
        )}
        {!interactable && hovered && !selected && (
          <rect
            x={-STROKE / 2}
            y={-STROKE / 2}
            width={element.bounds.width + STROKE}
            height={element.bounds.height + STROKE}
            fill="none"
            style={{ stroke: `color-mix(in srgb, ${theme.color.primary} 25%, transparent)` }}
            strokeWidth={STROKE}
            pointerEvents="none"
          />
        )}
        {remoteSelectors.length > 0 && (
          <g>
            {remoteSelectors.map((selectedBy, index) => {
              const indicatorPosition = 'translate(' + (element.bounds.width + STROKE) + ' ' + index * 32 + ')';
              return (
                <g key={selectedBy.name + '_' + selectedBy.color} id={selectedBy.name + '_' + selectedBy.color}>
                  <rect
                    x={-STROKE / 2}
                    y={-STROKE / 2}
                    width={element.bounds.width + STROKE}
                    height={element.bounds.height + STROKE}
                    fill="none"
                    stroke={selectedBy.color}
                    strokeOpacity="0.2"
                    strokeWidth={STROKE}
                    pointerEvents="none"
                  />

                  <g transform={indicatorPosition} pointerEvents="none">
                    <rect
                      fillOpacity="0.2"
                      rx="10"
                      x="-40"
                      y="-20"
                      width="85px"
                      height="30px"
                      fill={selectedBy.color}
                    />
                    <text>
                      <tspan textAnchor="middle">
                        {selectedBy.name.length < 8 ? selectedBy.name : selectedBy.name.substring(0, 6) + '..'}
                      </tspan>
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    );
  }
}

export const CanvasElement = enhance(CanvasElementComponent);
