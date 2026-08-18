import React, { FunctionComponent } from 'react';
import { UMLStateFinalNode } from './uml-state-final-node';
import { ThemedCircle } from '../../../components/theme/themedComponents';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';

const UMLStateFinalNodeC: FunctionComponent<Props> = ({ element, translate }) => (
  <g>
    <title>{translate('packages.StateDiagram.StateFinalNode')}</title>
    <ThemedCircle
      cx="50%"
      cy="50%"
      r="45%"
      strokeColor={element.strokeColor}
      fillColor={element.fillColor}
    />
    <ThemedCircle
      cx="50%"
      cy="50%"
      r="35%"
      strokeColor={element.strokeColor}
      fillColor={element.strokeColor}
    />
  </g>
);

interface Props extends I18nContext {
  element: UMLStateFinalNode;
}

export const UMLStateFinalNodeComponent = localized(UMLStateFinalNodeC);
