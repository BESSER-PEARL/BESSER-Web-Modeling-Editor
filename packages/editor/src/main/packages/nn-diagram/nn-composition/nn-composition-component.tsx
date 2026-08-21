import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { ThemedPathContrast, ThemedPolyline } from '../../../components/theme/themedComponents';
import { ModelState } from '../../../components/store/model-state';
import { NNElementType } from '../index';

const RhombusFilled = (id: string, color?: string) => (
  <marker
    id={id}
    viewBox="0 0 30 30"
    markerWidth="30"
    markerHeight="30"
    refX="30"
    refY="15"
    orient="auto"
    markerUnits="strokeWidth"
  >
    <ThemedPathContrast d="M0,15 L15,22 L30,15 L15,8 z" fillColor={color} />
  </marker>
);

interface OwnProps {
  element: UMLAssociation;
}

interface StateProps {
  sourceIsContainer: boolean;
}

type Props = OwnProps & StateProps;

const NNCompositionComponentBase: FunctionComponent<Props> = ({ element, sourceIsContainer }) => {
  const id = `marker-${element.id}`;
  // Reverse the path when NNContainer is the source so the diamond (markerEnd) is at NNContainer
  const path = sourceIsContainer ? [...element.path].reverse() : element.path;

  return (
    <g>
      {RhombusFilled(id, element.strokeColor)}
      <ThemedPolyline
        points={path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#${id})`}
      />
    </g>
  );
};

// Subscribe only to the source element's type (a boolean derived prop) rather
// than the entire ``state.elements`` map — otherwise every Redux mutation of
// any element triggers a re-render of every composition line on the canvas.
export const NNCompositionComponent = connect<StateProps, {}, OwnProps, ModelState>(
  (state, ownProps) => ({
    sourceIsContainer:
      state.elements[ownProps.element.source?.element]?.type === NNElementType.NNContainer,
  }),
)(NNCompositionComponentBase);
