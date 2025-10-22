import { ApollonEditor } from '../../apollon-editor';
import { diagramBridge } from '../diagram-bridge';

export const exportDiagram = async (editor: ApollonEditor | null) => {
    if (!editor) return;
    const model = editor.model; // Model now automatically includes class diagram data for Object Models
    
    const jsonString = JSON.stringify(model, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram_${model.type}_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importDiagram = async (file: File, editor: ApollonEditor | null) => {
    if (!editor || !file) return;
    try {
        const text = await file.text();
        const jsonModel = JSON.parse(text);
        
        // If importing an ObjectDiagram with embedded class diagram data
        if (jsonModel.type === 'ObjectDiagram' && jsonModel.referenceDiagramData) {
            // Set the class diagram data in the bridge service
            diagramBridge.setClassDiagramData(jsonModel.referenceDiagramData);

            // Remove from model before setting (keep it clean)
            delete jsonModel.referenceDiagramData;
        }
        
        editor.model = jsonModel;
        return true;
    } catch (error) {
        console.error('Error importing diagram:', error);
        throw new Error('Error importing diagram. Please check if the file is valid JSON.');
    }
};