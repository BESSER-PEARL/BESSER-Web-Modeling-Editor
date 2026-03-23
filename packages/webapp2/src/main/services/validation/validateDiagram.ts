import { toast } from 'react-toastify';
import type { CSSProperties } from 'react';
import { BACKEND_URL } from '../../constant';
import { ApollonEditor } from '@besser/wme';

/**
 * Validate diagram using the unified backend validation endpoint.
 * This function sends the diagram to the backend which:
 * 1. Converts JSON to BUML (metamodel validation happens automatically)
 * 2. Returns any validation errors from BUML construction
 * 3. For ClassDiagram/ObjectDiagram: also runs OCL constraint checks
 * 4. Returns unified validation results with errors, warnings, and OCL results
 * 
 * @param editor - Apollon editor instance (can be null/undefined for quantum circuits)
 * @param diagramTitle - Title of the diagram being validated
 * @param modelData - Optional: Direct model data (used for quantum circuits that don't use Apollon)
 */
const VALIDATION_TOAST_ID = 'diagram-validation-loading';

export async function validateDiagram(editor: ApollonEditor | null | undefined, diagramTitle: string, modelData?: any) {
  // Optionally suppress toasts for programmatic validation (e.g. GUI pre-validation)
  const suppressToasts = modelData && modelData._suppressToasts;

  if (!suppressToasts) {
    toast.dismiss(VALIDATION_TOAST_ID);
  }

  try {
    const longToastStyle: CSSProperties = {
      fontSize: "16px",
      padding: "20px",
      width: "100%",
      boxSizing: "border-box",
      whiteSpace: "pre-line",
      maxHeight: "600px",
      overflow: "auto",
      overflowWrap: "anywhere",
      wordBreak: "break-word"
    };

    // Get model data from editor or use provided modelData (for quantum circuits)
    const model = modelData && modelData._suppressToasts ? { ...modelData } : modelData || editor?.model;
    if (model && model._suppressToasts) delete model._suppressToasts;

    if (!model) {
      if (!suppressToasts) toast.error('No diagram to validate');
      return { isValid: false, errors: ['No diagram available'] };
    }

    // Show loading state
    if (!suppressToasts) {
      toast.loading("Validating diagram...", {
        toastId: VALIDATION_TOAST_ID,
        position: "top-right",
        theme: "dark",
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false
      });
    }

    // Call unified validation endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/validate-diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: diagramTitle,
          model: model
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        toast.dismiss(VALIDATION_TOAST_ID);
        toast.error('Validation timed out. The backend may be overloaded.');
        return { isValid: false, errors: ['Validation timed out'] };
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        errors: ['Could not parse error response'] 
      }));
      
      if (!suppressToasts) {
        toast.dismiss(VALIDATION_TOAST_ID);
        const errorMessage = errorData.errors?.join('\n') || 'Validation failed';
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: false,
          style: {
            ...longToastStyle
          }
        });
      }
      return { isValid: false, errors: errorData.errors || ['Validation failed'] };
    }
    
    const result = await response.json();
    
    // Small delay to ensure smooth transition
    if (!suppressToasts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      toast.dismiss(VALIDATION_TOAST_ID);
    }

    // Show validation errors
    if (!suppressToasts && result.errors && result.errors.length > 0) {
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
          ...longToastStyle
        }
      });
    }
    
    // Show warnings
    if (!suppressToasts && result.warnings && result.warnings.length > 0) {
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
          ...longToastStyle
        }
      });
    }
    
    // Show valid OCL constraints
    if (!suppressToasts && result.valid_constraints && result.valid_constraints.length > 0) {
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
          ...longToastStyle
        }
      });
    }
    
    // Show invalid OCL constraints
    if (!suppressToasts && result.invalid_constraints && result.invalid_constraints.length > 0) {
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
          ...longToastStyle
        }
      });
    }
    
    // Show OCL message if available and no constraints
    if (!suppressToasts && result.ocl_message &&
        (!result.valid_constraints || result.valid_constraints.length === 0) &&
        (!result.invalid_constraints || result.invalid_constraints.length === 0)) {
      toast.info(result.ocl_message, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    }
    
    // Show success if everything is valid
    if (!suppressToasts && result.isValid && (!result.errors || result.errors.length === 0)) {
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
    if (!suppressToasts) {
      toast.dismiss(VALIDATION_TOAST_ID);
      toast.error(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    }
    return { 
      isValid: false, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

// Export the old function name for backwards compatibility
export const checkOclConstraints = validateDiagram;
