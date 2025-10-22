// import { BesserProject } from '../../types/project';
// import { Diagram } from '../diagram/diagramSlice';
// import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';

// // Dynamic import for JSZip
// async function loadJSZip() {
//   const JSZip = (await import('jszip')).default;
//   return JSZip;
// }

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
//   // Generate new project ID
//   const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
//   // Create a new project with the legacy data
//   const updatedProject: BesserProject = {
//     ...data.project,
//     id: newProjectId,
//     name: `${data.project.name} (Imported)`,
//     createdAt: new Date().toISOString(),
//     // Note: Legacy import assumes diagrams are stored separately
//     // The new project system stores diagrams within the project structure
//   };
  
//   return updatedProject;
// }

// // Store imported project using the project storage system
// function storeImportedProject(project: BesserProject): void {
//   // Use the project storage repository - this stores the complete project including diagrams
//   ProjectStorageRepository.saveProject(project);
// }

// // Import from JSON file
// export async function importProjectFromJson(file: File): Promise<BesserProject> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
    
//     reader.onload = (e) => {
//       try {
//         const jsonData = JSON.parse(e.target?.result as string);
        
//         // Check if it's the new V2 format first
//         if (validateV2ExportData(jsonData)) {
//           // V2 format - project already contains diagrams
//           const project = jsonData.project;
          
//           // Generate new ID for the project to avoid conflicts
//           const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//           const importedProject: BesserProject = {
//             ...project,
//             id: newProjectId,
//             name: `${project.name} (Imported)`,
//             createdAt: new Date().toISOString()
//           };
          
//           // Store using project storage
//           storeImportedProject(importedProject);
          
//           console.log(`Project "${importedProject.name}" imported successfully (V2 format)`);
//           resolve(importedProject);
          
//         } else if (validateLegacyImportData(jsonData)) {
//           // Legacy V1 format - convert to new format and store
//           const convertedProject = convertLegacyToProject(jsonData);
//           storeImportedProject(convertedProject);
          
//           console.log(`Project "${convertedProject.name}" imported successfully (Legacy format converted)`);
//           resolve(convertedProject);
          
//         } else {
//           throw new Error('Invalid project file format - unsupported structure');
//         }
        
//       } catch (error) {
//         console.error('JSON import failed:', error);
//         reject(new Error('Failed to import project: Invalid JSON format'));
//       }
//     };
    
//     reader.onerror = () => {
//       reject(new Error('Failed to read file'));
//     };
    
//     reader.readAsText(file);
//   });
// }

// // Import from ZIP file
// export async function importProjectFromZip(file: File): Promise<BesserProject> {
//   try {
//     const JSZip = await loadJSZip();
//     const zip = await JSZip.loadAsync(file);
    
//     // Read project.json
//     const projectFile = zip.file('project.json');
//     if (!projectFile) {
//       throw new Error('No project.json found in ZIP file');
//     }
    
//     const projectData = JSON.parse(await projectFile.async('text'));
    
//     // Read diagrams from diagrams folder
//     const diagrams: Diagram[] = [];
//     const diagramsFolder = zip.folder('diagrams');
    
//     if (diagramsFolder) {
//       const diagramFiles = Object.keys(zip.files).filter(path => 
//         path.startsWith('diagrams/') && path.endsWith('.json')
//       );
      
//       for (const diagramPath of diagramFiles) {
//         const diagramFile = zip.file(diagramPath);
//         if (diagramFile) {
//           try {
//             const diagramData = JSON.parse(await diagramFile.async('text'));
//             diagrams.push(diagramData);
//           } catch (error) {
//             console.warn(`Failed to parse diagram file ${diagramPath}:`, error);
//           }
//         }
//       }
//     }
    
//     const importData: LegacyImportData = {
//       project: projectData,
//       diagrams: diagrams
//     };
    
//     if (!validateLegacyImportData(importData)) {
//       throw new Error('Invalid project structure in ZIP file');
//     }
    
//     const convertedProject = convertLegacyToProject(importData);
//     storeImportedProject(convertedProject);
    
//     console.log(`Project "${convertedProject.name}" imported successfully from ZIP`);
//     return convertedProject;
    
//   } catch (error) {
//     console.error('ZIP import failed:', error);
//     throw new Error('Failed to import project from ZIP file');
//   }
// }

// // Main import function that handles both JSON and ZIP files
// export async function importProject(file: File): Promise<BesserProject> {
//   const fileExtension = file.name.toLowerCase().split('.').pop();
  
//   switch (fileExtension) {
//     case 'json':
//       return await importProjectFromJson(file);
//     case 'zip':
//       return await importProjectFromZip(file);
//     default:
//       throw new Error('Unsupported file format. Please select a .json or .zip file.');
//   }
// }

// // Helper function to trigger file selection
// export function selectImportFile(): Promise<File> {
//   return new Promise((resolve, reject) => {
//     const input = document.createElement('input');
//     input.type = 'file';
//     input.accept = '.json,.zip';
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

// // Complete import workflow
// export async function handleImportProject(): Promise<BesserProject> {
//   try {
//     const file = await selectImportFile();
//     const importedProject = await importProject(file);
    
//     // Trigger a storage event to update UI
//     window.dispatchEvent(new Event('storage'));
    
//     return importedProject;
//   } catch (error) {
//     console.error('Import process failed:', error);
//     throw error;
//   }
// }
