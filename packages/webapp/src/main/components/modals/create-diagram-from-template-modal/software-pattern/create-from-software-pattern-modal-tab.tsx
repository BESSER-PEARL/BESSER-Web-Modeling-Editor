import React, { useState, useCallback } from 'react';
import { ListGroup, Tab, Tabs } from 'react-bootstrap';
import { Template} from '../template-types';
import { SoftwarePatternCategory, SoftwarePatternTemplate, SoftwarePatternType } from './software-pattern-types';
import { TemplateFactory } from '../template-factory';

type Props = {
  selectedTemplate: Template;
  selectTemplate: (template: Template) => void;
};

const patternTabComponentForCategory = (
  softwarePatternTemplates: SoftwarePatternTemplate[],
  category: SoftwarePatternCategory,
  selectedPattern: Template,
  selectPattern: (pattern: SoftwarePatternTemplate) => void,
) => {
  const categoryPatterns = softwarePatternTemplates.filter(
    (patternTemplate) => patternTemplate.softwarePatternCategory === category,
  );

  return (
    <Tab eventKey={category} title={category} tabClassName="ps-2 pe-2" className="mt-1">
      <ListGroup id="diagram-type-list">
        {categoryPatterns.map((softwarePattern) => (
          <ListGroup.Item
            key={softwarePattern.type}
            action
            onClick={() => selectPattern(softwarePattern)}
            active={selectedPattern?.type === softwarePattern.type}
          >
            {softwarePattern.type}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Tab>
  );
};

export const CreateFromSoftwarePatternModalTab: React.FC<Props> = ({ selectedTemplate, selectTemplate }) => {
  const [selectedPatternCategory, setSelectedPatternCategory] = useState<SoftwarePatternCategory>(
    SoftwarePatternCategory.STRUCTURAL,
  );

  const selectPattern = useCallback(
    (pattern: SoftwarePatternTemplate) => {
      selectTemplate(pattern);
    },
    [selectTemplate],
  );

  const allPatterns = Object.values(SoftwarePatternType).map((pattern) =>
    TemplateFactory.createSoftwarePattern(pattern),
  );

  const handleCategorySelect = (patternCategory: SoftwarePatternCategory | null) => {
    if (patternCategory) {
      setSelectedPatternCategory(patternCategory);
    }
  };
  return (
    <Tabs
      className="flex-row"
      activeKey={selectedPatternCategory}
      onSelect={(patternCategory) => handleCategorySelect(patternCategory as SoftwarePatternCategory)}
    >
      {patternTabComponentForCategory(allPatterns, SoftwarePatternCategory.STRUCTURAL, selectedTemplate, selectPattern)}
      {/* {patternTabComponentForCategory(allPatterns, SoftwarePatternCategory.BEHAVIORAL, selectedTemplate, selectPattern)}
      {patternTabComponentForCategory(allPatterns, SoftwarePatternCategory.CREATIONAL, selectedTemplate, selectPattern)} */}
      {patternTabComponentForCategory(allPatterns, SoftwarePatternCategory.STATE_MACHINE, selectedTemplate, selectPattern)}
      {patternTabComponentForCategory(allPatterns, SoftwarePatternCategory.AGENT, selectedTemplate, selectPattern)}
    </Tabs>
  );
};
