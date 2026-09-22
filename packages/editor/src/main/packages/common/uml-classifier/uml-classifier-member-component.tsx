import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { Text } from '../../../components/controls/text/text';
import { UMLClassifierMember } from './uml-classifier-member';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { ModelState } from '../../../components/store/model-state';
import { ObjectElementType } from '../../uml-object-diagram';
import { UserModelElementType } from '../../user-modeling';
import { ClassElementType } from '../../uml-class-diagram';

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
  const isUserModelAttribute = element.type === UserModelElementType.UserModelAttribute;
  const isClassAttribute = element.type === ClassElementType.ClassAttribute;
  const isClassMethod = element.type === ClassElementType.ClassMethod;
  const shouldShowIconView = settingsService.shouldShowIconView();
  const notation = settingsService.getClassNotation();
  const isEREnabled = notation === 'ER';

  // Hide attributes and methods in icon view for object diagrams
  if ((isObjectAttribute || isObjectMethod || isUserModelAttribute) && shouldShowIconView) {
    return null;
  }

  // Hide methods entirely when rendering class diagrams in ER (Chen) mode:
  // ER notation has no concept of operations/methods on entities.
  if (isClassMethod && isEREnabled) {
    return null;
  }

  // Check if owner is enumeration
  const isEnumeration = owner && 'stereotype' in owner && (owner as any).stereotype === 'enumeration';

  // Build the label. ER class attributes get the ER-flavored display
  // (no visibility symbol, no {id} suffix) plus underline when isId is set;
  // ER has no visibility semantics and identifies PKs via underline.
  // The ER formatting itself lives on UMLClassifierMember.displayNameER so
  // it stays in sync with displayName if the shared fields evolve.
  let displayText: string;
  let underlineText = false;
  if (isEnumeration) {
    displayText = element.name;
  } else if (isEREnabled && isClassAttribute) {
    displayText = element.displayNameER;
    underlineText = !!element.isId;
  } else {
    displayText = element.displayName || element.name;
  }

  // Check if this is a string-type object attribute to add quotes
  const isStringAttribute = isObjectAttribute &&
    ((element as any).attributeType === 'str' || (element as any).attributeType === 'string');

  // For string attributes, wrap the value part with quotes
  let finalDisplayText = displayText;
  if (isStringAttribute) {
    // Parse "attributeName = value" format
    const equalIndex = displayText.indexOf(' = ');
    if (equalIndex !== -1) {
      const namePart = displayText.substring(0, equalIndex + 3); // Include " = "
      const valuePart = displayText.substring(equalIndex + 3);
      finalDisplayText = `${namePart}"${valuePart}"`;
    } else {
      finalDisplayText = `${displayText}""`;
    }
  }

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <Text
        x={10}
        fill={element.textColor}
        fontWeight="normal"
        textAnchor="start"
        textDecoration={underlineText ? 'underline' : undefined}
        data-testid={underlineText ? 'er-id-attribute' : undefined}
      >
        {finalDisplayText}
      </Text>
    </g>
  );
};

export const UMLClassifierMemberComponent = connect<StateProps, {}, OwnProps, ModelState>(
  (state) => ({
    elements: state.elements,
  })
)(UMLClassifierMemberComponentUnconnected);
