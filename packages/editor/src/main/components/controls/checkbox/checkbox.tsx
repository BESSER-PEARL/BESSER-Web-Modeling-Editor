import React, { InputHTMLAttributes } from 'react';
import { styled } from '../../theme/styles';

const StyledCheckbox = styled.input`
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  accent-color: ${(props) => props.theme.color.primary};

  :disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'ref'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** Themed checkbox for popups; `onChange` receives the new checked state. */
export const Checkbox = ({ onChange, ...props }: Props) => (
  <StyledCheckbox {...props} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
);
