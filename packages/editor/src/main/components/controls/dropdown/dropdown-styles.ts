import { css, styled } from '../../theme/styles';
import { Button } from '../button/button';

// With $fitWidestOption, the button and the hidden sizer share one grid cell, so
// the dropdown is as wide as its widest option (like a native <select>) instead
// of resizing with the selected value. In a full-width parent it still fills it.
export const StyledDropdown = styled.div<{ $fitWidestOption: boolean }>`
  ${(props) =>
    props.$fitWidestOption &&
    css`
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      max-width: 100%;

      > * {
        grid-area: 1 / 1;
        min-width: 0;
      }
    `}
`;

export const DropdownSizer = styled.div`
  display: grid;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  visibility: hidden;

  > * {
    grid-area: 1 / 1;
    white-space: nowrap;
  }
`;

export type DropdownItemProps = {};

export const StyledDropdownItem = styled(Button).attrs<DropdownItemProps>({
  block: true,
  color: 'link',
})<DropdownItemProps>`
  color: ${(props) => props.theme.font.color};
  padding-right: 1.5em;
  padding-left: 1.5em;
  text-align: left;

  &[aria-selected='true'] {
    font-weight: 600;
  }

  :hover {
    text-decoration: none;
    background-color: ${(props) => props.theme.color.gray};
  }
`;
