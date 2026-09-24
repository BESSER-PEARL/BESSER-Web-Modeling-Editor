import React, { FunctionComponent } from 'react';
import { I18nContext } from '../../components/i18n/i18n-context';
import { localized } from '../../components/i18n/localized';
import { NNSectionTitleComponent } from '../nn-diagram/nn-section-title-component';
import { AgentSectionTitle } from './agent-section-elements';

type Props = { element: AgentSectionTitle } & I18nContext;

/**
 * Palette section title of the agent diagram. Its `name` is an i18n key (the palette is composed
 * without a translate function), so it is translated here and drawn like the NN section titles.
 */
const AgentSectionTitleC: FunctionComponent<Props> = ({ element, translate }) => (
  <NNSectionTitleComponent element={{ bounds: element.bounds, name: translate(element.name) || element.name }} />
);

export const AgentSectionTitleComponent = localized(AgentSectionTitleC);
