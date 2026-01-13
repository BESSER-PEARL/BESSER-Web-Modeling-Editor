# Adding a New UML Diagram Type to the Web Modeling Editor

This guide explains how to add a new UML diagram type (e.g., `SyntaxTree`, `Flowchart`, `BPMN`) to the webapp sidebar and project system.

## Overview

Adding a new diagram type requires modifications to **5 files** in the frontend, plus **backend integration**.

| File | Purpose |
|------|---------|
| `types/project.ts` | Core type definitions and project structure |
| `DiagramTypeSidebar.tsx` | Sidebar button and click handling |
| `export-project-modal.tsx` | Export modal labels |
| `ProjectSettingsScreen.tsx` | Settings page color badges |
| `useImportProject.ts` | Import handling for projects |
| **Backend** | **Parser integration (Required)** |

---

## Step-by-Step Guide

### Step 1: Define the Diagram Type in `types/project.ts`

**File:** `src/main/types/project.ts`

#### 1.1 Add to `SupportedDiagramType` (line ~3)

```typescript
export type SupportedDiagramType = 
  'ClassDiagram' | 
  'ObjectDiagram' | 
  'StateMachineDiagram' | 
  'AgentDiagram' | 
  'GUINoCodeDiagram' | 
  'QuantumCircuitDiagram' |
  'YourNewDiagram';  // ADD THIS
```

#### 1.2 Add to `BesserProject.diagrams` interface (line ~52)

```typescript
diagrams: {
  ClassDiagram: ProjectDiagram;
  ObjectDiagram: ProjectDiagram;
  StateMachineDiagram: ProjectDiagram;
  AgentDiagram: ProjectDiagram;
  GUINoCodeDiagram: ProjectDiagram;
  QuantumCircuitDiagram: ProjectDiagram;
  YourNewDiagram: ProjectDiagram;  // ADD THIS
};
```

#### 1.3 Add to `toSupportedDiagramType()` function (line ~69)

```typescript
export const toSupportedDiagramType = (type: UMLDiagramType): SupportedDiagramType => {
  switch (type) {
    case UMLDiagramType.ClassDiagram:
      return 'ClassDiagram';
    // ... other cases ...
    case UMLDiagramType.SyntaxTree:  // ADD THIS CASE
      return 'YourNewDiagram';
    default:
      return 'ClassDiagram';
  }
};
```

#### 1.4 Add to `toUMLDiagramType()` function (line ~86)

```typescript
export const toUMLDiagramType = (type: SupportedDiagramType): UMLDiagramType | null => {
  switch (type) {
    case 'ClassDiagram':
      return UMLDiagramType.ClassDiagram;
    // ... other cases ...
    case 'YourNewDiagram':  // ADD THIS CASE
      return UMLDiagramType.SyntaxTree;  // The actual UML type from @besser/wme
    case 'GUINoCodeDiagram':
      return null;
    case 'QuantumCircuitDiagram':
      return null;
    default:
      return null;
  }
};
```

#### 1.5 Add to `createDefaultProject()` function (line ~237)

```typescript
diagrams: {
  ClassDiagram: createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram),
  ObjectDiagram: createEmptyDiagram('Object Diagram', UMLDiagramType.ObjectDiagram),
  StateMachineDiagram: createEmptyDiagram('State Machine Diagram', UMLDiagramType.StateMachineDiagram),
  AgentDiagram: createEmptyDiagram('Agent Diagram', UMLDiagramType.AgentDiagram),
  GUINoCodeDiagram: createEmptyDiagram('GUI Diagram', null, 'gui'),
  QuantumCircuitDiagram: createEmptyDiagram('Quantum Circuit', null, 'quantum'),
  YourNewDiagram: createEmptyDiagram('Your New Diagram', UMLDiagramType.SyntaxTree),  // ADD THIS
},
```

---

### Step 2: Add Sidebar Button in `DiagramTypeSidebar.tsx`

**File:** `src/main/components/sidebar/DiagramTypeSidebar.tsx`

#### 2.1 Import an icon (optional)

```typescript
import {
  Diagram3,
  Diagram2,
  Robot,
  ArrowRepeat,
  Gear,
  PencilSquare,
  House,
  Cpu,
  Tree  // ADD THIS - or use any icon from react-bootstrap-icons
} from 'react-bootstrap-icons';
```

#### 2.2 Add to `sidebarItems` array (line ~94)

```typescript
const sidebarItems: SidebarItem[] = [
  { type: UMLDiagramType.ClassDiagram, label: 'Class Diagram', icon: <Diagram3 size={20} /> },
  { type: UMLDiagramType.ObjectDiagram, label: 'Object Diagram', icon: <Diagram2 size={20} /> },
  { type: UMLDiagramType.StateMachineDiagram, label: 'State Machine', icon: <ArrowRepeat size={20} /> },
  { type: UMLDiagramType.AgentDiagram, label: 'Agent Diagram', icon: <Robot size={20} /> },
  { type: UMLDiagramType.SyntaxTree, label: 'Syntax Tree', icon: <Tree size={20} /> },  // ADD THIS
  { type: 'graphical-ui-editor', label: 'Graphical UI', icon: <PencilSquare size={20} />, path: '/graphical-ui-editor' },
  { type: 'quantum-editor', label: 'Quantum Circuit', icon: <Cpu size={20} />, path: '/quantum-editor' },
  { type: 'settings', label: 'Project Settings', icon: <Gear size={20} />, path: '/project-settings' },
];
```

---

### Step 3: Add Export Label in `export-project-modal.tsx`

**File:** `src/main/components/modals/export-project-modal/export-project-modal.tsx`

```typescript
const diagramLabels: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  GUINoCodeDiagram: 'GUI No-Code Diagram',
  QuantumCircuitDiagram: 'Quantum Circuit Diagram',
  YourNewDiagram: 'Your New Diagram',  // ADD THIS
};
```

---

### Step 4: Add Color Badge in `ProjectSettingsScreen.tsx`

**File:** `src/main/components/project/ProjectSettingsScreen.tsx`

```typescript
const getDiagramTypeColor = (type: SupportedDiagramType): string => {
  const colors: Record<SupportedDiagramType, string> = {
    'ClassDiagram': 'primary',
    'ObjectDiagram': 'success',
    'StateMachineDiagram': 'warning',
    'AgentDiagram': 'info',
    'GUINoCodeDiagram': 'dark',
    'QuantumCircuitDiagram': 'secondary',
    'YourNewDiagram': 'danger'  // ADD THIS - use any Bootstrap color
  };
  return colors[type] || 'secondary';
};
```

---

### Step 5: Add Import Support in `useImportProject.ts`

**File:** `src/main/services/import/useImportProject.ts`

#### 5.1 Add to `allDiagramTypes` array (line ~43)

```typescript
const allDiagramTypes: SupportedDiagramType[] = [
  'ClassDiagram',
  'ObjectDiagram',
  'StateMachineDiagram',
  'AgentDiagram',
  'GUINoCodeDiagram',
  'QuantumCircuitDiagram',
  'YourNewDiagram'  // ADD THIS
];
```

#### 5.2 Add to `diagramTypeToUMLType` Record (line ~52)

```typescript
const diagramTypeToUMLType: Record<SupportedDiagramType, UMLDiagramType | null> = {
  ClassDiagram: UMLDiagramType.ClassDiagram,
  ObjectDiagram: UMLDiagramType.ObjectDiagram,
  StateMachineDiagram: UMLDiagramType.StateMachineDiagram,
  AgentDiagram: UMLDiagramType.AgentDiagram,
  GUINoCodeDiagram: null,
  QuantumCircuitDiagram: null,
  YourNewDiagram: UMLDiagramType.SyntaxTree,  // ADD THIS
};
```

#### 5.3 Add to `diagramTitles` Record (line ~61)

```typescript
const diagramTitles: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  GUINoCodeDiagram: 'GUI Diagram',
  QuantumCircuitDiagram: 'Quantum Circuit',
  YourNewDiagram: 'Your New Diagram'  // ADD THIS
};
```

---

### Step 6: Backend Integration (Parser)

**Crucial Step:** After adding the diagram type to the frontend, you **must** implement the corresponding parser in the BESSER backend.

Without the backend parser:
1. The diagram will not be able to generate code.
2. The diagram might not persist correctly if it relies on backend validation.
3. You may encounter errors when attempting to export or compile the model.

**Action:**
- Locate the BESSER backend repository.
- Implement a parser for your new `UMLDiagramType` (e.g., `SyntaxTree`).
- Ensure the backend can accept and process the JSON structure produced by the frontend editor for this diagram type.

---

## Available UML Diagram Types

The following `UMLDiagramType` values are available in `@besser/wme`:

| Type | Value |
|------|-------|
| `UMLDiagramType.ClassDiagram` | Already supported |
| `UMLDiagramType.ObjectDiagram` | Already supported |
| `UMLDiagramType.StateMachineDiagram` | Already supported |
| `UMLDiagramType.AgentDiagram` | Already supported |
| `UMLDiagramType.ActivityDiagram` | Available |
| `UMLDiagramType.UseCaseDiagram` | Available |
| `UMLDiagramType.CommunicationDiagram` | Available |
| `UMLDiagramType.ComponentDiagram` | Available |
| `UMLDiagramType.DeploymentDiagram` | Available |
| `UMLDiagramType.PetriNet` | Available |
| `UMLDiagramType.ReachabilityGraph` | Available |
| `UMLDiagramType.SyntaxTree` | Available |
| `UMLDiagramType.Flowchart` | Available |
| `UMLDiagramType.BPMN` | Available |
| `UMLDiagramType.UserDiagram` | Available |

---

## Important Notes

1. **Create a new project** after adding a new diagram type - existing projects won't have the new diagram slot.

2. **TypeScript will help you** - if you miss adding the type to any `Record<SupportedDiagramType, ...>`, you'll get a compilation error.

3. **Clear localStorage** if you encounter issues with existing projects:
   ```javascript
   localStorage.clear();
   ```

4. **Test the sidebar click** - make sure clicking the new diagram type switches the editor correctly.

---

## Quick Checklist

- [ ] `types/project.ts` - Add to `SupportedDiagramType`
- [ ] `types/project.ts` - Add to `BesserProject.diagrams`
- [ ] `types/project.ts` - Add case in `toSupportedDiagramType()`
- [ ] `types/project.ts` - Add case in `toUMLDiagramType()`
- [ ] `types/project.ts` - Add to `createDefaultProject()`
- [ ] `DiagramTypeSidebar.tsx` - Add to `sidebarItems`
- [ ] `export-project-modal.tsx` - Add to `diagramLabels`
- [ ] `ProjectSettingsScreen.tsx` - Add to `colors` Record
- [ ] `useImportProject.ts` - Add to `allDiagramTypes`
- [ ] `useImportProject.ts` - Add to `diagramTypeToUMLType`
- [ ] `useImportProject.ts` - Add to `diagramTitles`
- [ ] **Backend** - Implement parser for the new diagram type
