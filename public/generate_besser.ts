import { getDiagramData } from './utils';
import { validateBeforeGeneration } from './validation';

export async function exportBuml(editorInstance: any) {
  try {
    if (!editorInstance || !editorInstance.model) {
      console.error("Editor is not properly initialized or doesn't have a model yet!");
      return;
    }

    const diagramData = getDiagramData(editorInstance);
    if (!diagramData) {
      console.error("No diagram data available!");
      return;
    }


    const response = await fetch('http://localhost:8000/export-buml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elements: diagramData,
        generator: "buml",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("B-UML generated successfully");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Determine filename based on diagram type
    const filename = editorInstance.model.type === 'StateMachineDiagram' 
      ? 'state_machine.py' 
      : 'domain_model.py';
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error during B-UML export:', error);
    throw error; // Re-throw to be caught by the caller
  }
}

export async function generateOutput(generatorType: string) {
  try {
    const editorInstance = (window as any).editor;

    if (!editorInstance || !editorInstance.model) {
      console.error("Editor is not properly initialized or doesn't have a model yet!");
      return;
    }

    // Add validation before generation
    if (!validateBeforeGeneration(editorInstance)) {
      return;
    }

    const diagramData = getDiagramData(editorInstance);
    if (!diagramData) {
      console.error("There is no data available!");
      return;
    }

    if (generatorType === 'django') {
      // Show Django configuration popup instead of direct generation
      const popup = document.getElementById('djangoConfigPopup');
      if (popup) {
        popup.style.display = 'flex';
      }
      return;
    }

    const response = await fetch('http://localhost:8000/generate-output', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elements: diagramData,
        generator: generatorType,
      }),
    });

    if (response.ok) {
      const blob = await response.blob();
      
      let filename;

      switch (generatorType) {
        case 'python':
          filename = 'classes.py';
          break;
        case 'django':
          filename = 'models.py';
          break;
        case 'pydantic':
          filename = 'pydantic_classes.py';
          break;
        case 'sqlalchemy':
          filename = 'sql_alchemy.py';
          break;
        case 'sql':
          filename = 'tables.sql';
          break;
        case 'backend':
          filename = 'backend_output.zip';
          break;
        case 'java':
          filename = 'java_output.zip';
          break;
        default:
          filename = 'default.py';
          break;
      }
      

      // Create and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      console.error('Error generating file:', response.statusText);
      throw new Error(`Generation failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export async function checkOclConstraints(editorInstance: any) {
  const button = document.querySelector('[onclick="window.apollon.checkOclConstraints()"]') as HTMLButtonElement;
  if (!button) return;

  try {
    // Add loading state
    const originalText = button.innerHTML;
    button.classList.add('button-with-spinner', 'loading');
    button.innerHTML = '<div class="loading-spinner"></div>Checking...';
    button.disabled = true;

    if (!editorInstance || !editorInstance.model) {
      throw new Error("Editor is not properly initialized");
    }

    const diagramData = getDiagramData(editorInstance);

    const response = await fetch('http://localhost:8000/check-ocl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elements: diagramData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error during OCL check:', error);
    throw error;
  } finally {
    // Reset button state
    if (button) {
      button.classList.remove('button-with-spinner', 'loading');
      button.innerHTML = 'Check OCL';
      button.disabled = false;
    }
  }
}

// Function to handle the generation button event
function setupGenerateButton() {
  console.log("Setting up generate button");
  const generateButton = document.getElementById('generateButton');
  const generatorSelect = document.getElementById('generatorSelect') as HTMLSelectElement;
  const convertButton = document.getElementById('convertButton');
  const importBumlFile = document.getElementById('import-buml-file');

  if (generateButton && generatorSelect) {
    generateButton.addEventListener('click', () => {
      const selectedGenerator = generatorSelect.value;
      generateOutput(selectedGenerator);
    });
  }

// Use the existing input file instead of creating a new one
  if (convertButton && importBumlFile) {
    convertButton.addEventListener('click', () => {
      (importBumlFile as HTMLInputElement).click();
    });
  }
}

// Extend the window.apollon object with our functions
declare global {
  interface Window {
    apollon: any;
  }
}

window.addEventListener('load', () => {
  setupGenerateButton();
  
  if (!window.apollon) {
    window.apollon = {};
  }
  
  window.apollon = {
    ...window.apollon,
    generateCode: async (generatorType: string) => {
      await generateOutput(generatorType);
    },
    convertBumlToJson: async (file: File) => {
      if (!file) return;
      await convertBumlToJson(file);
    },
    exportBuml: async () => {
      await exportBuml((window as any).editor);
    },
    generateDjangoProject: async () => {
      try {
        const blob = await generateDjangoProject((window as any).editor);
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'django_project.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        const popup = document.getElementById('djangoConfigPopup');
        if (popup) {
          popup.style.display = 'none';
        }
      } catch (error) {
        console.error('Error generating Django project:', error);
        alert(`Failed to generate Django project: ${error.message}`);
      }
    }
  };
});

// Export the function
export async function convertBumlToJson(file: File) {
  try {
    const formData = new FormData();
    formData.append('buml_file', file);

    const response = await fetch('http://localhost:8000/get-json-model', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const textData = await response.text();
      const jsonData = JSON.parse(textData);
      
      const editorInstance = (window as any).editor;
      if (editorInstance && editorInstance.model) {
        try {
          editorInstance.model = jsonData.model;
          if (jsonData.ocl) {
            localStorage.setItem('diagramOCL', jsonData.ocl);
          }
          window.apollon.save();
        } catch (editorError) {
          console.error("Failed to update editor:", editorError);
        }
      }
    }
  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

export async function generateDjangoProject(editorInstance: any) {
  const projectName = (document.getElementById('projectName') as HTMLInputElement).value;
  const appName = (document.getElementById('appName') as HTMLInputElement).value;
  const containerization = (document.getElementById('containerization') as HTMLInputElement).checked;

  if (!projectName || !appName) {
    throw new Error('Please fill in both project name and app name');
  }

  if (!editorInstance || !editorInstance.model) {
    throw new Error("Editor is not properly initialized");
  }

  const diagramData = getDiagramData(editorInstance);
  if (!diagramData) {
    throw new Error("No diagram data available!");
  }

  const response = await fetch('http://localhost:8000/generate-output', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      elements: diagramData,
      generator: "django",
      config: {
        project_name: projectName,
        app_name: appName,
        containerization: containerization
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  return blob;
}