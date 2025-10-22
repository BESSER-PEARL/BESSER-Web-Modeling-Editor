import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';

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

const DateTimeInput = styled.input`
  flex-grow: 1;
  min-width: 60px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
  background: white;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
  
  &:hover:not(:focus) {
    border-color: #adb5bd;
  }
  
  /* Style the date/time picker icon */
  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
  }
  
  &::-webkit-calendar-picker-indicator:hover {
    background-color: #f8f9fa;
  }
`;

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  onChange: (id: string, values: { name?: string; fillColor?: string; textColor?: string; lineColor?: string }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UMLObjectAttributeUpdate = ({ id, onRefChange, value, onChange, onSubmitKeyUp, onDelete, element }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);

  const toggleColor = () => {
    setColorOpen(!colorOpen);
  };

  // Extract the type from the attribute name (e.g., "attribute: EX" -> "EX")
  const getAttributeType = (attributeName: string): string => {
    // Parse attribute name like "attribute: EX" to get the type "EX"
    const colonIndex = attributeName.lastIndexOf(':');
    if (colonIndex !== -1) {
      return attributeName.substring(colonIndex + 1).trim();
    }
    return '';
  };

  // Check if this attribute is of enumeration type
  const isEnumerationAttribute = () => {
    const { name: attributeName } = parseAttributeValue(value);
    
    if (!attributeName) {
      return false;
    }

    const attributeType = getAttributeType(attributeName);
    
    if (!attributeType) {
      return false;
    }

    const classDiagramData = diagramBridge.getClassDiagramData();
    
    if (!classDiagramData) {
      return false;
    }

    // Look for an enumeration with this name
    const enumeration = Object.values(classDiagramData.elements || {}).find(
      (element: any) => element.type === 'Enumeration' && element.name === attributeType
    );

    return !!enumeration;
  };

  // Check if this attribute is a date/time type
  const isDateTimeAttribute = () => {
    const { name: attributeName } = parseAttributeValue(value);
    
    if (!attributeName) {
      return { isDateTime: false, type: null };
    }

    const attributeType = getAttributeType(attributeName).toLowerCase();
    
    // Date types
    if (attributeType === 'date' || attributeType === 'localdate') {
      return { isDateTime: true, type: 'date' };
    } 
    // DateTime types
    else if (attributeType === 'datetime' || attributeType === 'timestamp' || 
             attributeType === 'localdatetime' || attributeType === 'offsetdatetime' || 
             attributeType === 'zoneddatetime' || attributeType === 'instant') {
      return { isDateTime: true, type: 'datetime-local' };
    } 
    // Time types
    else if (attributeType === 'time' || attributeType === 'localtime' || 
             attributeType === 'offsettime') {
      return { isDateTime: true, type: 'time' };
    } 
    // Duration/Period types
    else if (attributeType === 'timedelta' || attributeType === 'duration' || 
             attributeType === 'period' || attributeType === 'timespan') {
      return { isDateTime: true, type: 'duration' };
    }
    
    return { isDateTime: false, type: null };
  };

  // Get enumeration values for this attribute
  const getEnumerationValues = () => {
    const { name: attributeName } = parseAttributeValue(value);
    
    if (!attributeName) return [];

    const attributeType = getAttributeType(attributeName);
    if (!attributeType) return [];

    const classDiagramData = diagramBridge.getClassDiagramData();
    if (!classDiagramData) return [];

    // Look for an enumeration with this name
    const enumeration = Object.values(classDiagramData.elements || {}).find(
      (element: any) => element.type === 'Enumeration' && element.name === attributeType
    );

    if (!enumeration) return [];

    // Get all attributes (enum values) of the enumeration
    const enumAttributes = ((enumeration as any).attributes || [])
      .map((attrId: string) => classDiagramData.elements[attrId])
      .filter((attr: any) => attr && attr.name)
      .map((attr: any) => attr.name);

    return enumAttributes;
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

  // Format value for date/time inputs
  const formatDateTimeValue = (value: string, type: string) => {
    if (!value || value.trim() === '') return '';
    
    try {
      if (type === 'date') {
        // Try to parse various date formats
        let date: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          // Already in YYYY-MM-DD format
          date = new Date(value + 'T00:00:00');
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
          // MM/DD/YYYY format
          const [month, day, year] = value.split('/');
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
          // DD-MM-YYYY format
          const [day, month, year] = value.split('-');
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          date = new Date(value);
        }
        
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } else if (type === 'datetime-local') {
        // Try to parse various datetime formats
        let date: Date;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
          // Already in ISO format
          date = new Date(value);
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
          // YYYY-MM-DD HH:mm format
          date = new Date(value.replace(' ', 'T'));
        } else {
          date = new Date(value);
        }
        
        if (!isNaN(date.getTime())) {
          const isoString = date.toISOString();
          return isoString.slice(0, 16); // Remove seconds and timezone
        }
      } else if (type === 'time') {
        // Validate and format time
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
          const parts = value.split(':');
          const hours = parseInt(parts[0]).toString().padStart(2, '0');
          const minutes = parseInt(parts[1]).toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      }
    } catch (error) {
      console.warn('Error formatting date/time value:', error);
    }
    
    return value;
  };

  // Handle date/time input changes
  const handleDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    handleValueChange(newValue);
  };

  // Render duration input (for timedelta)
  const renderDurationInput = () => {
    return (
      <ValueTextfield 
        ref={onRefChange} 
        gutter 
        value={attributeValue} 
        onChange={handleValueChange} 
        onSubmitKeyUp={onSubmitKeyUp}
        placeholder="e.g., 1d 2h 30m, P1DT2H30M, 1:30:00"
        title="Enter duration in formats like: '1d 2h 30m', 'P1DT2H30M' (ISO 8601), or 'HH:mm:ss'"
      />
    );
  };

  // Check if this is an enumeration attribute
  const isEnum = isEnumerationAttribute();
  const enumValues = isEnum ? getEnumerationValues() : [];
  
  // Check if this is a date/time attribute
  const { isDateTime, type: dateTimeType } = isDateTimeAttribute();

  // If this is a formatted attribute with " = ", show split view (OBJECT DIAGRAM SPECIFIC)
  if (attributeName) {
    return (
      <>
        <Flex>
          <AttributeInputContainer>
            <AttributeNameLabel>{attributeName} = </AttributeNameLabel>
            {isEnum && enumValues.length > 0 ? (
              <Dropdown
                value={attributeValue}
                onChange={handleValueChange}
                placeholder=""
                size="sm"
              >
                {enumValues.map((enumValue: string) => (
                  <Dropdown.Item key={enumValue} value={enumValue}>
                    {enumValue}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isDateTime && dateTimeType ? (
              dateTimeType === 'duration' ? (
                renderDurationInput()
              ) : (
                <DateTimeInput
                  type={dateTimeType}
                  value={formatDateTimeValue(attributeValue, dateTimeType)}
                  onChange={handleDateTimeChange}
                  placeholder={dateTimeType === 'date' ? 'YYYY-MM-DD' : 
                              dateTimeType === 'datetime-local' ? 'YYYY-MM-DD HH:mm' : 
                              dateTimeType === 'time' ? 'HH:mm' : 'value'}
                />
              )
            ) : (
              <ValueTextfield 
                ref={onRefChange} 
                gutter 
                value={attributeValue} 
                onChange={handleValueChange} 
                onSubmitKeyUp={onSubmitKeyUp}
                placeholder="value"
              />
            )}
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
        <StylePane open={colorOpen} element={element} onColorChange={onChange} fillColor textColor />
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
      <StylePane open={colorOpen} element={element} onColorChange={onChange} fillColor textColor />
    </>
  );
};

export default UMLObjectAttributeUpdate;
