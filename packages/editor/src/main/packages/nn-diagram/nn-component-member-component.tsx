import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { Text } from '../../components/controls/text/text';
import { UMLClassifierMember } from '../common/uml-classifier/uml-classifier-member';
import { ThemedRect } from '../../components/theme/themedComponents';
import { ModelState } from '../../components/store/model-state';

interface OwnProps {
  element: UMLClassifierMember;
  fillColor?: string;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

/**
 * Component for rendering NN component attributes (layers, tensorops, configuration) with smaller font size.
 * Uses fontSize="11px" to make NN boxes more compact.
 */
const NNComponentMemberComponentUnconnected: FunctionComponent<Props> = ({ element, fillColor, elements }) => {
  // Use displayName for formatting, fallback to name
  const displayText = element.displayName || element.name;

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start" fontSize="11px">
        {displayText}
      </Text>
    </g>
  );
};

export const NNComponentMemberComponent = connect<StateProps, {}, OwnProps, ModelState>(
  (state) => ({
    elements: state.elements,
  })
)(NNComponentMemberComponentUnconnected);
