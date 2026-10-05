import React from 'react';
import { styled } from '../../theme/styles';

const FloatingButtonContainer = styled.g.attrs((props) => ({
  ...props,
}))`
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
  pointer-events: all;
  outline: none;

  path {
    pointer-events: all;
    fill: var(--apollon-primary-contrast);
  }
  rect {
    pointer-events: all;
    fill: var(--apollon-background);
    stroke: var(--apollon-gray);
  }
  @media (hover: hover) {
    :hover rect {
      fill: var(--apollon-gray);
      stroke: var(--apollon-gray-variant);
    }
  }
  :active rect {
    fill: var(--apollon-gray);
    stroke: var(--apollon-gray-variant);
  }
  :focus-visible rect {
    stroke: var(--apollon-primary);
    stroke-width: 2px;
  }
`;

export interface FloatingButtonProps {
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode;
  onClick?: () => void;
  /** Accessible name of the action. */
  label?: string;
  /** Whether the button is shown; hidden buttons are kept out of the tab order. */
  active?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ children, label, active = true, onClick, ...props }) => {
  const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    // Keep the document-level canvas shortcuts from also handling this key.
    event.stopPropagation();
    onClick?.();
  };

  return (
    <FloatingButtonContainer
      {...props}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="button"
      aria-label={label}
      aria-hidden={!active}
      tabIndex={active ? 0 : -1}
    >
      <rect height={30} width={30} rx="0.25rem" ry="0.25rem" />
      {children}
    </FloatingButtonContainer>
  );
};
