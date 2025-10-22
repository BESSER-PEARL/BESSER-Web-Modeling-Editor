# Diagram Bridge Service Documentation

## Overview

The **Diagram Bridge Service** is a core architectural component of the BESSER Web Modeling Editor that enables seamless data sharing between different UML diagram types. It acts as a centralized bridge allowing object diagrams to access and utilize class diagram information, supporting advanced features like inheritance-aware attribute and association management.

## Architecture

### Core Components

```
DiagramBridgeService
├── Data Storage (Memory + localStorage)
├── Class Information Management
├── Inheritance Hierarchy Processing
├── Association Management with Inheritance
└── Utility Methods
```

### Key Interfaces

#### `IClassDiagramData`
```typescript
interface IClassDiagramData {
  elements: Record<string, any>;    // All diagram elements (classes, attributes, etc.)
  relationships: Record<string, any>; // All relationships (inheritance, associations, etc.)
}
```

#### `IClassInfo`
```typescript
interface IClassInfo {
  id: string;                    // Unique class identifier
  name: string;                  // Class name
  attributes: IAttributeInfo[];  // All attributes (including inherited)
}
```

#### `IAttributeInfo`
```typescript
interface IAttributeInfo {
  id: string;    // Unique attribute identifier
  name: string;  // Attribute name
}
```

#### `IAssociationInfo`
```typescript
interface IAssociationInfo {
  id: string;              // Unique association identifier
  name?: string;           // Optional association name
  source: {                // Source end of association
    element: string;       // Source class ID
    role?: string;         // Role name at source end
    multiplicity?: string; // Multiplicity at source end
  };
  target: {                // Target end of association
    element: string;       // Target class ID
    role?: string;         // Role name at target end
    multiplicity?: string; // Multiplicity at target end
  };
}
```

## Features

### 1. Hybrid Data Storage

The service implements a dual-layer storage approach:

- **Primary Storage**: In-memory storage for fast access during active sessions
- **Backup Storage**: localStorage persistence with key `besser-class-diagram-bridge-data`
- **Automatic Fallback**: If memory storage is empty, automatically loads from localStorage

```typescript
// Storage key used in localStorage
private readonly STORAGE_KEY = 'besser-class-diagram-bridge-data';

// Memory storage
private classDiagramData: IClassDiagramData | null = null;
```

### 2. Inheritance-Aware Attribute Management

The service provides sophisticated inheritance support for class attributes:

#### Key Features:
- **Recursive Inheritance Traversal**: Automatically collects attributes from parent classes
- **Cycle Detection**: Prevents infinite loops in circular inheritance scenarios
- **Proper Ordering**: Parent class attributes appear before child class attributes
- **Duplicate Prevention**: Ensures unique attributes across the hierarchy

#### Implementation Details:
```typescript
private getAllAttributesWithInheritance(classId: string, data: IClassDiagramData): IAttributeInfo[]
```

**Inheritance Relationship Logic:**
- `source = child class` (inherits from)
- `target = parent class` (is inherited by)

**Process:**
1. Start with the target class
2. Collect its direct attributes
3. Find inheritance relationships where `currentClassId` is the source
4. Recursively collect attributes from parent classes (targets)
5. Remove duplicates and return unified attribute list

### 3. Enhanced Association Management with Inheritance

The service supports inheritance-aware association discovery:

#### Capabilities:
- **Direct Associations**: Finds associations directly between two classes
- **Inherited Associations**: Discovers associations available through inheritance
- **Bidirectional Support**: Handles associations in both directions
- **Type Filtering**: Excludes inheritance relationships from association results

#### Algorithm:
```typescript
getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[]
```

**Process:**
1. Get complete inheritance hierarchy for both source and target classes
2. Check all combinations of classes in both hierarchies
3. Filter for association-type relationships (exclude inheritance)
4. Remove duplicates
5. Return unified association list

**Example Scenario:**
```
Person ←─ Author (inheritance)
  │
  └─── School (association)

When creating links between Author and School objects:
- Direct check: Author ↔ School (may not exist)
- Inherited check: Person ↔ School (found!)
- Result: Author objects can use Person's association with School
```

### 4. Complete Hierarchy Management

#### `getAllClassesInHierarchy(classId: string): string[]`
Returns all classes in the inheritance hierarchy (parents, children, and the class itself):

- **Parent Traversal**: Follows inheritance relationships upward
- **Child Traversal**: Follows inheritance relationships downward  
- **Comprehensive Coverage**: Includes entire inheritance tree
- **Cycle Prevention**: Avoids infinite loops in complex hierarchies

#### `getClassHierarchy(classId: string): string[]`
Returns the inheritance chain from child to root parent:

```typescript
// For Author extends Person:
getClassHierarchy("author-id") // Returns: ["Author", "Person"]
```

## API Reference

### Core Methods

#### `setClassDiagramData(data: IClassDiagramData): void`
Stores class diagram data in both memory and localStorage.

**Parameters:**
- `data`: Complete class diagram data structure

**Behavior:**
- Immediately stores in memory for fast access
- Persists to localStorage as backup
- Handles storage errors gracefully with warnings

#### `getClassDiagramData(): IClassDiagramData | null`
Retrieves class diagram data with automatic fallback.

**Returns:**
- Class diagram data or `null` if not available

**Behavior:**
- First checks memory storage
- Falls back to localStorage if memory is empty
- Returns `null` if no data is available

#### `getAvailableClasses(): IClassInfo[]`
Extracts all classes with inheritance-aware attributes.

**Returns:**
- Array of class information including inherited attributes

**Features:**
- Filters elements to include only classes
- Enriches each class with complete attribute information
- Handles errors gracefully

#### `getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[]`
Finds all associations between two classes including inherited ones.

**Parameters:**
- `sourceClassId`: ID of the source class
- `targetClassId`: ID of the target class

**Returns:**
- Array of association information

**Features:**
- Includes direct associations between the classes
- Includes associations inherited from parent classes
- Supports bidirectional associations
- Excludes inheritance relationships from results

### Utility Methods

#### `clearDiagramData(): void`
Clears all stored diagram data from memory and localStorage.

#### `hasClassDiagramData(): boolean`
Checks if class diagram data is currently available.

#### `getClassById(classId: string): IClassInfo | null`
Retrieves specific class information by ID.

#### `getRelationshipDisplayName(relationship, sourceObjectName?, targetObjectName?): string`
Generates user-friendly names for relationships.

**Naming Priority:**
1. Explicit relationship name
2. Role names (`sourceRole-targetRole`)
3. Multiplicities (`sourceMultiplicity-targetMultiplicity`)
4. Object names (`sourceObject-targetObject`)
5. Fallback ID (`Association-{first8chars}`)

## Integration

### Application Integration

The service integrates with the main application through several touch points:

#### `public/index.ts`
```typescript
// Called when uploading class diagrams
function uploadClassDiagramFromFile(file: File) {
  // ... file processing ...
  diagramBridge.setClassDiagramData(data);
}

// Called when saving class diagrams
function save() {
  if (currentDiagramType === 'ClassDiagram') {
    diagramBridge.setClassDiagramData(getCurrentDiagramData());
  }
}

// Called when switching diagram types
function onChange(diagramType: string) {
  if (previousDiagramType === 'ClassDiagram') {
    diagramBridge.setClassDiagramData(getCurrentDiagramData());
  }
}
```

### Component Integration

#### Object Name Component (`uml-object-name-update.tsx`)
```typescript
// Uses service for class selection
const availableClasses = diagramBridge.getAvailableClasses();

// Displays inheritance information
const displayName = `${cls.name} extends ${parentName} (${cls.attributes.length} attrs)`;
```

#### Object Link Component (`uml-object-link-update.tsx`)
```typescript
// Uses service for association discovery
const availableAssociations = diagramBridge.getAvailableAssociations(sourceClassId, targetClassId);
```

## Advanced Features

### Inheritance Support Examples

#### Scenario 1: Simple Inheritance
```
Person (attributes: name, age)
  ↑
Author (attributes: books)
```

**Result:**
- Author objects show: `name`, `age`, `books`
- Display: "Author extends Person (3 attrs)"

#### Scenario 2: Multi-level Inheritance
```
Person (attributes: name, age)
  ↑
Author (attributes: books)
  ↑
Novelist (attributes: genre)
```

**Result:**
- Novelist objects show: `name`, `age`, `books`, `genre`
- Hierarchy: ["Novelist", "Author", "Person"]

#### Scenario 3: Inherited Associations
```
Person ←→ School (association: "studies")
  ↑
Author
```

**Result:**
- Author-School links can use the "studies" association
- Inherited associations appear in link creation dropdowns

### Error Handling

The service implements comprehensive error handling:

#### Storage Errors
```typescript
try {
  localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
} catch (error) {
  console.warn('Failed to persist class diagram data to localStorage:', error);
}
```

#### Data Processing Errors
```typescript
try {
  return Object.values(data.elements || {})
    .filter((element: any) => element.type === 'Class')
    // ... processing ...
} catch (error) {
  console.error('Error extracting classes from diagram data:', error);
  return [];
}
```

#### Inheritance Cycle Prevention
```typescript
const visited = new Set<string>();

const collectHierarchy = (currentClassId: string) => {
  if (visited.has(currentClassId)) {
    return; // Prevent infinite loops
  }
  visited.add(currentClassId);
  // ... continue processing ...
};
```

## Performance Considerations

### Memory Management
- **Singleton Pattern**: Single instance shared across the application
- **Lazy Loading**: Data loaded only when needed
- **Efficient Caching**: Memory storage for frequently accessed data

### Algorithm Efficiency
- **Set-based Deduplication**: O(1) duplicate checking
- **Visited Tracking**: Prevents redundant processing in inheritance traversal
- **Early Termination**: Stops processing invalid or missing data

### Storage Optimization
- **JSON Serialization**: Efficient localStorage storage
- **Fallback Strategy**: Graceful degradation when storage fails
- **Memory First**: Prioritizes fast in-memory access

## Best Practices

### Usage Guidelines

1. **Data Consistency**: Always call `setClassDiagramData()` when class diagrams change
2. **Error Handling**: Check `hasClassDiagramData()` before using other methods
3. **Performance**: Cache results of expensive operations when possible
4. **Memory Management**: The service handles cleanup automatically

### Integration Patterns

1. **Reactive Updates**: Update the bridge when diagram data changes
2. **Lazy Initialization**: Load data only when needed by components
3. **Graceful Degradation**: Components should handle empty results gracefully

## Testing Scenarios

### Test Data Structure
```json
{
  "elements": {
    "person-id": {
      "type": "Class",
      "name": "Person",
      "attributes": ["name-attr-id", "age-attr-id"]
    },
    "author-id": {
      "type": "Class", 
      "name": "Author",
      "attributes": ["books-attr-id"]
    }
  },
  "relationships": {
    "inheritance-id": {
      "type": "ClassInheritance",
      "source": { "element": "author-id" },
      "target": { "element": "person-id" }
    },
    "association-id": {
      "type": "ClassAssociation",
      "source": { "element": "person-id", "role": "student" },
      "target": { "element": "school-id", "role": "school" }
    }
  }
}
```

### Test Cases

1. **Basic Inheritance**: Verify attribute inheritance works correctly
2. **Multi-level Inheritance**: Test deep inheritance chains
3. **Circular Inheritance**: Ensure cycle detection prevents infinite loops
4. **Association Inheritance**: Verify inherited associations are found
5. **Storage Persistence**: Test localStorage fallback functionality
6. **Error Conditions**: Test behavior with malformed data

## Migration Guide

### From localStorage Direct Access

**Before:**
```typescript
const classLibrary = JSON.parse(localStorage.getItem('classLibrary') || '{}');
```

**After:**
```typescript
import { diagramBridge } from '../services/diagram-bridge';
const classData = diagramBridge.getClassDiagramData();
```

### Key Changes
1. **Centralized Access**: All class data access through the service
2. **Enhanced Features**: Automatic inheritance support
3. **Better Error Handling**: Graceful failure modes
4. **Performance Improvements**: Memory caching with localStorage fallback

## Future Enhancements

### Planned Features
1. **Real-time Synchronization**: Live updates across diagram types
2. **Advanced Filtering**: Filter associations by type or properties
3. **Validation**: Data integrity checking and validation
4. **Caching Strategies**: More sophisticated caching mechanisms
5. **Event System**: Notify components of data changes

### Extension Points
1. **Custom Storage Backends**: Support for different storage mechanisms
2. **Data Transformers**: Custom data processing pipelines
3. **Validation Rules**: Configurable data validation
4. **Performance Monitoring**: Built-in performance tracking

## Conclusion

The Diagram Bridge Service represents a significant architectural improvement in the BESSER Web Modeling Editor, providing:

- **Seamless Integration**: Transparent data sharing between diagram types
- **Advanced Inheritance Support**: Full-featured inheritance-aware operations
- **Robust Error Handling**: Graceful failure modes and recovery
- **High Performance**: Efficient algorithms and caching strategies
- **Extensible Design**: Clear extension points for future enhancements

This service enables sophisticated UML modeling scenarios while maintaining simplicity and reliability for end users.
