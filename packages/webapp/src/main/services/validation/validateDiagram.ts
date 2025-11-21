import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';
import { ApollonEditor } from '@besser/wme';

/**
 * Validate diagram using the unified backend validation endpoint.
 * This function sends the diagram to the backend which:
 * 1. Converts JSON to BUML (metamodel validation happens automatically)
 * 2. Returns any validation errors from BUML construction
 * 3. For ClassDiagram/ObjectDiagram: also runs OCL constraint checks
 * 4. Returns unified validation results with errors, warnings, and OCL results
 */
export async function validateDiagram(editor: ApollonEditor, diagramTitle: string) {
  toast.dismiss();
  
  try {
    if (!editor || !editor.model) {
      toast.error('No diagram to validate');
      return { isValid: false, errors: ['No diagram available'] };
    }

    // Show loading state
    const loadingToastId = toast.loading("Validating diagram...", {
      position: "top-right",
      theme: "dark",
      autoClose: false,
      closeOnClick: false,
      closeButton: false,
      draggable: false
    });

    let modelData = editor.model;

    // Call unified validation endpoint
    const response = await fetch(`${BACKEND_URL}/validate-diagram`, {
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
      const errorData = await response.json().catch(() => ({ 
        errors: ['Could not parse error response'] 
      }));
      
      toast.dismiss();
      
      const errorMessage = errorData.errors?.join('\n') || 'Validation failed';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: false,
        style: {
          fontSize: "16px",
          padding: "20px",
          width: "400px",
          whiteSpace: "pre-line",
          maxHeight: "600px",
          overflow: "auto"
        }
      });
      return { isValid: false, errors: errorData.errors || ['Validation failed'] };
    }
    
    const result = await response.json();
    
    // Small delay to ensure smooth transition
    await new Promise(resolve => setTimeout(resolve, 100));
    toast.dismiss(loadingToastId);
    
    // Show validation errors
    if (result.errors && result.errors.length > 0) {
      const errorMessage = "❌ Validation Errors:\n\n" + result.errors.join("\n\n");
      toast.error(errorMessage, {
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
          width: "400px",
          whiteSpace: "pre-line",
          maxHeight: "600px",
          overflow: "auto"
        }
      });
    }
    
    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      const warningMessage = "⚠️ Warnings:\n\n" + result.warnings.join("\n\n");
      toast.warning(warningMessage, {
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
          width: "400px",
          whiteSpace: "pre-line",
          maxHeight: "600px",
          overflow: "auto"
        }
      });
    }
    
    // Show valid OCL constraints
    if (result.valid_constraints && result.valid_constraints.length > 0) {
      const validMessage = "✅ Valid Constraints:\n\n" + result.valid_constraints.join("\n\n");
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
          width: "400px",
          whiteSpace: "pre-line",
          maxHeight: "600px",
          overflow: "auto"
        }
      });
    }
    
    // Show invalid OCL constraints
    if (result.invalid_constraints && result.invalid_constraints.length > 0) {
      const invalidMessage = "❌ Invalid Constraints:\n\n" + result.invalid_constraints.join("\n\n");
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
          width: "400px",
          whiteSpace: "pre-line",
          maxHeight: "600px",
          overflow: "auto"
        }
      });
    }
    
    // Show OCL message if available and no constraints
    if (result.ocl_message && 
        (!result.valid_constraints || result.valid_constraints.length === 0) &&
        (!result.invalid_constraints || result.invalid_constraints.length === 0)) {
      toast.info(result.ocl_message, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    }
    
    // Show success if everything is valid
    if (result.isValid && (!result.errors || result.errors.length === 0)) {
      toast.success(result.message || "✅ Diagram is valid", {
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
    
    return result;
    
  } catch (error: unknown) {
    console.error('Error during validation:', error);
    toast.dismiss();
    toast.error(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      position: "top-right",
      autoClose: 5000,
      theme: "dark"
    });
    return { 
      isValid: false, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

// Export the old function name for backwards compatibility
export const checkOclConstraints = validateDiagram;
