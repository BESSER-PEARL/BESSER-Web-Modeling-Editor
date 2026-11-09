import { toast } from 'react-toastify';
import { reportError } from '../errors/reportError';
import type { CSSProperties } from 'react';
import { postValidateDiagram, type ValidationResponse } from '../../api/validation';
import { ApiError } from '../../api/api-client';
import { BesserEditor } from '@besser/wme';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { withReferenceDiagramData } from './validationPayload';
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
 * @param editor - BESSER WME editor instance (can be null/undefined for quantum circuits)
 * @param diagramTitle - Title of the diagram being validated
 * @param modelData - Optional: Direct model data (used for quantum circuits that don't use the BESSER WME editor)
 */
const VALIDATION_TOAST_ID = 'diagram-validation-loading';
// A fresh id per run: react-toastify ignores a new toast whose id is still active,
// and a dismiss is only applied on the next render.
let resultToastSeq = 0;
let resultToastId: string | null = null;
const replaceResultToast = (): string => {
  if (resultToastId) toast.dismiss(resultToastId);
  resultToastId = `diagram-validation-result-${++resultToastSeq}`;
  return resultToastId;
};

interface ValidationResultLike {
  isValid?: boolean;
  message?: string;
  errors?: string[];
  warnings?: string[];
  valid_constraints?: string[];
  invalid_constraints?: string[];
  ocl_message?: string;
}

/**
 * One toast per validation run (errors, warnings, OCL results and the success
 * line merged), replacing the previous run's toast, auto-closing, and themed
 * by the app. Returns null when there is nothing to report.
 */
export function buildValidationResultToast(
  result: ValidationResultLike,
): { type: 'error' | 'warning' | 'success' | 'info'; message: string; autoClose: number } | null {
  const has = (list?: string[]) => Array.isArray(list) && list.length > 0;
  const sections: string[] = [];
  // The toast's own icon carries the status, so section labels and backend lines carry no emoji.
  const section = (labelKey: string, items: string[]) =>
    [i18n.t(labelKey), ...items.map(stripStatusEmoji)].join('\n\n');
  if (has(result.errors)) sections.push(section('validation.toasts.errorsLabel', result.errors!));
  if (has(result.invalid_constraints)) {
    sections.push(section('validation.toasts.invalidConstraintsLabel', result.invalid_constraints!));
  }
  if (has(result.warnings)) sections.push(section('validation.toasts.warningsLabel', result.warnings!));
  if (has(result.valid_constraints)) {
    sections.push(section('validation.toasts.validConstraintsLabel', result.valid_constraints!));
  } else if (result.ocl_message && !has(result.invalid_constraints)) {
    sections.push(stripStatusEmoji(result.ocl_message));
  }

  const failed = has(result.errors) || has(result.invalid_constraints);
  const warned = has(result.warnings);
  if (result.isValid && !failed && !warned) {
    sections.unshift(stripStatusEmoji(result.message || i18n.t('validation.toasts.diagramValid')));
  }
  if (sections.length === 0) return null;

  const type = failed ? 'error' : warned ? 'warning' : result.isValid ? 'success' : 'info';
  const autoClose = type === 'error' ? 12000 : type === 'warning' ? 8000 : 5000;
  return { type, message: sections.join('\n\n'), autoClose };
}

function showValidationResultToast(result: ValidationResultLike, style: CSSProperties, onlyProblems = false): void {
  const toastId = replaceResultToast();
  const built = buildValidationResultToast(result);
  if (!built || (onlyProblems && (built.type === 'success' || built.type === 'info'))) return;
  const options = {
    toastId,
    position: 'top-right' as const,
    autoClose: built.autoClose,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    style,
  };
  if (built.type === 'error') reportError(built.message, options);
  else toast[built.type](built.message, options);
}

/**
 * `onlyProblems`: for validation run as a precondition (e.g. before Generate),
 * whose caller reports its own success -- a passing run raises no result toast.
 *
 * A result with `checkFailed: true` means the check itself did not run (the
 * validator was unreachable, the request failed or timed out): its `errors`
 * describe that failure, not the model, so a caller acting on model errors
 * must not treat them as such.
 */
/**
 * The backend's result, or `isValid: false` with the reason when it could not be had;
 * then `checkFailed` is set and `failure` holds the caught error (for analytics, never
 * shown). `empty` marks a diagram with nothing to check, which is reported valid but
 * was never checked.
 */
export type ValidateDiagramResult = Pick<ValidationResponse, 'isValid' | 'errors'> &
  Partial<ValidationResponse> & { failure?: unknown; checkFailed?: boolean; empty?: boolean };

export async function validateDiagram(
  editor: BesserEditor | null | undefined,
  diagramTitle: string,
  modelData?: any,
  { onlyProblems = false }: { onlyProblems?: boolean } = {},
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
    let model = modelData && modelData._suppressToasts ? { ...modelData } : modelData || editor?.model;
    if (model && model._suppressToasts) delete model._suppressToasts;

    if (!model) {
      if (!suppressToasts) reportError(i18n.t('validation.toasts.noDiagramToValidate'));
      return { isValid: false, errors: ['No diagram available'] };
    }

    // Object diagrams must carry their linked ClassDiagram as
    // `model.referenceDiagramData` — the backend builds the domain model from
    // it before validating the object instances against it.
    model = withReferenceDiagramData(model, ProjectStorageRepository.getCurrentProject());

    const hasNodes = Array.isArray(model.nodes) && model.nodes.length > 0;
    const hasEdges = Array.isArray(model.edges) && model.edges.length > 0;
    if (!hasNodes && !hasEdges) {
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
        return { isValid: false, errors: ['Validation timed out'], checkFailed: true, failure: fetchError };
      }
      if (!(fetchError instanceof ApiError)) throw fetchError;
      // A failed request carries a `detail`; only a validation result has `errors`.
      if (!suppressToasts) {
        toast.dismiss(VALIDATION_TOAST_ID);
        reportError(i18n.t('validation.toasts.validationFailed'), {
          toastId: replaceResultToast(),
          position: "top-right",
          autoClose: 12000,
          style: {
            ...longToastStyle
          }
        });
      }
      // The backend reports model errors with a 200, so any non-2xx is the check failing.
      return { isValid: false, errors: ['Validation failed'], checkFailed: true, failure: fetchError };
    }
    
    // Small delay to ensure smooth transition
    if (!suppressToasts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      toast.dismiss(VALIDATION_TOAST_ID);
    }

    if (!suppressToasts) {
      showValidationResultToast(result, longToastStyle, onlyProblems);
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
      checkFailed: true,
      failure: error,
    };
  }
}

// Export the old function name for backwards compatibility
export const checkOclConstraints = validateDiagram;
