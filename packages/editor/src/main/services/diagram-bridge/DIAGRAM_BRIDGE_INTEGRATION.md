# Diagram Bridge Service Integration Guide

## Overview
The `DiagramBridgeService` provides a clean way to share class diagram data with object diagrams without relying on localStorage directly. It's already implemented and being used in your UML Object Diagram components.

## How It Works

### 1. Service Location
- **Service**: `src/main/services/diagram-bridge/diagram-bridge-service.ts`
- **Import**: `import { diagramBridge } from '../../../services/diagram-bridge';`

### 2. Current Implementation
Both UML Object Diagram components are already using the service:
- `uml-object-name-update.tsx` - for class selection and attribute generation
- `uml-object-link-update.tsx` - for association selection

### 3. Integration Points

#### When Class Diagram Changes
To integrate with your class diagram workflow, you need to call the service when:

1. **Class diagram is loaded:**
```typescript
import { diagramBridge } from '../services/diagram-bridge';

// When loading a class diagram
const loadClassDiagram = (modelData: any) => {
  // Your existing loading logic...
  
  // Update the bridge for object diagrams to use
  diagramBridge.setClassDiagramData(modelData);
};
```

2. **Class diagram is saved/modified:**
```typescript
// When class diagram changes
const onClassDiagramChange = (modelData: any) => {
  // Your existing save logic...
  
  // Update the bridge
  diagramBridge.setClassDiagramData(modelData);
};
```

3. **Switching diagram types:**
```typescript
// When switching from class diagram to object diagram
const switchToObjectDiagram = () => {
  // Ensure the current class diagram data is available
  const currentClassModel = getCurrentClassDiagramData();
  if (currentClassModel) {
    diagramBridge.setClassDiagramData(currentClassModel);
  }
  
  // Switch to object diagram view
  // Your existing switching logic...
};
```

### 4. Data Storage
The service uses a hybrid approach:
- **Primary**: In-memory storage for performance
- **Backup**: localStorage for persistence (`besser-class-diagram-bridge-data` key)
- **Fallback**: Backward compatibility with `classLibrary` key

### 5. Available Methods

```typescript
// Set class diagram data
diagramBridge.setClassDiagramData(classModel);

// Get available classes for object creation
const classes = diagramBridge.getAvailableClasses();

// Get associations between specific classes
const associations = diagramBridge.getAvailableAssociations(sourceClassId, targetClassId);

// Check if class data is available
const hasData = diagramBridge.hasClassDiagramData();

// Clear all data
diagramBridge.clearDiagramData();
```

### 6. Object Diagram Features

#### Object Name (Class Selection)
- Dropdown shows available classes from the class diagram
- Selecting a class automatically creates object attributes
- Stores the class ID for reference

#### Object Link (Association Selection)  
- Dropdown shows available associations between connected objects
- Only shows associations that exist in the class diagram
- Generates display names based on roles, multiplicities, or object names

### 7. Example Integration

```typescript
// In your main diagram manager or app component
import { diagramBridge } from './services/diagram-bridge';

export class DiagramManager {
  // When class diagram is loaded/updated
  updateClassModel(classModel: any) {
    // Update the bridge
    diagramBridge.setClassDiagramData(classModel);
    
    // Your other logic...
  }
  
  // When switching to object diagram
  openObjectDiagram() {
    // The object diagram components will automatically
    // access the class data through the bridge
    if (!diagramBridge.hasClassDiagramData()) {
      console.warn('No class diagram data available for object diagram');
    }
  }
}
```

## Benefits

1. **Clean Architecture**: No direct localStorage access in components
2. **Type Safety**: Full TypeScript interfaces and type checking
3. **Performance**: In-memory storage with localStorage backup
4. **Testability**: Easy to mock for unit tests
5. **Package Ready**: Can be easily packaged and distributed
6. **Backward Compatible**: Still supports existing localStorage keys

## Current Status

✅ **Already Implemented**: The service is fully implemented and being used
✅ **No Breaking Changes**: Works with existing localStorage data
✅ **Type Safe**: Full TypeScript support with interfaces
✅ **Ready for Packaging**: Clean service-based architecture

You just need to integrate the service calls into your class diagram workflow wherever the model data changes or loads.
