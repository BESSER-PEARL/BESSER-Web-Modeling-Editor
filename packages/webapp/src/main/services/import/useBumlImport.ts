import { useCallback } from 'react';
import { useAppDispatch } from '../../components/store/hooks';
import { displayError } from '../error-management/errorManagementSlice';
import { createDiagram } from '../diagram/diagramSlice';
import { toast } from 'react-toastify';
import { UMLDiagramType, UMLModel, diagramBridge } from '@besser/wme';
import { BACKEND_URL } from '../../constant';
import { uuid } from '../../utils/uuid';
import { LocalStorageRepository } from '../local-storage/local-storage-repository';
import { Diagram } from '../diagram/diagramSlice';


export const useBumlImport = () => {
  const dispatch = useAppDispatch();

  const importBuml = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('buml_file', file);

    try {
      const response = await fetch(`${BACKEND_URL}/get-json-model`, {
        method: 'POST',
        body: formData,
      });

        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData); // Debug log

          if (response.status === 400 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return;
          }
          

          if (response.status === 500 && errorData.detail) {
            dispatch(displayError('Import failed', errorData.detail));
            return;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

      const data = await response.json();
      let modelType: UMLDiagramType;
      switch (data.model.type) {
        case 'StateMachineDiagram':
          modelType = UMLDiagramType.StateMachineDiagram;
          break;
        case 'AgentDiagram':
          modelType = UMLDiagramType.AgentDiagram;
          break;
        case 'ObjectDiagram':
          modelType = UMLDiagramType.ObjectDiagram;
          break;
        default:
          modelType = UMLDiagramType.ClassDiagram;
}

      // Create template model with proper type
      const template: UMLModel = {
        ...data.model,
        type: modelType
      };      // If importing an ObjectDiagram with embedded class diagram data

      dispatch(createDiagram({
        title: data.title,
        template: template,
        diagramType: modelType
      }));

    } catch (error) {

      console.error('Error importing BUML:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      dispatch(displayError('Import failed', errorMessage));
        
      // toast.error(`${errorMessage}`);
    }
  }, [dispatch]);

  return importBuml;
};
