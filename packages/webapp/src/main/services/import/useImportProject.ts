import { BesserProject } from '../../types/project';
import { Diagram } from '../diagram/diagramSlice';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { BACKEND_URL } from '../../constant';

// Interface for V2 JSON export format
interface V2ExportData {
  project: BesserProject;
  exportedAt: string;
  version: string;
}

// Interface for legacy import validation (V1 format)
interface LegacyImportData {
  project: BesserProject;
  diagrams: Diagram[];
  exportedAt?: string;
  version?: string;
}

// Dynamic import for JSZip
async function loadJSZip() {
  const JSZip = (await import('jszip')).default;
  return JSZip;
}

// Validate V2 export format
function validateV2ExportData(data: any): data is V2ExportData {
  return (
    data &&
    typeof data === 'object' &&
    data.project &&
    typeof data.project.id === 'string' &&
    typeof data.project.name === 'string' &&
    typeof data.project.diagrams === 'object' &&
    data.project.diagrams !== null
  );
}

// Validate legacy import data structure (V1 format)
function validateLegacyImportData(data: any): data is LegacyImportData {
  return (
    data &&
    typeof data === 'object' &&
    data.project &&
    Array.isArray(data.diagrams) &&
    typeof data.project.id === 'string' &&
    typeof data.project.name === 'string'
  );
}

// Convert legacy format (with separate diagrams array) to new project format
function convertLegacyToProject(data: LegacyImportData): BesserProject {
  const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    ...data.project,
    id: newProjectId,
    name: `${data.project.name}`,
    createdAt: new Date().toISOString(),
  };
}

// Check if GUI model is empty
function isGUIModelEmpty(guiModel: any): boolean {
  if (!guiModel) return true;
  
  // Check if it's a GrapesJS model structure
  if (guiModel.pages) {
    // Empty if no pages
    if (!guiModel.pages || guiModel.pages.length === 0) {
      return true;
    }
    
    // Check if all pages are empty (have no frames or only empty frames)
    for (const page of guiModel.pages) {
      if (!page.frames || page.frames.length === 0) {
        continue; // This page is empty, check next
      }
      
      // Check if any frame has components
      for (const frame of page.frames) {
        if (frame.component && 
            frame.component.components && 
            frame.component.components.length > 0) {
          return false; // Found a frame with components, not empty
        }
      }
    }
    
    // All pages checked and none have components
    return true;
  }
  
  return false;
}

// Store imported project using the project storage system
function storeImportedProject(project: BesserProject): void {
  // Check if the imported GUI model is empty
  const importedGUIModel = project.diagrams?.GUINoCodeDiagram?.model;
  
  if (isGUIModelEmpty(importedGUIModel)) {
    // Try to get the current project's GUI model
    const currentProject = ProjectStorageRepository.getCurrentProject();
    
    if (currentProject?.diagrams?.GUINoCodeDiagram?.model) {
      // Keep the existing GUI model if it's not empty
      const existingGUIModel = currentProject.diagrams.GUINoCodeDiagram.model;
      if (!isGUIModelEmpty(existingGUIModel)) {
        console.log('Imported GUI model is empty, keeping existing GUI model');
        project.diagrams.GUINoCodeDiagram = {
          ...project.diagrams.GUINoCodeDiagram,
          model: existingGUIModel,
          lastUpdate: currentProject.diagrams.GUINoCodeDiagram.lastUpdate
        };
      }
    }
  }
  
  ProjectStorageRepository.saveProject(project);
}

// Import from BUML (.py)
export async function importProjectFromBUML(file: File): Promise<BesserProject> {
  const formData = new FormData();
  formData.append("buml_file", file);

  const response = await fetch(`${BACKEND_URL}/get-project-json-model`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Import failed with status ${response.status}`);
  }

  const jsonData = await response.json();

  if (validateV2ExportData(jsonData)) {
    const project = {
      ...jsonData.project,
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${jsonData.project.name}`,
      createdAt: new Date().toISOString(),
    };
    storeImportedProject(project);
    return project;

  } else if (validateLegacyImportData(jsonData)) {
    const convertedProject = convertLegacyToProject(jsonData);
    storeImportedProject(convertedProject);
    return convertedProject;

  } else {
    throw new Error('Invalid BUML file structure');
  }
}

// Import from JSON file
export async function importProjectFromJson(file: File): Promise<BesserProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        // Check if it's the new V2 format first
        if (validateV2ExportData(jsonData)) {
          // V2 format - project already contains diagrams
          const project = jsonData.project;
          
          // Generate new ID for the project to avoid conflicts
          const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const importedProject: BesserProject = {
            ...project,
            id: newProjectId,
            name: `${project.name}`,
            createdAt: new Date().toISOString()
          };
          
          // Store using project storage
          storeImportedProject(importedProject);
          
          console.log(`Project "${importedProject.name}" imported successfully (V2 format)`);
          resolve(importedProject);
          
        } else if (validateLegacyImportData(jsonData)) {
          // Legacy V1 format - convert to new format and store
          const convertedProject = convertLegacyToProject(jsonData);
          storeImportedProject(convertedProject);
          
          console.log(`Project "${convertedProject.name}" imported successfully (Legacy format converted)`);
          resolve(convertedProject);
          
        } else {
          throw new Error('Invalid project file format - unsupported structure');
        }
        
      } catch (error) {
        console.error('JSON import failed:', error);
        reject(new Error('Failed to import project: Invalid JSON format'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

// Main import function that handles JSON, ZIP, and BUML files
export async function importProject(file: File): Promise<BesserProject> {
  const fileExtension = file.name.toLowerCase().split('.').pop();
  
  switch (fileExtension) {
    case 'json':
      return await importProjectFromJson(file);
    case 'py':
      return await importProjectFromBUML(file);
    default:
      throw new Error('Unsupported file format. Please select a .json or .py file.');
  }
}

// Helper function to trigger file selection for JSON/ZIP
export function selectImportFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.py';
    input.multiple = false;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };
    
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };
    
    input.click();
  });
}

// Helper function to trigger file selection for BUML
export function selectBUMLFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py';
    input.multiple = false;

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };

    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    input.click();
  });
}

// Helper function to trigger file selection for any supported format
export function selectProjectFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,.py';
    input.multiple = false;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };
    
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };
    
    input.click();
  });
}

// Complete import workflow for JSON/ZIP
export async function handleImportProject(): Promise<BesserProject> {
  try {
    const file = await selectImportFile();
    const importedProject = await importProject(file);
    
    // Trigger a storage event to update UI
    window.dispatchEvent(new Event('storage'));
    
    return importedProject;
  } catch (error) {
    console.error('Import process failed:', error);
    throw error;
  }
}

// Complete import workflow for BUML
export async function handleImportBUML(): Promise<BesserProject> {
  try {
    const file = await selectBUMLFile();
    const importedProject = await importProject(file);
    window.dispatchEvent(new Event('storage'));
    return importedProject;
  } catch (error) {
    console.error('BUML import failed:', error);
    throw error;
  }
}

// Complete import workflow for any supported format
export async function handleImportAny(): Promise<BesserProject> {
  try {
    const file = await selectProjectFile();
    const importedProject = await importProject(file);
    
    // Trigger a storage event to update UI
    window.dispatchEvent(new Event('storage'));
    
    return importedProject;
  } catch (error) {
    console.error('Import process failed:', error);
    throw error;
  }
}
