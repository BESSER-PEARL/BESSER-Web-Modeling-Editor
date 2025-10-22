import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';

// Define TextfieldValue type locally as it's not exported from textfield
type TextfieldValue = string | number;

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const AttributeInputContainer = styled.div`
  display: flex;
  align-items: center;
  flex-grow: 1;
  margin-right: 8px;
`;

const AttributeNameLabel = styled.span`
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  margin-right: 4px;
  white-space: nowrap;
`;

const ValueTextfield = styled(Textfield)`
  flex-grow: 1;
  min-width: 60px;
`;

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  onChange: (id: string, values: { name?: string; icon?: string; fillColor?: string; textColor?: string; lineColor?: string }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UMLObjectAttributeUpdate = ({ id, onRefChange, value, onChange, onSubmitKeyUp, onDelete, element }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);

  const toggleColor = () => {
    setColorOpen(!colorOpen);
  };

  // Method to get the attribute ID from the element
  const getAttributeId = () => {
    return (element as any).attributeId || '';
  };

  // Parse the attribute value to separate name and value parts for OBJECT DIAGRAM ONLY
  const parseAttributeValue = (fullValue: string) => {
    const equalIndex = fullValue.indexOf(' = ');
    if (equalIndex !== -1) {
      return {
        name: fullValue.substring(0, equalIndex),
        value: fullValue.substring(equalIndex + 3) // +3 for ' = '
      };
    }
    // If no " = " found, treat the whole thing as editable (fallback for non-formatted attributes)
    return {
      name: '',
      value: fullValue
    };
  };

  const { name: attributeName, value: attributeValue } = parseAttributeValue(value);

  const handleValueChange = (newValue: TextfieldValue) => {
    // Reconstruct the full attribute name with the format "attributeName = newValue" for OBJECT DIAGRAM
    if (attributeName) {
      const newFullName = `${attributeName} = ${newValue}`;
      onChange(id, { name: newFullName });
    } else {
      // Fallback for non-formatted attributes
      onChange(id, { name: String(newValue) });
    }
  };

  const handleDelete = () => {
    onDelete(id)();
  };
  // If this is a formatted attribute with " = ", show split view (OBJECT DIAGRAM SPECIFIC)
  if (attributeName) {
    return (
      <>
        <Flex>
          <AttributeInputContainer>
            <AttributeNameLabel>{attributeName} = </AttributeNameLabel>
            <ValueTextfield 
              ref={onRefChange} 
              gutter 
              value={attributeValue} 
              onChange={handleValueChange} 
              onSubmitKeyUp={onSubmitKeyUp}
              placeholder="value"
            />
          </AttributeInputContainer>
          <ColorButton onClick={toggleColor} />
          <Button color="link" tabIndex={-1} onClick={handleDelete}>
            <TrashIcon />
          </Button>
        </Flex>
        {/*{getAttributeId() && (
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
            Attribute ID: {getAttributeId()}
          </div>
        )}*/}
        <StylePane open={colorOpen} element={element} onColorChange={onChange} showIcon fillColor textColor />
      </>
    );
  }

  // Fallback for non-formatted attributes - show normal textfield
  return (
    <>
      <Flex>
        <Textfield ref={onRefChange} gutter value={value} onChange={(newName) => onChange(id, { name: newName })} onSubmitKeyUp={onSubmitKeyUp} />
        <ColorButton onClick={toggleColor} />
        <Button color="link" tabIndex={-1} onClick={handleDelete}>
          <TrashIcon />
        </Button>
      </Flex>
      <StylePane open={colorOpen} element={element} onColorChange={onChange} showIcon fillColor textColor />
    </>
  );
};

export default UMLObjectAttributeUpdate;
