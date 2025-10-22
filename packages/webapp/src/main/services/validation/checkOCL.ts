import { toast } from 'react-toastify';
import { validateDiagram } from './diagramValidation';
import { BACKEND_URL } from '../../constant';
import { ApollonEditor, diagramBridge, UMLDiagramType } from '@besser/wme';
import { LocalStorageRepository } from '../local-storage/local-storage-repository';

export async function checkOclConstraints(editor: ApollonEditor, diagramTitle: string) {
  try {
      // Step 1: Always run diagram validation first
      const validationResult = validateDiagram(editor);
      if (!validationResult.isValid) {
        toast.error(validationResult.message);
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available'); // Debug log
        toast.error('No diagram to export');
        return;
      }

      // Step 2: Show validation success message
      if (validationResult.message && validationResult.message.trim()) {
        toast.success(validationResult.message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark"
        });
      }

      // Step 3: Check if this diagram type supports OCL checks
      const supportsOCL = editor.model.type === 'ClassDiagram' || editor.model.type === 'ObjectDiagram';
      
      if (!supportsOCL) {
        // For non-OCL diagrams, just show validation success and return
        console.log(`Diagram type ${editor.model.type} does not support OCL checks`);
        return { isValid: true, message: "Diagram validation completed successfully" };
      }

      // Step 4: For OCL-supported diagrams, proceed with OCL checks
      let modelData = editor.model;

    const response = await fetch(`${BACKEND_URL}/check-ocl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: diagramTitle,
        model: modelData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
      console.error('Response not OK:', response.status, errorData); // Debug log
      
      if (response.status === 400 && errorData.detail) {
        toast.error(`${errorData.detail}`);
        return;
      }
      

      if (response.status === 500 && errorData.detail) {
        toast.error(`${errorData.detail}`);
        return;
      }

      throw new Error(`HTTP error! status: ${response.status}`);
    }    const result = await response.json();
    
    // Handle the separated valid and invalid constraints from backend
    if (result.valid_constraints && result.valid_constraints.length > 0) {
      const validMessage = "Valid constraints:\n\n" + result.valid_constraints.join("\n\n");
      toast.success(validMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        style: {
          fontSize: "16px",
          padding: "20px",
          width: "350px",
          whiteSpace: "pre-line"
        }
      });
    }
    
    if (result.invalid_constraints && result.invalid_constraints.length > 0) {
      const invalidMessage = "Invalid constraints:\n\n" + result.invalid_constraints.join("\n\n");
      toast.error(invalidMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        style: {
          fontSize: "16px",
          padding: "20px",
          width: "350px",
          whiteSpace: "pre-line"
        }
      });
    }
    
    // If no constraints were found, show the general message (only if message exists)
    if ((!result.valid_constraints || result.valid_constraints.length === 0) && 
        (!result.invalid_constraints || result.invalid_constraints.length === 0) &&
        result.message && result.message.trim()) {
      toast.info(result.message, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        style: {
          fontSize: "16px",
          padding: "20px",
          width: "350px",
          whiteSpace: "pre-line"
        }
      });
    }

    // Show validation result separately (only if there are validation messages to show)
    // Note: We already showed validation success earlier, so this is just for consistency
    
    return result;
  } catch (error: unknown) {
    console.error('Error during OCL check:', error);
    toast.error(`${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
