import { useCallback, useState } from 'react';
import { ApollonEditor } from '@besser/wme';
import { toast, Id } from 'react-toastify'; // Import Id type
import { validateDiagram } from '../validation/validateDiagram';
import { BACKEND_URL } from '../../constant';
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
  const deployLocally = useCallback(
    async (editor: ApollonEditor, generatorType: string, diagramTitle: string, config?: GeneratorConfig[keyof GeneratorConfig]): Promise<void> => {
      
      // Validate diagram before generation
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || 'Validation failed');
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available');
        toast.error('No diagram to generate code from');
        return;
      }

      // Create a persistent loading toast
      const toastId = toast.loading('Local deployment in progress... This may take a few minutes.', {
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
            diagramTitle: diagramTitle,
            elements: editor.model,
            generator: generatorType,
            config: config
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
            render: `HTTP error! status: ${response.status}`, 
            type: "error", 
            isLoading: false,
            autoClose: 5000
          });
          return;
        }

        toast.update(toastId, {
          render: React.createElement('div', null,
            React.createElement('p', null, 'Local deployment completed!'),
            React.createElement(
              'p',
              null,
              'You can now access your application at: ',
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
        let errorMessage = 'Unknown error occurred during deployment';
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
    []
  );

  return deployLocally;
};
