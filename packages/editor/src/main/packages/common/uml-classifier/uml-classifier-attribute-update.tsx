import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { Visibility } from './uml-classifier-member';

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

// Type alias mapping for normalizing types from various sources (agent responses, imports, etc.)
const TYPE_ALIASES: Record<string, string> = {
  // String variants
  'string': 'str',
  'String': 'str',
  'STRING': 'str',
  // Integer variants
  'integer': 'int',
  'Integer': 'int',
  'INTEGER': 'int',
  'long': 'int',
  'Long': 'int',
  // Float/Double variants
  'double': 'float',
  'Double': 'float',
  'DOUBLE': 'float',
  'Float': 'float',
  'FLOAT': 'float',
  'number': 'float',
  'Number': 'float',
  'decimal': 'float',
  'Decimal': 'float',
  // Boolean variants
  'boolean': 'bool',
  'Boolean': 'bool',
  'BOOLEAN': 'bool',
  // Date variants
  'Date': 'date',
  'DATE': 'date',
  // DateTime variants
  'DateTime': 'datetime',
  'DATETIME': 'datetime',
  'Timestamp': 'datetime',
  'timestamp': 'datetime',
  // Time variants
  'Time': 'time',
  'TIME': 'time',
  // Any variants
  'object': 'any',
  'Object': 'any',
  'void': 'any',
  'Void': 'any',
};

// Normalize a type string to the canonical Python-style type
const normalizeType = (type: string): string => {
  if (!type) return 'str';
  const trimmed = type.trim();
  return TYPE_ALIASES[trimmed] || trimmed;
};

const VISIBILITY_OPTIONS: { symbol: string; value: Visibility; label: string }[] = [
  { symbol: '+', value: 'public', label: '+' },
  { symbol: '-', value: 'private', label: '-' },
  { symbol: '#', value: 'protected', label: '#' },
  { symbol: '~', value: 'package', label: '~' },
];

type AttributeValues = {
  name?: string;
  visibility?: Visibility;
  attributeType?: string;
  fillColor?: string;
  textColor?: string;
  lineColor?: string;
};

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  visibility?: Visibility;
  attributeType?: string;
  onChange: (id: string, values: AttributeValues) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
  isEnumeration?: boolean;
  availableEnumerations?: Array<{ value: string; label: string }>;
};

// Helper function to parse legacy name format for backward compatibility
const parseLegacyName = (nameValue: string): { visibility: Visibility; name: string; attributeType: string } => {
  const trimmed = nameValue.trim();
  let visibility: Visibility = 'public';
  let parsedName = '';
  let attributeType = 'str';

  const visibilityMatch = trimmed.match(/^([+\-#~])\s*/);
  if (visibilityMatch) {
    const symbolToVis: Record<string, Visibility> = { '+': 'public', '-': 'private', '#': 'protected', '~': 'package' };
    visibility = symbolToVis[visibilityMatch[1]] || 'public';
    const afterVisibility = trimmed.substring(visibilityMatch[0].length);

    const typeMatch = afterVisibility.match(/^([^:]+):\s*(.+)$/);
    if (typeMatch) {
      parsedName = typeMatch[1].trim();
      attributeType = normalizeType(typeMatch[2].trim());
    } else {
      parsedName = afterVisibility.trim();
    }
  } else {
    const typeMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (typeMatch) {
      parsedName = typeMatch[1].trim();
      attributeType = normalizeType(typeMatch[2].trim());
    } else {
      parsedName = trimmed;
    }
  }

  return { visibility, name: parsedName, attributeType };
};

const UmlAttributeUpdate = ({
  id,
  onRefChange,
  value,
  visibility: propVisibility,
  attributeType: propAttributeType,
  onChange,
  onSubmitKeyUp,
  onDelete,
  element,
  isEnumeration = false,
  availableEnumerations = []
}: Props) => {
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

  // Determine values: use separate properties if available, otherwise parse from value (backward compatibility)
  let visibility: Visibility;
  let attrName: string;
  let attributeType: string;

  if (propVisibility !== undefined && propAttributeType !== undefined) {
    // New format - use separate properties, value is the actual name
    visibility = propVisibility;
    attrName = value;
    attributeType = propAttributeType;
  } else {
    // Legacy format - parse from value
    const parsed = parseLegacyName(value);
    visibility = parsed.visibility;
    attrName = parsed.name;
    attributeType = parsed.attributeType;
  }

  // Get available enumerations from the model
  const enumerations = availableEnumerations;
  const allTypes = [...PRIMITIVE_TYPES, ...enumerations];

  const handleVisibilityChange = (newVisibility: unknown) => {
    const vis = newVisibility as Visibility;
    onChange(id, { 
      name: attrName,
      visibility: vis,
      attributeType
    });
  };

  const handleNameChange = (newName: string | number) => {
    const nameStr = String(newName);
    onChange(id, { 
      name: nameStr,
      visibility,
      attributeType
    });
  };

  const handleTypeChange = (newType: unknown) => {
    const typeStr = String(newType);
    onChange(id, { 
      name: attrName,
      visibility,
      attributeType: typeStr
    });
  };

  const handleDelete = () => {
    onDelete(id)();
  };

  return (
    <AttributeRow>
      <ControlsRow>
        <VisibilityDropdown value={visibility} onChange={handleVisibilityChange}>
          {VISIBILITY_OPTIONS.map(vis => (
            <Dropdown.Item key={vis.value} value={vis.value}>
              {vis.label}
            </Dropdown.Item>
          ))}
        </VisibilityDropdown>
        <NameField 
          ref={onRefChange} 
          value={attrName} 
          onChange={handleNameChange} 
          onSubmitKeyUp={onSubmitKeyUp}
          placeholder="attribute name"
        />
        <TypeDropdown value={attributeType} onChange={handleTypeChange}>
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
};;

export default UmlAttributeUpdate;
