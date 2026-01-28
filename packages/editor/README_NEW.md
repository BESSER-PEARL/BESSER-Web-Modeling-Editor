# BESSER Web Modeling Editor: Editor Package

[![npm version](https://badge.fury.io/js/%40besser%2Fweb-modeling-editor.svg)](https://www.npmjs.com/package/@besser/web-modeling-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **BESSER Web Modeling Editor** is a powerful UML modeling editor built with React and TypeScript, customized for the [BESSER platform](https://github.com/BESSER-PEARL/BESSER). It seamlessly integrates BESSER's B-UML modeling language with advanced code generation capabilities, enabling rapid design and development of software applications in a low-code environment.

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Architecture Overview](#architecture-overview)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## About

BESSER Web Modeling Editor enhances the UML modeling experience with comprehensive support for BESSER's B-UML language. Designed for seamless integration with the BESSER low-code platform, the editor provides an intuitive interface for creating, editing, and generating code from UML diagrams.

Built on a robust React + TypeScript foundation, the editor employs Redux for state management and offers extensive customization options through themes, localization, and plugin support.

## Key Features

### B-UML Modeling Support
- **Structural Models**: Full support for Class Diagrams with B-UML extensions
- **Behavioral Models**: StateMachine Diagrams tailored to B-UML semantics
- **Multi-Diagram Support**: Activity, Communication, Component, Deployment, Object, Use Case, and more
- **Real-time Collaboration**: Multi-user editing with conflict resolution
- **Code Generation**: Automatically translate models into executable code:
  - Python classes compatible with BESSER
  - Django ORM models
  - SQLAlchemy database schemas
  - REST APIs with FastAPI
  - Pydantic validators
  - SQL DDL scripts

### Intuitive User Experience
- **Drag-and-Drop Interface**: Effortlessly create and position elements
- **Context-Aware Editing**: Double-click elements for quick property updates
- **Theme Support**: Built-in dark/light themes with full customization
- **Keyboard Shortcuts**: Comprehensive shortcuts for power users
- **Undo/Redo**: Full history tracking with keyboard shortcuts
- **Copy/Paste**: Within editor and to/from clipboard

### Advanced Canvas Capabilities
- **Infinite Canvas**: Grid-based workspace with smooth panning and zooming
- **Smart Positioning**: Automatic layout algorithms for clean diagrams
- **Flexible Relationships**: Auto-routing connections with manual waypoint control
- **Snap-to-Grid**: Configurable grid snapping for precise alignment
- **Multi-Selection**: Select and manipulate multiple elements simultaneously
- **Zoom Controls**: Scale from 10% to 300% with smooth interpolation

### Element Interactions
- **Hoverable**: Visual feedback on mouse hover
- **Selectable**: Click to select, multi-select with Ctrl/Cmd
- **Movable**: Drag elements to reposition
- **Resizable**: Resize elements with handles
- **Connectable**: Create relationships by dragging from ports
- **Reconnectable**: Change relationship endpoints
- **Updatable**: Edit properties via double-click popup
- **Droppable**: Drop elements into containers

### Integration with BESSER Platform
- **Automatic Synchronization**: Real-time sync with BESSER backend
- **Model Serialization**: JSON-based model format for easy integration
- **Code Generation Pipeline**: Direct integration with BESSER generators
- **Import/Export**: Load and save models in multiple formats
- **Assessment Mode**: Built-in support for educational assessments
- **Extensibility**: Plugin system for custom elements and behaviors

## Installation

Install the package using npm or yarn:

```bash
# Using npm
npm install @besser/web-modeling-editor

# Using yarn
yarn add @besser/web-modeling-editor
```

## Usage

### Basic Setup

```typescript
import ApollonEditor from '@besser/web-modeling-editor';
import { UMLDiagramType, ApollonMode } from '@besser/web-modeling-editor';

// Get a DOM container element
const container = document.getElementById('editor-container');

// Create a new editor instance
const editor = new ApollonEditor(container, {
  type: UMLDiagramType.ClassDiagram,
  mode: ApollonMode.Modelling,
  readonly: false,
  enablePopups: true,
});
```

### Loading a Model

```typescript
// Load an existing model
const model = {
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 1000, height: 800 },
  elements: {
    'element-1': {
      id: 'element-1',
      name: 'User',
      type: 'Class',
      bounds: { x: 100, y: 100, width: 200, height: 150 },
    },
    // ... more elements
  },
  relationships: {},
};

editor.model = model;
```

### Subscribing to Changes

```typescript
// Subscribe to model changes
const subscriptionId = editor.subscribeToModelChange((model) => {
  console.log('Model changed:', model);
  // Save to backend, update UI, etc.
});

// Subscribe to selection changes
editor.subscribeToSelectionChange((selection) => {
  console.log('Selection changed:', selection);
});

// Unsubscribe when done
editor.unsubscribeFromModelChange(subscriptionId);
```

### Exporting as SVG

```typescript
// Export the current model as SVG
const svg = await editor.exportAsSVG({
  margin: 10,
  keepOriginalSize: false,
});

console.log(svg.svg); // SVG string
console.log(svg.clip); // Bounding box information
```

### Programmatic Element Selection

```typescript
// Select specific elements
editor.select({
  elements: {
    'element-1': true,
    'element-2': true,
  },
  relationships: {
    'relationship-1': true,
  },
});
```

### Cleanup

```typescript
// Destroy the editor instance when done
editor.destroy();
```

## API Documentation

### ApollonEditor Class

#### Constructor

```typescript
constructor(container: HTMLElement, options: ApollonOptions)
```

**Parameters:**
- `container`: The DOM element to mount the editor into
- `options`: Configuration options (see ApollonOptions)

#### Properties

- `model: UMLModel` - Get/set the current model
- `type: UMLDiagramType` - Get/set the diagram type
- `locale: Locale` - Get/set the current locale
- `selection: Selection` - Get the current selection
- `nextRender: Promise<void>` - Promise that resolves after the next render

#### Methods

##### Model Operations
- `exportAsSVG(options?: ExportOptions): Promise<SVG>` - Export model as SVG
- `importPatch(patch: Patch): void` - Apply a JSON Patch to the model
- `getScaleFactor(): number` - Get the current zoom scale

##### Selection
- `select(selection: Selection): void` - Programmatically select elements
- `remoteSelect(name: string, color: string, select: string[], deselect?: string[]): void` - Handle remote selection

##### Subscriptions
- `subscribeToModelChange(callback: (model: UMLModel) => void): number`
- `subscribeToModelDiscreteChange(callback: (model: UMLModel) => void): number`
- `subscribeToModelChangePatches(callback: (patch: Patch) => void): number`
- `subscribeToSelectionChange(callback: (selection: Selection) => void): number`
- `subscribeToAssessmentChange(callback: (assessments: Assessment[]) => void): number`
- `subscribeToApollonErrors(callback: (error: Error) => void): number`

##### Cleanup
- `unsubscribeFromModelChange(id: number): void`
- `unsubscribeFromDiscreteModelChange(id: number): void`
- `unsubscribeFromModelChangePatches(id: number): void`
- `unsubscribeFromSelectionChange(id: number): void`
- `unsubscribeFromAssessmentChange(id: number): void`
- `unsubscribeToApollonErrors(id: number): void`
- `destroy(): void` - Unmount and destroy the editor

##### Static Methods
- `static exportModelAsSvg(model: UMLModel, options?: ExportOptions, theme?: DeepPartial<Styles>): Promise<SVG>`

### ApollonOptions

```typescript
interface ApollonOptions {
  type: UMLDiagramType;              // Diagram type
  mode?: ApollonMode;                // Editor mode (default: Exporting)
  readonly?: boolean;                // Read-only mode
  model?: UMLModel;                  // Initial model
  theme?: DeepPartial<Styles>;       // Custom theme
  locale?: Locale;                   // Language (en, de)
  scale?: number;                    // Initial zoom (0.1 - 3.0)
  colorEnabled?: boolean;            // Enable color picker
  enablePopups?: boolean;            // Enable update popups
  copyPasteToClipboard?: boolean;    // Enable clipboard operations
}
```

### UML Diagram Types

```typescript
enum UMLDiagramType {
  ClassDiagram = 'ClassDiagram',
  ObjectDiagram = 'ObjectDiagram',
  ActivityDiagram = 'ActivityDiagram',
  UseCaseDiagram = 'UseCaseDiagram',
  CommunicationDiagram = 'CommunicationDiagram',
  ComponentDiagram = 'ComponentDiagram',
  DeploymentDiagram = 'DeploymentDiagram',
  PetriNet = 'PetriNet',
  ReachabilityGraph = 'ReachabilityGraph',
  SyntaxTree = 'SyntaxTree',
  Flowchart = 'Flowchart',
  BPMN = 'BPMN',
}
```

### Apollon Modes

```typescript
enum ApollonMode {
  Modelling = 'Modelling',    // Full editing capabilities
  Exporting = 'Exporting',    // View-only mode
  Assessment = 'Assessment',   // Assessment/grading mode
}
```

## Architecture Overview

The editor follows a modular architecture with clear separation of concerns:

### Core Components
- **Canvas**: Infinite workspace with grid and zoom
- **Sidebar**: Element palette and model tree
- **Toolbar**: Actions and view controls
- **Update Pane**: Property editor popup
- **Assessment Panel**: Scoring and feedback UI

### State Management
- **Redux Store**: Centralized application state
- **Reducers**: State update logic per feature
- **Sagas**: Side effects and async operations
- **Actions**: Type-safe action creators

### Element System
- **UMLElement**: Base class for all diagram elements
- **UMLRelationship**: Connection between elements
- **UMLContainer**: Elements that can contain others
- **Features**: Composable behaviors (hoverable, movable, etc.)

### Services
- **LayoutService**: Auto-layout algorithms
- **PatcherService**: JSON Patch generation/application
- **ExportService**: SVG and image export
- **AssessmentService**: Educational features

## Development

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor.git
cd BESSER-Web-Modeling-Editor/besser/utilities/web_modeling_editor/frontend/packages/editor

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the library
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── main/
│   ├── components/          # React components
│   │   ├── canvas/         # Canvas and editor
│   │   ├── sidebar/        # Element palette
│   │   ├── controls/       # UI controls
│   │   └── uml-element/    # Element HOCs
│   ├── packages/           # Diagram-specific code
│   │   ├── uml-class-diagram/
│   │   ├── uml-state-diagram/
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── uml-element/
│   │   ├── uml-relationship/
│   │   ├── layouter/
│   │   └── patcher/
│   ├── scenes/             # Application layouts
│   ├── i18n/               # Translations
│   └── utils/              # Utility functions
└── tests/                  # Unit tests
```

### Adding Custom Elements

1. Create element class extending `UMLElement`
2. Define visual representation (React component)
3. Register in element registry
4. Add to palette preview
5. Implement custom features if needed

See `docs/dev/adding-another-diagram-type.rst` for detailed guide.

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow coding standards**: ESLint, Prettier, TypeScript strict mode
3. **Write tests** for new features
4. **Update documentation** as needed
5. **Ensure compatibility** with BESSER platform
6. **Submit a pull request** with clear description

For major changes, please open an issue first to discuss the proposed changes.

### Coding Standards
- Use TypeScript strict mode
- Follow React best practices
- Write descriptive commit messages
- Add JSDoc comments for public APIs
- Maintain test coverage above 80%

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Resources

- **Documentation**: [https://besser-docs.readthedocs.io](https://besser-docs.readthedocs.io)
- **Online Editor**: [https://editor.besser-pearl.org](https://editor.besser-pearl.org)
- **BESSER Platform**: [https://github.com/BESSER-PEARL/BESSER](https://github.com/BESSER-PEARL/BESSER)
- **Issue Tracker**: [https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor/issues](https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor/issues)
- **NPM Package**: [@besser/web-modeling-editor](https://www.npmjs.com/package/@besser/web-modeling-editor)

## About BESSER

BESSER (Building bEtter Smart Software fastER) is a low-code platform designed for rapid software development using B-UML as its core modeling language. The platform emphasizes:

- **Model-Driven Engineering**: Design first, code follows
- **Code Generation**: Automatic transformation to multiple targets
- **Extensibility**: Plugin architecture for custom generators
- **Open Source**: Community-driven development

For more information, visit the [official BESSER documentation](https://github.com/BESSER-PEARL/BESSER) or explore the [BESSER GitHub repository](https://github.com/BESSER-PEARL/BESSER).
