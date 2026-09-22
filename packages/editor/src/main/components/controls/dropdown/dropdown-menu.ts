import { styled } from '../../theme/styles';

export const DropdownMenu = styled.div`
  background-clip: padding-box;
  background-color: ${(props) => props.theme.color.background};
  border: 1px solid ${(props) => props.theme.color.graylight};
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  list-style: none;
  margin: 2px 0 0;
  padding: 4px 0;
  position: fixed;
  text-align: left;
  z-index: 9999;
  max-height: 240px;
  overflow-y: auto;
`;
