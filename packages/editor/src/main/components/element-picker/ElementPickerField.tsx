import React from 'react';
import { styled } from '../theme/styles';
import { Body } from '../controls/typography/typography';
import { Dropdown } from '../controls/dropdown/dropdown';
import { useElementPicker } from './ElementPickerContext';

const Row = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const PickerCell = styled.div`
  width: 100%;

  button {
    width: 100%;
    text-align: left;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
  margin: 0.25em 0 0 0;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.8em;
  padding: 0.1em 0.4em;
  border: 1px solid ${({ theme }) => theme.color.gray};
  border-radius: 0.4em;
`;

const ChipRemove = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  color: ${({ theme }) => theme.color.primary};
`;

/**
 * Multi-select cross-diagram element picker. Renders nothing when no
 * host provider is registered (e.g. the editor running standalone), so it
 * is safe to mount unconditionally inside any popup.
 */
export const ElementPickerField: React.FC<{
  label: string;
  /** Currently-selected target element ids. */
  selected: string[];
  /** Element type tokens to offer (e.g. ['Class','AbstractClass',...]). */
  typeTokens: string[];
  onChange: (ids: string[]) => void;
}> = ({ label, selected, typeTokens, onChange }) => {
  const picker = useElementPicker();
  if (!picker) return null;

  const candidates = picker.listElements(typeTokens);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const unselected = candidates.filter((c) => !selected.includes(c.id));

  const add = (id: string) => {
    if (id && !selected.includes(id)) onChange([...selected, id]);
  };
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  const labelFor = (id: string) => {
    const el = byId.get(id);
    if (!el) return `${id} (missing)`;
    return `${el.name?.trim() || '(unnamed)'} — ${el.diagramTitle}`;
  };

  return (
    <div>
      <Row>
        <Body style={{ width: '6em', flexShrink: 0, marginRight: '0.5em' }}>{label}</Body>
        <PickerCell>
          <Dropdown value="" onChange={add} placeholder="Add a target…">
            {unselected.map((c) => (
              <Dropdown.Item key={c.id} value={c.id}>
                {c.name?.trim() || '(unnamed)'} — {c.diagramTitle}
              </Dropdown.Item>
            ))}
          </Dropdown>
        </PickerCell>
      </Row>
      {selected.length > 0 && (
        <Chips>
          {selected.map((id) => (
            <Chip key={id}>
              {labelFor(id)}
              <ChipRemove type="button" title="Remove" onClick={() => remove(id)}>
                ×
              </ChipRemove>
            </Chip>
          ))}
        </Chips>
      )}
    </div>
  );
};
