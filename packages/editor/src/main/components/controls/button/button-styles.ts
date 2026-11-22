import { css, styled } from '../../theme/styles';
import { defaultProps } from './button';

const HOVER_BACKGROUND_DARKEN = 7.5;
const HOVER_BORDER_DARKEN = 10;
const ACTIVE_BACKGROUND_DARKEN = 10;
const ACTIVE_BORDER_DARKEN = 12.5;

// Theme colours are CSS variables, so mix in the browser rather than parsing hex.
const shade = (color: string, percent: number): string => `color-mix(in srgb, ${color} ${100 - percent}%, black)`;

const Button = styled.button`
  appearance: button;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 0.25em;
  font-family: inherit;
  font-size: 1em;
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  overflow: visible;
  padding: 0.375em 0.75em;
  text-transform: none;
  transition:
    color 0.15s ease-out,
    background-color 0.15s ease-out,
    border-color 0.15s ease-out,
    box-shadow 0.15s ease-out,
    transform 0.1s ease-out;
  user-select: none;

  svg {
    pointer-events: none;
  }

  ::-moz-focus-inner {
    border-style: none;
    padding: 0;
  }

  :focus {
    outline: 0;
  }

  :not(:disabled) {
    cursor: pointer;
  }

  :active:not(:disabled) {
    transform: scale(0.97);
  }
`;

const buttonCustomProps = ['block', 'outline'];
export const StyledButton = styled(Button).withConfig({ shouldForwardProp: (prop: string) => !buttonCustomProps.includes(prop) } as any)<typeof defaultProps>((props) => {
  const color = props.color !== 'link' ? props.theme.color[props.color] : props.theme.color.primary;

  return css`
    ${props.block &&
    css`
      display: block;
      width: 100%;
    `}

    ${props.disabled &&
    css`
      opacity: 0.65;
    `}

    ${props.size === 'sm' &&
    css`
      border-radius: 0.2em;
      font-size: 0.875em;
      padding: 0.25em 0.5em;
    `}

    ${props.size === 'lg' &&
    css`
      border-radius: 0.3em;
      font-size: 1.25em;
      padding: 0.5em 1em;
    `}

    ${props.color === 'link' &&
    css`
      color: ${props.theme.color.primary};
      text-decoration: none;
      fill: ${props.theme.color.primaryContrast};
    `}

    :focus-visible {
      outline: 2px solid ${color};
      outline-offset: 2px;
    }

    ${props.color !== 'link' &&
    !props.outline &&
    css`
      background-color: ${color};
      border-color: ${color};
      color: ${props.theme.color.background};

      :hover {
        background-color: ${shade(color, HOVER_BACKGROUND_DARKEN)};
        border-color: ${shade(color, HOVER_BORDER_DARKEN)};
      }

      :active {
        background-color: ${shade(color, ACTIVE_BACKGROUND_DARKEN)};
        border-color: ${shade(color, ACTIVE_BORDER_DARKEN)};
      }
    `}

    ${props.color !== 'link' &&
    props.outline &&
    css`
      border-color: ${color};
      color: ${color};

      :hover {
        background-color: ${color};
        color: ${props.theme.color.background};
      }
    `}
  `;
});
