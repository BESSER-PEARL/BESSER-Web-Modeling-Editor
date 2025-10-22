import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../validation/diagramValidation';
import { BACKEND_URL } from '../../constant';

// Add type definitions
export interface DjangoConfig {
  project_name: string;
  app_name: string;
  containerization: boolean;
}

export interface SQLConfig {
  dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb';
}

export interface SQLAlchemyConfig {
  dbms: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb';
}

export interface JSONSchemaConfig {
  mode: 'regular' | 'smart_data';
}

export interface AgentConfig {
  languages?: {
    source: string;
    target: string[];
  };
}

export type GeneratorConfig = {
  django: DjangoConfig;
  sql: SQLConfig;
  sqlalchemy: SQLAlchemyConfig;
  jsonschema: JSONSchemaConfig;
  agent: AgentConfig;
  [key: string]: any;
};

export const useGenerateCode = () => {
  const downloadFile = useFileDownload();

  const generateCode = useCallback(
    async (editor: ApollonEditor, generatorType: string, diagramTitle: string, config?: GeneratorConfig[keyof GeneratorConfig]) => {
      console.log('Starting code generation...'); 
      
      // Validate diagram before generation
      const validationResult = validateDiagram(editor);
      if (!validationResult.isValid) {
        toast.error(validationResult.message);
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available');
        toast.error('No diagram to generate code from');
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/generate-output`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify({
            title: diagramTitle,
            model: editor.model,
            generator: generatorType,
            config: config // Add configuration object
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
        }

        const blob = await response.blob();
        
        // Get the filename from the response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'generated_code.txt'; // Default filename
        
        if (contentDisposition) {
          // Try multiple patterns to extract filename
          const patterns = [
            /filename="([^"]+)"/,
            /filename=([^;\s]+)/, 
            /filename="?([^";\s]+)"?/ 
          ];
          
          for (const pattern of patterns) {
            const match = contentDisposition.match(pattern);
            if (match) {
              filename = match[1];
              break;
            }
          }
        }

        downloadFile({ file: blob, filename });
        toast.success('Code generation completed successfully');
      } catch (error) {

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
      
        toast.error(`${errorMessage}`);
      }
    },
    [downloadFile],
  );

  return generateCode;
};