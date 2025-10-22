// import React from 'react';
// import { NavDropdown } from 'react-bootstrap';
// import { UMLDiagramType, diagramBridge} from '@besser/wme';
// import { useAppDispatch, useAppSelector } from '../../../store/hooks';
// import { 
//   changeDiagramType, 
//   setCreateNewEditor,
//   loadDiagram,
//   createDiagram 
// } from '../../../services/diagram/diagramSlice';
// import { LocalStorageRepository } from '../../../services/local-storage/local-storage-repository';

// const formatDiagramType = (type: string): string => {
//   return type.replace(/([A-Z])/g, ' $1').trim();
// };

// // Define allowed diagram types
// const ALLOWED_DIAGRAM_TYPES = [
//   UMLDiagramType.ClassDiagram,
//   UMLDiagramType.ObjectDiagram,
//   UMLDiagramType.StateMachineDiagram,
//   UMLDiagramType.AgentDiagram,
// ];

// export const DiagramTypeSelector: React.FC = () => {
//   const dispatch = useAppDispatch();
//   const currentType = useAppSelector((state) => state.diagram.editorOptions.type);
//   const currentDiagram = useAppSelector((state) => state.diagram.diagram);
//   const handleTypeChange = (type: UMLDiagramType) => {
//     if (type !== currentType) {
//       // Save current diagram state with its type
//       if (currentDiagram && currentDiagram.model) {
//         LocalStorageRepository.storeDiagramByType(currentType, currentDiagram);
        
//         // Object Diagram Bridge Service to line 52
//         // If we're switching FROM a class diagram, update the bridge service
//         if (currentType === UMLDiagramType.ClassDiagram) {
//           diagramBridge.setClassDiagramData(currentDiagram.model);
//         }
//       }

//       // If we're switching TO an object diagram, ensure bridge has class data
//       if (type === UMLDiagramType.ObjectDiagram) {
//         // Try to get the latest class diagram data if bridge doesn't have it
//         if (!diagramBridge.hasClassDiagramData()) {
//           const classDiagram = LocalStorageRepository.loadDiagramByType(UMLDiagramType.ClassDiagram);
//           if (classDiagram && classDiagram.model) {
//             diagramBridge.setClassDiagramData(classDiagram.model);
//           }
//         }
//       }

//       // Load previously saved diagram of selected type
//       const savedDiagram = LocalStorageRepository.loadDiagramByType(type);
      
//       if (savedDiagram) {
//         dispatch(loadDiagram(savedDiagram));
//       } else {
//         // If no saved diagram exists for this type, create a new one
//         dispatch(createDiagram({
//           title: `New ${type}`,
//           diagramType: type
//         }));
//       }
      
//       dispatch(changeDiagramType(type));
//       dispatch(setCreateNewEditor(true));
//     }
//   };

//   return (
//     <NavDropdown 
//       id="diagram-type-menu" 
//       title={formatDiagramType(currentType)}
//       style={{ paddingTop: 0, paddingBottom: 0 }}
//     >
//       {ALLOWED_DIAGRAM_TYPES.map((type) => (
//         <NavDropdown.Item
//           key={type}
//           onClick={() => handleTypeChange(type)}
//           active={currentType === type}
//         >
//           {formatDiagramType(type)}
//         </NavDropdown.Item>
//       ))}
//     </NavDropdown>
//   );
// };
