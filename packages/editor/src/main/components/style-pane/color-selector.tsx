import React from 'react';
import { Button } from './style-pane-styles';
import styled from 'styled-components';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';

type Props = { color?: string; onColorChange: (hex: string | undefined) => void; open: boolean } & I18nContext;

const colors = [
  '#fc5c65',
  '#fd9644',
  '#fed330',
  '#26de81',
  '#2bcbba',
  '#45aaf2',
  '#4b7bec',
  '#6a89cc',
  '#a55eea',
  '#d1d8e0',
  '#778ca3',
  'black',
];

// Accessible names for the swatches, in the same order as `colors`.
const colorNames = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Teal',
  'Sky blue',
  'Blue',
  'Slate blue',
  'Purple',
  'Light gray',
  'Gray',
  'Black',
];

const ColorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: ${(props) => props.theme.color.background};
  width: 100%;
  padding-bottom: 10px;
`;

const Flex = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
`;

type ColorProps = {
  color?: string;
  selected?: boolean;
};

const Color = styled.button.attrs<ColorProps>({})<ColorProps>`
  height: 28px;
  width: 28px;
  background-color: ${({ color }: ColorProps) => color || 'black'};
  border-radius: 14px;
  cursor: pointer;
  border: none;
  position: relative;
  margin: 10px;
  box-shadow: ${({ color, selected }: ColorProps) => (selected ? `0px 0px 10px ${color}` : 'none')};
`;

function ColorSelectorComponent({ onColorChange, color, open, translate }: Props) {
  const handleColorChange = (newColor: any) => {
    onColorChange(newColor);
  };

  const reset = () => {
    onColorChange(undefined);
  };

  if (!open) return null;

  return (
    <>
      {open ? (
        <ColorContainer>
          <Flex>
            {colors.map((colorOption, index) => (
              <Color
                key={colorOption}
                color={colorOption}
                onClick={() => handleColorChange(colorOption)}
                selected={colorOption === color}
                aria-label={colorNames[index]}
                aria-pressed={colorOption === color}
              />
            ))}
          </Flex>
          <Button onClick={reset}>{translate('stylePane.reset')}</Button>
        </ColorContainer>
      ) : null}
    </>
  );
}

export const ColorSelector = localized(ColorSelectorComponent);
