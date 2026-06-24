import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { toast, Id } from 'react-toastify'; // Import Id type
import { useTranslation } from 'react-i18next';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { BACKEND_URL } from '../../../shared/constants/constant';
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
    async (editor: ApollonEditor, generatorType: string, diagramTitle: string, config?: GeneratorConfig[keyof GeneratorConfig]): Promise<void> => {
      
      // Validate diagram before generation
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || t('generation.toast.validationFailed'));
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available');
        toast.error(t('generation.toast.noDiagram'));
        return;
      }

      // Create a persistent loading toast
      const toastId = toast.loading(t('generation.toast.localDeploymentInProgress'), {
        position: "top-center",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        progress: undefined,
      });

      try {
        const response = await fetch(`${BACKEND_URL}/deploy-app`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify({
            title: diagramTitle,
            model: editor.model,
            generator: generatorType,
            config: config,
          }),
        });

        // Update the toast based on the response
        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData);
          
          // Update the toast to an error state
          if (response.status === 400 && errorData.detail) {
            toast.update(toastId, { 
              render: `${errorData.detail}`, 
              type: "error", 
              isLoading: false,
              autoClose: 5000
            });
            return;
          }
          
          if (response.status === 500 && errorData.detail) {
            toast.update(toastId, { 
              render: `${errorData.detail}`, 
              type: "error", 
              isLoading: false,
              autoClose: 5000
            });
            return;
          }

          toast.update(toastId, {
            render: t('generation.toast.httpError', { status: response.status }),
            type: "error",
            isLoading: false,
            autoClose: 5000
          });
          return;
        }

        toast.update(toastId, {
          render: React.createElement('div', null,
            React.createElement('p', null, t('generation.toast.localDeploymentCompleted')),
            React.createElement(
              'p',
              null,
              t('generation.toast.accessApplicationAt'),
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
      } catch (error) {
        let errorMessage = t('generation.toast.unknownDeploymentError');
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Update the toast to error
        toast.update(toastId, {
          render: errorMessage,
          type: "error",
          isLoading: false,
          autoClose: 5000
        });
      }
    },
    [t]
  );

  return deployLocally;
};
