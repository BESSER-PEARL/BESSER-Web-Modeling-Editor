import { toast } from 'react-toastify';
import type { CSSProperties } from 'react';
import { BACKEND_URL } from '../../constants/constant';
import { BesserEditor } from '@besser/wme';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { withReferenceDiagramData } from './validationPayload';
import { prepareAgentModelForBackend } from '../../utils/projectExportUtils';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';

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
  const section = (icon: string, labelKey: string, items: string[]) =>
    [`${icon} ${i18n.t(labelKey)}`, ...items].join('\n\n');
  if (has(result.errors)) sections.push(section('❌', 'validation.toasts.errorsLabel', result.errors!));
  if (has(result.invalid_constraints)) {
    sections.push(section('❌', 'validation.toasts.invalidConstraintsLabel', result.invalid_constraints!));
  }
  if (has(result.warnings)) sections.push(section('⚠️', 'validation.toasts.warningsLabel', result.warnings!));
  if (has(result.valid_constraints)) {
    sections.push(section('✅', 'validation.toasts.validConstraintsLabel', result.valid_constraints!));
  } else if (result.ocl_message && !has(result.invalid_constraints)) {
    sections.push(result.ocl_message);
  }

  const failed = has(result.errors) || has(result.invalid_constraints);
  const warned = has(result.warnings);
  if (result.isValid && !failed && !warned) {
    sections.unshift(result.message || `✅ ${i18n.t('validation.toasts.diagramValid')}`);
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
  toast[built.type](built.message, {
    toastId,
    position: 'top-right',
    autoClose: built.autoClose,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    style,
  });
}

/**
 * `onlyProblems`: for validation run as a precondition (e.g. before Generate),
 * whose caller reports its own success -- a passing run raises no result toast.
 */
export async function validateDiagram(
  editor: BesserEditor | null | undefined,
  diagramTitle: string,
  modelData?: any,
  { onlyProblems = false }: { onlyProblems?: boolean } = {},
) {
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
      if (!suppressToasts) toast.error(i18n.t('validation.toasts.noDiagramToValidate'));
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
      return { isValid: true, errors: [] };
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
          model: modelToSend
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        toast.dismiss(VALIDATION_TOAST_ID);
        toast.error(i18n.t('validation.toasts.timedOut'));
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
        const errorMessage = errorData.errors?.join('\n') || i18n.t('validation.toasts.validationFailed');
        toast.error(errorMessage, {
          toastId: replaceResultToast(),
          position: "top-right",
          autoClose: 12000,
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
      toast.error(message, {
        position: "top-right",
        autoClose: 5000,
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
