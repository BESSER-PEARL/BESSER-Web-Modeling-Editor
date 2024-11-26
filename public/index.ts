import * as Apollon from '../src/main';
import * as themings from './themings.json';
import('./styles.css');
import { exportDiagram, importDiagram } from '../src/main/services/diagramExportImport/diagramExportService';
import { convertBumlToJson } from './generate_besser';

const container = document.getElementById('apollon')!;
let editor: Apollon.ApollonEditor | null = null;
let options: Apollon.ApollonOptions = {
  model: JSON.parse(window.localStorage.getItem('apollon')!),
  colorEnabled: true,
  scale: 0.8,
  type: 'ClassDiagram'
};

// Set initial visibility of code generator section
const codeGeneratorSection = document.getElementById('codeGeneratorSection');
if (codeGeneratorSection) {
  codeGeneratorSection.style.display = 'block';
}

// Fonction called when the diagram type is changed
export const onChange = (event: MouseEvent) => {
  const { name, value } = event.target as HTMLSelectElement;
  options = { ...options, [name]: value };
  render();
  if (name === 'type') {
    const codeGeneratorSection = document.getElementById('codeGeneratorSection');
    if (codeGeneratorSection) {
      codeGeneratorSection.style.display = value === 'ClassDiagram' ? 'block' : 'none';
    }
  }
};

// Fonction called when a switch is toggled 
export const onSwitch = (event: MouseEvent) => {
  const { name, checked: value } = event.target as HTMLInputElement;
  options = { ...options, [name]: value };
  render();
};

// Save both the diagram data and options in local storage
export const save = () => {
  if (!editor) return;
  const model: Apollon.UMLModel = editor.model;
  localStorage.setItem('apollon', JSON.stringify(model));
  // Save the current options as well
  localStorage.setItem('apollonOptions', JSON.stringify(options));
  options = { ...options, model };
  return options;
};

// Delete the diagram data from local storage
export const clear = () => {
  localStorage.removeItem('apollon');
  localStorage.removeItem('apollonOptions');
  options = { ...options, model: undefined };
};

// Set the theming of the editor
export const setTheming = (theming: string) => {
  const root = document.documentElement;
  const selectedButton = document.getElementById(
    theming === 'light' ? 'theming-light-mode-button' : 'theming-dark-mode-button',
  );
  const unselectedButton = document.getElementById(
    theming === 'light' ? 'theming-dark-mode-button' : 'theming-light-mode-button',
  );
  if (selectedButton && unselectedButton) {
    selectedButton.classList.add('selected');
    unselectedButton.classList.remove('selected');
  }
  for (const themingVar of Object.keys(themings[theming])) {
    root.style.setProperty(themingVar, themings[theming][themingVar]);
  }
};

// Draw the diagram as SVG and open it in a new window
export const draw = async (mode?: 'include' | 'exclude') => {
  if (!editor) return;
  const filter: string[] = [
    ...Object.entries(editor.model.interactive.elements)
      .filter(([, value]) => value)
      .map(([key]) => key),
    ...Object.entries(editor.model.interactive.relationships)
      .filter(([, value]) => value)
      .map(([key]) => key),
  ];

  const exportParam: Apollon.ExportOptions = mode ? { [mode]: filter, scale: editor.getScaleFactor() } as Apollon.ExportOptions : { scale: editor.getScaleFactor() } as Apollon.ExportOptions;
  const { svg }: Apollon.SVG = await editor.exportAsSVG(exportParam);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const svgBlobURL = URL.createObjectURL(svgBlob);
  window.open(svgBlobURL);
};

// Wait for the editor to fully initialize
const awaitEditorInitialization = async () => {
  if (editor && editor.nextRender) {
    try {
      await editor.nextRender;
      console.log("Editor fully initialized with application");
    } catch (error) {
      console.error("Failed to wait for editor to fully initialize:", error);
    }
  }
};

// Delete everything - diagram, options, and reset the editor
export const deleteEverything = () => {
  // Show a confirmation dialog
  const confirmDelete = window.confirm('Are you sure you want to delete everything? This cannot be undone.');
  
  if (confirmDelete) {
    // Clear local storage
    localStorage.removeItem('apollon');
    localStorage.removeItem('apollonOptions');
    
    // Reset options to default
    options = {
      model: undefined,
      colorEnabled: true,
      scale: 0.8,
      type: 'ClassDiagram'
    };
    
    // Destroy current editor if it exists
    if (editor) {
      editor.destroy();
      editor = null;
    }
    
    // Reset the diagram type dropdown
    const typeSelect = document.querySelector('select[name="type"]') as HTMLSelectElement;
    if (typeSelect) {
      typeSelect.value = 'ClassDiagram';
    }
    
    // Re-render the editor with default options
    render();
    
    // Log the action
    console.log('Everything has been deleted and reset');
  }
};

// 
const setupGlobalApollon = (editor: Apollon.ApollonEditor | null) => {
  if (!window.apollon) {
    window.apollon = {};
  }
  
  window.apollon = {
    ...window.apollon,
    onChange,
    onSwitch,
    draw,
    save,
    clear,
    deleteEverything,
    setTheming,
    exportDiagram: () => {
      if (editor) {
        exportDiagram(editor);
      } else {
        console.warn("Editor is not initialized");
      }
    },
    importDiagram: (file: File) => {
      if (editor) {
        importDiagram(file, editor);
      } else {
        console.warn("Editor is not initialized");
      }
    }
  };
};

// Render the editor
const render = async () => {
  console.log("Rendering editor");
  save();
  
  // Load saved options from localStorage
  const savedOptions = localStorage.getItem('apollonOptions');
  if (savedOptions) {
    const parsedOptions = JSON.parse(savedOptions);
    options = { ...options, ...parsedOptions, model: options.model };
    
    // Update the diagram type dropdown to match saved options
    const typeSelect = document.querySelector('select[name="type"]') as HTMLSelectElement;
    if (typeSelect && parsedOptions.type) {
      typeSelect.value = parsedOptions.type;
    }
  }

  if (editor) {
    editor.destroy();
  }
  editor = new Apollon.ApollonEditor(container, options);
  
  // Add position change listener
  editor.subscribeToModelDiscreteChange(() => {
    save();
  });

  await awaitEditorInitialization();

  if (editor) {
    console.log("Editor initialized successfully");
    (window as any).editor = editor;
    setupGlobalApollon(editor);

    import('./generate_besser').then(() => {
      console.log("generate_besser.ts loaded successfully after editor initialization");
    }).catch(error => {
      console.error("Failed to load generate_besser.ts:", error);
    });
  } else {
    console.error("Editor failed to initialize");
  }

  // Add event listener for delete everything button
  const deleteButton = document.getElementById('delete-everything-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      if (window.apollon && window.apollon.deleteEverything) {
        window.apollon.deleteEverything();
      }
    });
  }
};

render();
