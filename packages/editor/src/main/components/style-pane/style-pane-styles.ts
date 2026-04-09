import styled from 'styled-components';

type Props = {
  color?: string;
  selected?: boolean;
};

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px 0;
  background-color: ${(props) => props.theme.color.background};
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 6px;
  overflow: hidden;
`;

export const Color = styled.button.attrs<Props>({})<Props>`
  height: 24px;
  width: 24px;
  background-color: ${({ color, selected }: Props) => (selected ? 'transparent' : color || 'black')};
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${(props) => props.theme.color.gray};
  position: relative;
  flex-shrink: 0;
  &:after,
  &:before {
    content: '';
    width: 2px;
    height: 100%;
    background: ${(props) => props.theme.color.primaryContrast};
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%) rotate(45deg);
    display: ${({ selected }: Props) => (selected ? 'block' : 'none')};
  }
  &:before {
    transform: translate(-50%) rotate(-45deg);
  }
`;

export const Row = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-size: 0.85em;
  font-weight: 600;
  background-color: ${(props) => props.theme.color.background};
  color: ${(props) => props.theme.color.primaryContrast};
`;

export const Divider = styled.div`
  width: 100%;
  background: ${(props) => props.theme.color.backgroundVariant};
  height: 1px;
`;

export const Button = styled.button`
  background: white;
  color: #212529;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0.375rem 0.75rem;
  margin: 0;
  margin-top: 0.75rem;
  line-height: 1.5;
  outline: none;
  align-self: center;
  cursor: pointer;
`;

export const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px 14px;
  background-color: ${(props) => props.theme.color.background};
  color: ${(props) => props.theme.color.primaryContrast};

  label {
    font-size: 0.85em;
    font-weight: 600;
    margin-bottom: 6px;
  }
`;

export const CheckboxRow = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-size: 0.85em;
  font-weight: 600;
  background-color: ${(props) => props.theme.color.background};
  color: ${(props) => props.theme.color.primaryContrast};
  cursor: pointer;

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: ${(props) => props.theme.color.primary};
  }
`;
