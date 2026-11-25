import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { UMLObjectLink } from './uml-object-link';
import { ThemedPolyline } from '../../../components/theme/themedComponents';
import { ModelState } from '../../../components/store/model-state';
import { UserModelElementType } from '../../user-modeling';
import { isHiddenUserModelContainer } from '../../user-modeling/hidden-containers';

interface OwnProps {
  element: UMLObjectLink;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

/**
 * True when the given endpoint element is a user-model box for a hidden
 * grouping container (Competence/Accessibility). Such containers stay in the
 * transmitted model but are not drawn, so links touching them would otherwise
 * dangle to an invisible tile — suppress them here (rendering only; the
 * relationship itself is untouched in the model).
 */
const touchesHiddenContainer = (endpointId: string | undefined, elements: ModelState['elements']): boolean => {
  if (!endpointId) return false;
  const endpoint = elements[endpointId] as any;
  if (!endpoint || endpoint.type !== UserModelElementType.UserModelName) return false;
  return isHiddenUserModelContainer(endpoint.className);
};

const UMLObjectLinkComponentUnconnected: FunctionComponent<Props> = ({ element, elements }) => {
  if (
    touchesHiddenContainer(element.source?.element, elements) ||
    touchesHiddenContainer(element.target?.element, elements)
  ) {
    return null;
  }

  return (
    <g>
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={2}
      />
    </g>
  );
};

export const UMLObjectLinkComponent = connect<StateProps, {}, OwnProps, ModelState>((state) => ({
  elements: state.elements,
}))(UMLObjectLinkComponentUnconnected);
