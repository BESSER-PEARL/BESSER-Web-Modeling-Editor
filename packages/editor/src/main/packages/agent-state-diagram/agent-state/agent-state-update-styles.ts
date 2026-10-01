// Styled components shared by the agent state property panel (agent-state-update.tsx and its
// per-action editors).
import { Button } from '../../../components/controls/button/button';
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

export const SectionHeader = styled.span`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: block;
`;

export const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0;

  label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    cursor: pointer;
  }

  input[type='radio'] {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    accent-color: ${(props) => props.theme.color.primary};
    cursor: pointer;
  }
`;

export const DbFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;

  & + & {
    border-top: 1px solid ${(props) => props.theme.color.gray};
  }

  & > label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.55;
  }
`;

export const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  min-height: 150px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
  }
`;

export const LlmSelect = styled.select`
  width: 100%;
  height: 30px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: transparent;
  color: inherit;
`;

export const LlmFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
`;

/* Body-type toggle */
export const BodyTypeRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
`;

export const BodyTypeBtn = styled.button<{ active?: boolean }>`
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

/* Action card */
export const ActionCard = styled.div`
  border: 2px solid ${(props) => props.theme.color.gray};
  border-left: 4px solid ${(props) => props.theme.color.primary}99;
  border-radius: 8px;
  margin-bottom: 18px;
  background: ${(props) => props.theme.color.background};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.11);
  }
  &[data-drag-over='true'] {
    border-color: ${(props) => props.theme.color.primary};
    border-left-color: ${(props) => props.theme.color.primary};
    background: ${(props) => props.theme.color.primary}11;
    box-shadow: 0 2px 8px ${(props) => props.theme.color.primary}33;
  }
  &[data-dragging='true'] {
    opacity: 0.4;
  }
`;

export const ActionCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 8px;
  cursor: default;
  background: ${(props) => props.theme.color.backgroundVariant}55;
  border-radius: 7px 7px 0 0;
`;

export const DragHandle = styled.span`
  cursor: grab;
  opacity: 0.35;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    cursor: grabbing;
  }
`;

export const ActionTypeBadge = styled.span`
  font-size: 16px;
  text-transform: uppercase;
  background: ${(props) => props.theme.color.primaryContrast}11;
  color: ${(props) => props.theme.color.primaryContrast};
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  font-weight: 600;
  flex-shrink: 0;
`;

export const IconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.45;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 3px;
  transition: opacity 0.1s, background 0.1s;
  &:hover {
    opacity: 1;
    background: ${(props) => props.theme.color.gray}66;
  }
`;

export const ActionBody = styled.div`
  padding: 10px 12px 12px 12px;
  border-top: 1px solid ${(props) => props.theme.color.gray};
  background: ${(props) => props.theme.color.backgroundVariant}33;
  border-radius: 0 0 7px 7px;

  h1 {
    color: ${(props) => props.theme.color.primary};
  }
`;

export const ToggleLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 0;
`;

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 13px;
  cursor: pointer;

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    accent-color: ${(props) => props.theme.color.primary};
    cursor: pointer;
  }
`;

export const WsWarning = styled.p`
  font-size: 12px;
  margin: 4px 0;
  color: #e04040;
  opacity: 0.85;
`;

export const NewActionLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 18px;
  margin-bottom: 6px;
  padding-top: 14px;
  border-top: 2px solid ${(props) => props.theme.color.gray};
`;

export const VarHint = styled.p`
  font-size: 11px;
  opacity: 0.55;
  margin: 2px 0 4px 0;
  font-style: italic;
`;

export const PromptModeRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
`;

export const PromptModeBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid ${(props) => props.theme.color.gray};
  background: ${(props) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 12px;
  font-weight: ${(props) => (props.active ? 600 : 400)};
  &:hover:not(:disabled) { opacity: 0.85; }
`;

export const StoreInSessionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  background: ${(props) => props.theme.color.background};
`;

export const SectionTabRow = styled.div`
  display: flex;
  gap: 3px;
  margin-bottom: 6px;
`;

export const SectionTab = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid ${(props) => props.theme.color.gray}66;
  background: ${(props) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

export const NewActionOptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 2px;
`;

export const NewActionOptionBtn = styled.button<{ active?: boolean; dimmed?: boolean; warn?: boolean }>`
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: ${(props) =>
    props.dimmed
      ? 'none'
      : props.active
        ? `1px solid ${props.warn ? '#e04040' : props.theme.color.primary}`
        : `1px solid ${props.warn ? '#e0404055' : props.theme.color.gray + '88'}`};
  background: ${(props) =>
    props.active
      ? props.dimmed ? '#888888' : props.warn ? '#e04040' : props.theme.color.primary
      : props.theme.color.background};
  color: ${(props) =>
    props.active ? '#fff' : props.dimmed ? '#888888' : props.warn ? '#e04040' : props.theme.color.primary};
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  font-weight: ${(props) => (props.active ? 600 : 400)};
  transition: opacity 0.1s;
  &:hover {
    opacity: 0.85;
  }
`;

export const AddActionButton = styled(Button)`
  && {
    background-color: #28a745;
    border-color: #28a745;
    color: #fff;
  }
  &&:hover {
    background-color: #218838;
    border-color: #1e7e34;
  }
`;

export const ActionDesc = styled.p`
  font-size: 11px;
  opacity: 0.65;
  margin: 6px 0 4px 0;
  font-style: italic;
  line-height: 1.4;
`;
