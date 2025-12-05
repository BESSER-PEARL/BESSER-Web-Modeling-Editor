import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../validation/validateDiagram';
import { BACKEND_URL } from '../../constant';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { isGrapesJSProjectData } from '../../types/project';

// Add type definitions
export interface DjangoConfig {
  project_name: string;
  app_name: string;
  containerization: boolean;
}

export interface SQLConfig {
  dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
}

export interface SQLAlchemyConfig {
  dbms: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
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

      // For Web App generator, send the entire project
      if (generatorType === 'web_app') {
        return await generateCodeFromProject(generatorType, config);
      }

      // Prepare body for single diagram generation
      const body: any = {
        title: diagramTitle,
        model: editor.model,
        generator: generatorType,
        config: config
      };

      try {
        const response = await fetch(`${BACKEND_URL}/generate-output`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify(body),
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

  const generateCodeFromProject = useCallback(
    async (generatorType: string, config?: GeneratorConfig[keyof GeneratorConfig]) => {
      console.log('Starting code generation from project...');
      
      // Get the current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      
      if (!currentProject) {
        toast.error('No project available for code generation');
        return;
      }

      // Add generator and config to project settings
      const projectWithSettings = {
        ...currentProject,
        settings: {
          ...currentProject.settings,
          generator: generatorType,
          config: config
        }
      };

      try {
        const response = await fetch(`${BACKEND_URL}/generate-output-from-project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify(projectWithSettings),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData);
          
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
