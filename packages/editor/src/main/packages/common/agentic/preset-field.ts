import { styled } from '../../../components/theme/styles';

/** Makes the editor's content-sized Dropdown fill a popup row like a
 *  Textfield: the button stretches to 100 % and left-aligns its label. */
export const PresetField = styled.div`
  width: 100%;

  button {
    width: 100%;
    text-align: left;
  }
`;
