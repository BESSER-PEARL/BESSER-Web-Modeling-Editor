import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
`;

const AttributeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const VisibilityDropdown = styled(Dropdown)`
  min-width: 80px;
  flex-shrink: 0;
`;

const TypeDropdown = styled(Dropdown)`
  min-width: 100px;
  flex-shrink: 0;
`;

const NameField = styled(Textfield)`
  flex: 1;
  min-width: 0;
`;

const PRIMITIVE_TYPES = [
  { value: 'str', label: 'str (string)' },
  { value: 'int', label: 'int (integer)' },
  { value: 'float', label: 'float (double)' },
  { value: 'bool', label: 'bool (boolean)' },
  { value: 'date', label: 'date' },
  { value: 'datetime', label: 'datetime' },
  { value: 'time', label: 'time' },
  { value: 'timedelta', label: 'timedelta' },
  { value: 'any', label: 'any' },
];

const VISIBILITY_OPTIONS = [
  { symbol: '+', value: 'public', label: '+' },
  { symbol: '-', value: 'private', label: '-' },
  { symbol: '#', value: 'protected', label: '#' },
  { symbol: '~', value: 'package', label: '~' },
];

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  onChange: (id: string, values: { name?: string; fillColor?: string; textColor?: string; lineColor?: string }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
  isEnumeration?: boolean;
  availableEnumerations?: Array<{ value: string; label: string }>;
};

const UmlAttributeUpdate = ({ id, onRefChange, value, onChange, onSubmitKeyUp, onDelete, element, isEnumeration = false, availableEnumerations = [] }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);

  const toggleColor = () => {
    setColorOpen(!colorOpen);
  };

  // For enumerations, just use the value as-is (it's a literal name)
  if (isEnumeration) {
    const handleNameChange = (newName: string | number) => {
      const nameStr = String(newName);
      onChange(id, { name: nameStr });
    };

    const handleDelete = () => {
      onDelete(id)();
    };

    return (
      <AttributeRow>
        <ControlsRow>
          <NameField 
            ref={onRefChange} 
            value={value} 
            onChange={handleNameChange} 
            onSubmitKeyUp={onSubmitKeyUp}
            placeholder="literal name"
          />
          <ColorButton onClick={toggleColor} />
          <Button color="link" tabIndex={-1} onClick={handleDelete}>
            <TrashIcon />
          </Button>
        </ControlsRow>
        <StylePane open={colorOpen} element={element} onColorChange={onChange} fillColor textColor />
      </AttributeRow>
    );
  }

  // Parse the attribute string: visibility name: type
  const parseAttribute = (attrString: string) => {
    const trimmed = attrString.trim();
    let visibility = '+'; // default
    let name = '';
    let type = 'str'; // default
    
    // Check for visibility symbol at the start
    const visibilityMatch = trimmed.match(/^([+\-#~])\s*/);
    if (visibilityMatch) {
      visibility = visibilityMatch[1];
      const afterVisibility = trimmed.substring(visibilityMatch[0].length);
      
      // Check for type (after colon)
      const typeMatch = afterVisibility.match(/^([^:]+):\s*(.+)$/);
      if (typeMatch) {
        name = typeMatch[1].trim();
        type = typeMatch[2].trim();
      } else {
        name = afterVisibility.trim();
      }
    } else {
      // No visibility symbol, check for type
      const typeMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (typeMatch) {
        name = typeMatch[1].trim();
        type = typeMatch[2].trim();
      } else {
        name = trimmed;
      }
    }
    
    return { visibility, name, type };
  };

  // Get available enumerations from the model
  const getEnumerations = () => {
    return availableEnumerations;
  };

  const { visibility, name, type } = parseAttribute(value);
  const enumerations = getEnumerations();
  const allTypes = [...PRIMITIVE_TYPES, ...enumerations];

  const handleVisibilityChange = (newVisibility: unknown) => {
    const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === newVisibility)?.symbol || '+';
    const newValue = `${visSymbol} ${name}: ${type}`;
    onChange(id, { name: newValue });
  };

  const handleNameChange = (newName: string | number) => {
    const nameStr = String(newName);
    const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === visibility)?.symbol || visibility;
    const newValue = `${visSymbol} ${nameStr}: ${type}`;
    onChange(id, { name: newValue });
  };

  const handleTypeChange = (newType: unknown) => {
    const typeStr = String(newType);
    const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === visibility)?.symbol || visibility;
    const newValue = `${visSymbol} ${name}: ${typeStr}`;
    onChange(id, { name: newValue });
  };

  const handleDelete = () => {
    onDelete(id)();
  };

  const visibilityValue = VISIBILITY_OPTIONS.find(v => v.symbol === visibility)?.value || 'public';

  return (
    <AttributeRow>
      <ControlsRow>
        <VisibilityDropdown value={visibilityValue} onChange={handleVisibilityChange}>
          {VISIBILITY_OPTIONS.map(vis => (
            <Dropdown.Item key={vis.value} value={vis.value}>
              {vis.label}
            </Dropdown.Item>
          ))}
        </VisibilityDropdown>
        <NameField 
          ref={onRefChange} 
          value={name} 
          onChange={handleNameChange} 
          onSubmitKeyUp={onSubmitKeyUp}
          placeholder="attribute name"
        />
        <TypeDropdown value={type} onChange={handleTypeChange}>
          {allTypes.map(t => (
            <Dropdown.Item key={t.value} value={t.value}>
              {t.label}
            </Dropdown.Item>
          ))}
        </TypeDropdown>
        <ColorButton onClick={toggleColor} />
        <Button color="link" tabIndex={-1} onClick={handleDelete}>
          <TrashIcon />
        </Button>
      </ControlsRow>
      <StylePane open={colorOpen} element={element} onColorChange={onChange} fillColor textColor />
    </AttributeRow>
  );
};

export default UmlAttributeUpdate;
