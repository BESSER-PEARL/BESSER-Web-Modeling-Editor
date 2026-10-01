// Styled components of the agent transition property panel.
import { Button } from '../../../components/controls/button/button';
import { Header } from '../../../components/controls/typography/typography';
import { styled } from '../../../components/theme/styles';

export const Flex = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`;

export const Section = styled.section`
  padding: 8px 0;
`;

export const SectionHeader = styled(Header)`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
  margin-bottom: 4px;
`;

/* Predefined / Custom toggle — same style as state body type toggle */
export const TypeToggleRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
`;

export const TypeToggleBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid ${(props) => props.theme.color.gray}88;
  background: ${(props) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 12px;
  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

/* Option list buttons */
export const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 2px;
`;

export const OptionBtn = styled.button<{ active?: boolean }>`
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid ${(props) => (props.active ? props.theme.color.primary : props.theme.color.gray + '88')};
  background: ${(props) => (props.active ? props.theme.color.primary : props.theme.color.background)};
  color: ${(props) => (props.active ? '#fff' : props.theme.color.primary)};
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  font-weight: ${(props) => (props.active ? 600 : 400)};
  transition: opacity 0.1s;
  &:hover {
    opacity: 0.85;
  }
`;

export const OptionDesc = styled.p`
  font-size: 11px;
  opacity: 0.65;
  margin: 6px 0 4px 0;
  font-style: italic;
  line-height: 1.4;
`;

export const OptionSeparator = styled.hr`
  border: none;
  border-top: 1px solid ${(props) => props.theme.color.gray}44;
  margin: 10px 0 8px;
`;

export const ConditionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0 8px;

  & + & {
    border-top: 1px solid ${(props) => props.theme.color.gray}44;
    margin-top: 8px;
  }
`;

export const ConditionActions = styled.div`
  display: flex;
  gap: 4px;
`;

export const RemoveButton = styled(Button)`
  && {
    background-color: #dc3545;
    border-color: #dc3545;
    color: #fff;
  }
  &&:hover {
    background-color: #c82333;
    border-color: #bd2130;
  }
`;

export const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  min-height: 220px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
  }
`;
