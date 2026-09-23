import React from 'react';
import { styled } from '../theme/styles';
import { Divider } from '../controls/divider/divider';
import { Body } from '../controls/typography/typography';
import { useLineage } from './LineageContext';

/**
 * Drop-in popup footer rendered conditionally when the host's
 * lineage provider resolves a source element for `elementId`. Safe to
 * mount unconditionally inside any popup: it renders nothing for
 * elements that have no source (synthetic emissions, user-created
 * elements, popups in non-derived diagrams).
 */
const SourceButton = styled.button`
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

export const LineageSourceLink: React.FC<{ elementId: string }> = ({ elementId }) => {
  const lineage = useLineage();
  if (!lineage) return null;
  const resolved = lineage.resolveSource(elementId);
  if (!resolved) return null;

  // Prefer element-level label so the popup link
  // adds value beyond the diagram-level badge already shown in the tab
  // bar. Falls back to diagram-level wording if the host could not look
  // up the source element (e.g. provider populated only the diagram).
  const label = resolved.sourceElementType
    ? `← Source: ${resolved.sourceElementName?.trim() || '(unnamed)'} (${resolved.sourceElementType})`
    : `← Derived from ${resolved.sourceDiagramTitle} (${resolved.sourceDiagramType})`;

  return (
    <Wrapper>
      <Divider />
      <Body style={{ marginBottom: '0.25em' }}>Lineage</Body>
      <SourceButton type="button" onClick={() => lineage.onShowSource(resolved)}>
        {label}
      </SourceButton>
    </Wrapper>
  );
};
