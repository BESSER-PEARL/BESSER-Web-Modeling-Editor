import { useCallback } from 'react';
import { BesserEditor } from '@besser/wme';
import { toast, Id } from 'react-toastify';
import { reportError } from '../../../shared/services/errors/reportError';
import { useTranslation } from 'react-i18next';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { confirmValidationWarnings } from '../../../shared/services/validation/confirmValidationWarnings';
import { deployApp } from '../../../shared/api/generation';
import { ApiError } from '../../../shared/api/api-client';
import { prepareAgentModelForBackend } from '../../../shared/utils/projectExportUtils';
import { elapsedMs, errorProperties, track } from '../../../shared/services/analytics/events';
import React from 'react';

// Add type definitions
export interface DjangoConfig {
  project_name: string;
  app_name: string;
  containerization: boolean;
}

export type GeneratorConfig = {
  django: DjangoConfig;
  [key: string]: any;
};

export const useDeployLocally = () => {
  const { t } = useTranslation();
  const deployLocally = useCallback(
    async (editor: BesserEditor, generatorType: string, diagramTitle: string, config?: GeneratorConfig[keyof GeneratorConfig]): Promise<void> => {
      
      // Validate diagram before generation
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        reportError(validationResult.message || t('generation.toasts.validationFailed'));
        // `failure` is set when the validation request itself failed, not the model.
        const reason = validationResult.failure !== undefined ? 'request' : 'validation';
        track('local_deploy_blocked', { generator_type: generatorType, reason });
        return;
      }
      if (!(await confirmValidationWarnings(validationResult.warnings))) {
        track('local_deploy_blocked', { generator_type: generatorType, reason: 'warnings_declined' });
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available');
        reportError(t('generation.toasts.noDiagram'));
        track('local_deploy_blocked', { generator_type: generatorType, reason: 'no_diagram' });
        return;
      }

      // Create a persistent loading toast
      const toastId = toast.loading(t('generation.toasts.localDeploymentInProgress'), {
        position: "top-center",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        progress: undefined,
      });

      const startedAt = performance.now();
      try {
        await deployApp({
          title: diagramTitle,
          model: generatorType === 'agent' ? prepareAgentModelForBackend(editor.model) : editor.model,
          generator: generatorType,
          config: config,
        });

        toast.update(toastId, {
          render: React.createElement('div', null,
            React.createElement('p', null, t('generation.toasts.localDeploymentCompleted')),
            React.createElement(
              'p',
              null,
              t('generation.toasts.accessApplicationAt'),
              React.createElement(
                'a',
                {
                  href: 'http://localhost:8000/admin',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  style: { color: '#4caf50', textDecoration: 'underline' }
                },
                'http://localhost:8000/admin'
              )
            )
          ),
          type: 'success',
          isLoading: false,
          autoClose: 5000,
        });
        track('local_deploy_succeeded', { duration_ms: elapsedMs(startedAt) });
      } catch (error) {
        track('local_deploy_failed', { duration_ms: elapsedMs(startedAt), ...errorProperties(error) });
        if (error instanceof ApiError) {
          console.error('Response not OK:', error.status, error.message);
          // Update the toast to an error state
          reportError(
            error.detail && (error.status === 400 || error.status === 500)
              ? error.detail
              : t('generation.toasts.httpError', { status: error.status }),
            { updateToast: toastId, isLoading: false, autoClose: 5000, error },
          );
          return;
        }

        let errorMessage = t('generation.toasts.unknownDeploymentError');
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Update the toast to error
        reportError(errorMessage, { updateToast: toastId, isLoading: false, autoClose: 5000, error });
      }
    },
    [t]
  );

  return deployLocally;
};
