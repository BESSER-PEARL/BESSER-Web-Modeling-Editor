import React, { useState } from 'react';
import { Button, Col, FormControl, InputGroup, Modal, Nav, Row, Tab } from 'react-bootstrap';
import { Template, TemplateCategory } from './template-types';
import { SoftwarePatternType } from './software-pattern/software-pattern-types';
import { CreateFromSoftwarePatternModalTab } from './software-pattern/create-from-software-pattern-modal-tab';
import { TemplateFactory } from './template-factory';
import { ModalContentProps } from '../application-modal-types';
import { useAppDispatch } from '../../store/hooks';
import { createDiagram } from '../../../services/diagram/diagramSlice';
import { updateCurrentDiagramThunk, switchDiagramTypeThunk, updateQuantumDiagramThunk } from '../../../services/project/projectSlice';
import { SupportedDiagramType, QuantumCircuitData } from '../../../types/project';

export const CreateFromTemplateModal: React.FC<ModalContentProps> = ({ close }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(
    TemplateFactory.createSoftwarePattern(SoftwarePatternType.LIBRARY),
  );
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<TemplateCategory>(
    TemplateCategory.SOFTWARE_PATTERN,
  );

  const dispatch = useAppDispatch();

  const selectTemplateCategory = (templateCategory: TemplateCategory) => {
    setSelectedTemplateCategory(templateCategory);
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const createNewDiagram = async () => {
    // Check if this is a non-UML diagram (like Quantum)
    if (!selectedTemplate.isUMLDiagram) {
      // Handle non-UML diagrams (e.g., Quantum Circuit)
      if (selectedTemplate.diagramType === 'QuantumCircuitDiagram') {
        try {
          // Save the quantum template to the project
          await dispatch(updateQuantumDiagramThunk({ model: selectedTemplate.diagram as QuantumCircuitData }));
          console.log('Quantum template saved to project successfully');
          
          // Switch to the quantum diagram type
          await dispatch(switchDiagramTypeThunk({ diagramType: 'QuantumCircuitDiagram' as SupportedDiagramType }));
          console.log('Switched to QuantumCircuitDiagram');
        } catch (error) {
          console.error('Failed to load quantum template:', error);
        }
      }
      
      close();
      
      // Force a page reload to ensure the template is properly rendered
      setTimeout(() => {
        window.location.reload();
      }, 100);
      return;
    }

    // Handle UML diagrams (original logic)
    dispatch(
      createDiagram({
        title: selectedTemplate.type,
        diagramType: selectedTemplate.diagramType as any,
        template: selectedTemplate.diagram as any,
      }),
    );
    
    // Then ensure we're on the correct diagram type in the project
    try {
      await dispatch(switchDiagramTypeThunk({ diagramType: selectedTemplate.diagramType as SupportedDiagramType }));
      console.log('Switched to diagram type:', selectedTemplate.diagramType);
    } catch (error) {
      console.error('Failed to switch diagram type:', error);
    }
    
    // Finally, save the template to the project system
    if (selectedTemplate.diagram) {
      try {
        await dispatch(updateCurrentDiagramThunk({ model: selectedTemplate.diagram as any }));
        console.log('Template saved to project successfully');
      } catch (error) {
        console.error('Failed to save template to project:', error);
      }
    }
    
    close();
    
    // Force a page reload to ensure the template is properly rendered in the canvas
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Load Diagram Template</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tab.Container id="left-tabs-example" defaultActiveKey={selectedTemplateCategory}>
          <Row>
            {/* <Col sm={3} className="border-end border-secondary">
              <Nav variant="pills" className="flex-column">
                <Nav.Item>
                  <Nav.Link
                    className="text-nowrap"
                    eventKey={TemplateCategory.SOFTWARE_PATTERN}
                    onSelect={(templateCategory) =>
                      selectTemplateCategory(templateCategory as unknown as TemplateCategory)
                    }
                  >
                    {TemplateCategory.SOFTWARE_PATTERN}
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </Col> */}
            <Col sm={15}>
              {/* <label htmlFor="selected-template">Selected Template</label> */}
              {/* <InputGroup className="mb-3">
                <FormControl id="selected-template" value={selectedTemplate.type} disabled />
              </InputGroup> */}
              <Tab.Content>
                <Tab.Pane eventKey={TemplateCategory.SOFTWARE_PATTERN}>
                  <CreateFromSoftwarePatternModalTab
                    selectedTemplate={selectedTemplate}
                    selectTemplate={selectTemplate}
                  />
                </Tab.Pane>
              </Tab.Content>
            </Col>
          </Row>
        </Tab.Container>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="primary" onClick={createNewDiagram} disabled={!selectedTemplate}>
          Load Template
        </Button>
      </Modal.Footer>
    </>
  );
};
