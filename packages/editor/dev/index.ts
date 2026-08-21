import { ApollonEditor, ApollonMode, UMLDiagramType } from '../src/main';

let editor: ApollonEditor | null = null;

async function createEditor(type: UMLDiagramType) {
  if (editor) {
    editor.destroy();
  }

  const container = document.getElementById('apollon')!;
  editor = new ApollonEditor(container, {
    type,
    mode: ApollonMode.Modelling,
    colorEnabled: true,
    enablePopups: true,
  });

  await editor.nextRender;
}

// Init with ClassDiagram
createEditor(UMLDiagramType.ClassDiagram);

// Switch diagram type on dropdown change
document.getElementById('diagram-type')!.addEventListener('change', (e) => {
  const type = (e.target as HTMLSelectElement).value as UMLDiagramType;
  createEditor(type);
});
