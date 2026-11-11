import { toast } from 'react-toastify';
import { reportError } from '../errors/reportError';
import type { CSSProperties } from 'react';
import { postValidateDiagram, type ValidationResponse } from '../../api/validation';
import { ApiError } from '../../api/api-client';
import { ApollonEditor } from '@besser/wme';
import { prepareAgentModelForBackend } from '../../utils/projectExportUtils';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';
import { stripStatusEmoji } from './stripStatusEmoji';


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

/**
 * The backend's result, or `isValid: false` with the reason when it could not be had;
 * then `failure` holds the caught error (for analytics, never shown). `empty` marks a
 * diagram with nothing to check, which is reported valid but was never checked.
 */
export type ValidateDiagramResult = Pick<ValidationResponse, 'isValid' | 'errors'> &
  Partial<ValidationResponse> & { failure?: unknown; empty?: boolean };

export async function validateDiagram(
  editor: ApollonEditor | null | undefined,
  diagramTitle: string,
  modelData?: any,
): Promise<ValidateDiagramResult> {
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
      if (!suppressToasts) reportError(i18n.t('validation.toasts.noDiagramToValidate'));
      return { isValid: false, errors: ['No diagram available'] };
    }

    const hasElements = model.elements && Object.keys(model.elements).length > 0;
    const hasRelationships = model.relationships && Object.keys(model.relationships).length > 0;
    if (!hasElements && !hasRelationships) {
      if (!suppressToasts) {
        toast.info(i18n.t('validation.toasts.diagramEmpty'), {
          position: 'top-right',
          autoClose: 4000,
        });
      }
      return { isValid: true, errors: [], empty: true };
    }

    // Show loading state
    if (!suppressToasts) {
      toast.loading(i18n.t('validation.toasts.validating'), {
        toastId: VALIDATION_TOAST_ID,
        position: "top-right",
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false
      });
    }

    // Agent models leave the editor through the single shared helper (components + transitions).
    const modelToSend = model?.type === 'AgentDiagram' ? prepareAgentModelForBackend(model) : model;

    // Call unified validation endpoint (the API module sets the timeout)
    let result: ValidationResponse;
    try {
      result = await postValidateDiagram({ title: diagramTitle, model: modelToSend });
    } catch (fetchError) {
      if (fetchError instanceof DOMException && (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError')) {
        toast.dismiss(VALIDATION_TOAST_ID);
        reportError(i18n.t('validation.toasts.timedOut'), { error: fetchError });
        return { isValid: false, errors: ['Validation timed out'], failure: fetchError };
      }
      if (!(fetchError instanceof ApiError)) throw fetchError;
      // A failed request carries a `detail`; only a validation result has `errors`.
      if (!suppressToasts) {
        toast.dismiss(VALIDATION_TOAST_ID);
        reportError(i18n.t('validation.toasts.validationFailed'), {
          position: "top-right",
          autoClose: false,
          style: {
            ...longToastStyle
          }
        });
      }
      return { isValid: false, errors: ['Validation failed'], failure: fetchError };
    }
    
    // Small delay to ensure smooth transition
    if (!suppressToasts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      toast.dismiss(VALIDATION_TOAST_ID);
    }

    // Show validation errors
    if (!suppressToasts && result.errors && result.errors.length > 0) {
      const errorMessage = `${i18n.t('validation.toasts.errorsLabel')}\n\n` + result.errors.map(stripStatusEmoji).join("\n\n");
      reportError(errorMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        style: {
          ...longToastStyle
        }
      });
    }
    
    // Show warnings
    if (!suppressToasts && result.warnings && result.warnings.length > 0) {
      const warningMessage = `${i18n.t('validation.toasts.warningsLabel')}\n\n` + result.warnings.map(stripStatusEmoji).join("\n\n");
      toast.warning(warningMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        style: {
          ...longToastStyle
        }
      });
    }
    
    // Show valid OCL constraints
    if (!suppressToasts && result.valid_constraints && result.valid_constraints.length > 0) {
      const validMessage = `${i18n.t('validation.toasts.validConstraintsLabel')}\n\n` + result.valid_constraints.map(stripStatusEmoji).join("\n\n");
      toast.success(validMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        style: {
          ...longToastStyle
        }
      });
    }
    
    // Show invalid OCL constraints
    if (!suppressToasts && result.invalid_constraints && result.invalid_constraints.length > 0) {
      const invalidMessage = `${i18n.t('validation.toasts.invalidConstraintsLabel')}\n\n` + result.invalid_constraints.map(stripStatusEmoji).join("\n\n");
      reportError(invalidMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        style: {
          ...longToastStyle
        }
      });
    }
    
    // Show OCL message if available and no constraints
    if (!suppressToasts && result.ocl_message &&
        (!result.valid_constraints || result.valid_constraints.length === 0) &&
        (!result.invalid_constraints || result.invalid_constraints.length === 0)) {
      toast.info(stripStatusEmoji(result.ocl_message), {
        position: "top-right",
        autoClose: 5000,
      });
    }
    
    // Show success only if everything is valid and there are no warnings
    const hasWarnings = result.warnings && result.warnings.length > 0;
    const hasInvalidConstraints = result.invalid_constraints && result.invalid_constraints.length > 0;
    if (!suppressToasts && result.isValid && (!result.errors || result.errors.length === 0) && !hasWarnings && !hasInvalidConstraints) {
      toast.success(stripStatusEmoji(result.message || i18n.t('validation.toasts.diagramValid')), {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
    
    return result;
    
  } catch (error: unknown) {
    console.error('Error during validation:', error);
    if (!suppressToasts) {
      toast.dismiss(VALIDATION_TOAST_ID);
      const message = isNetworkError(error)
        ? describeNetworkError(error)
        : i18n.t('validation.toasts.validationErrorGeneric', { error: error instanceof Error ? error.message : i18n.t('validation.toasts.unknownError') });
      reportError(message, {
        position: "top-right",
        autoClose: 5000,
        error,
      });
    }
    return { 
      isValid: false, 
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      failure: error, 
    };
  }
}

// Export the old function name for backwards compatibility
export const checkOclConstraints = validateDiagram;
