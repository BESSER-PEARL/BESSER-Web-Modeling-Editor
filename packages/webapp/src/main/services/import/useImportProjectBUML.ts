// import { BesserProject } from '../../types/project';
// import { Diagram } from '../diagram/diagramSlice';
// import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
// import { BACKEND_URL } from '../../constant';

// // Interface for V2 JSON export format
// interface V2ExportData {
//   project: BesserProject;
//   exportedAt: string;
//   version: string;
// }

// // Interface for legacy import validation (V1 format)
// interface LegacyImportData {
//   project: BesserProject;
//   diagrams: Diagram[];
//   exportedAt?: string;
//   version?: string;
// }

// // Validate V2 export format
// function validateV2ExportData(data: any): data is V2ExportData {
//   return (
//     data &&
//     typeof data === 'object' &&
//     data.project &&
//     typeof data.project.id === 'string' &&
//     typeof data.project.name === 'string' &&
//     typeof data.project.diagrams === 'object' &&
//     data.project.diagrams !== null
//   );
// }

// // Validate legacy import data structure (V1 format)
// function validateLegacyImportData(data: any): data is LegacyImportData {
//   return (
//     data &&
//     typeof data === 'object' &&
//     data.project &&
//     Array.isArray(data.diagrams) &&
//     typeof data.project.id === 'string' &&
//     typeof data.project.name === 'string'
//   );
// }

// // Convert legacy format (with separate diagrams array) to new project format
// function convertLegacyToProject(data: LegacyImportData): BesserProject {
//   const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   return {
//     ...data.project,
//     id: newProjectId,
//     name: `${data.project.name}`,
//     createdAt: new Date().toISOString(),
//   };
// }

// // Store imported project using the project storage system
// function storeImportedProject(project: BesserProject): void {
//   ProjectStorageRepository.saveProject(project);
// }

// // Import from BUML (.py)
// export async function importProjectFromBUML(file: File): Promise<BesserProject> {
//   const formData = new FormData();
//   formData.append("buml_file", file);

//   const response = await fetch(`${BACKEND_URL}/get-json-model`, {
//     method: 'POST',
//     body: formData,
//   });

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));
//     throw new Error(errorData.detail || `Import failed with status ${response.status}`);
//   }

//   const jsonData = await response.json();

//   if (validateV2ExportData(jsonData)) {
//     const project = {
//       ...jsonData.project,
//       id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//       name: `${jsonData.project.name}`,
//       createdAt: new Date().toISOString(),
//     };
//     storeImportedProject(project);
//     return project;

//   } else if (validateLegacyImportData(jsonData)) {
//     const convertedProject = convertLegacyToProject(jsonData);
//     storeImportedProject(convertedProject);
//     return convertedProject;

//   } else {
//     throw new Error('Invalid BUML file structure');
//   }
// }

// // Main import function for .py
// export async function importProjectBUML(file: File): Promise<BesserProject> {
//   const fileExtension = file.name.toLowerCase().split('.').pop();
//   if (fileExtension !== 'py') {
//     throw new Error('Only .py files are supported for BUML import');
//   }

//   return importProjectFromBUML(file);
// }

// // File selector
// export function selectBUMLFile(): Promise<File> {
//   return new Promise((resolve, reject) => {
//     const input = document.createElement('input');
//     input.type = 'file';
//     input.accept = '.py';
//     input.multiple = false;

//     input.onchange = (e) => {
//       const file = (e.target as HTMLInputElement).files?.[0];
//       if (file) {
//         resolve(file);
//       } else {
//         reject(new Error('No file selected'));
//       }
//     };

//     input.oncancel = () => {
//       reject(new Error('File selection cancelled'));
//     };

//     input.click();
//   });
// }

// // Full BUML import workflow
// export async function handleImportBUML(): Promise<BesserProject> {
//   try {
//     const file = await selectBUMLFile();
//     const importedProject = await importProjectBUML(file);
//     window.dispatchEvent(new Event('storage'));
//     return importedProject;
//   } catch (error) {
//     console.error('BUML import failed:', error);
//     throw error;
//   }
// }
