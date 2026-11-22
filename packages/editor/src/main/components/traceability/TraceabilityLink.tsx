import React from 'react';
import { styled } from '../theme/styles';
import { Divider } from '../controls/divider/divider';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { useTraceability } from './TraceabilityContext';

/**
 * Drop-in popup footer: a "Show traceability" link for an element the host's trace knows. Safe to mount in
 * any popup: it renders nothing without a provider, or for an element with no trace.
 */
const LinkButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: ${({ theme }) => theme.color.primary};
  font-size: 0.85em;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
`;

const Wrapper = styled.div`
  margin-top: 0.5em;
`;

const TraceabilityLinkComponent: React.FC<{ elementId: string } & I18nContext> = ({ elementId, translate }) => {
  const traceability = useTraceability();
  if (!traceability || !traceability.hasTrace(elementId)) return null;
  return (
    <Wrapper>
      <Divider />
      <LinkButton type="button" onClick={() => traceability.onShowTrace(elementId)}>
        {translate('popup.showTraceability')} →
      </LinkButton>
    </Wrapper>
  );
};

export const TraceabilityLink = localized(TraceabilityLinkComponent);
