import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { Text } from '../../../components/controls/text/text';
import { UMLClassifierMember } from './uml-classifier-member';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { ModelState } from '../../../components/store/model-state';
import { ObjectElementType } from '../../uml-object-diagram';

interface OwnProps {
  element: UMLClassifierMember;
  fillColor?: string;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

const UMLClassifierMemberComponentUnconnected: FunctionComponent<Props> = ({ element, fillColor, elements }) => {
  // Check if this element's owner is an object and if icon view is enabled
  const owner = element.owner ? elements[element.owner] : null;
  const isObjectAttribute = element.type === ObjectElementType.ObjectAttribute;
  const isObjectMethod = element.type === ObjectElementType.ObjectMethod;
  const shouldShowIconView = settingsService.shouldShowIconView();
  
  // Hide attributes and methods in icon view for object diagrams
  if ((isObjectAttribute || isObjectMethod) && shouldShowIconView) {
    return null;
  }

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start">
        {element.name}
      </Text>
    </g>
  );
};

export const UMLClassifierMemberComponent = connect<StateProps, {}, OwnProps, ModelState>(
  (state) => ({
    elements: state.elements,
  })
)(UMLClassifierMemberComponentUnconnected);
