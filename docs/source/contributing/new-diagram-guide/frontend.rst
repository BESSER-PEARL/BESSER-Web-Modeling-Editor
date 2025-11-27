Frontend Implementation
=======================

This section covers the changes required in the React/TypeScript frontend to support a new diagram type.

1. Define the Diagram and Elements
----------------------------------

First, register the new types in the editor's core definitions.

*   **Diagram Type**: Add to ``packages/editor/src/main/packages/diagram-type.ts``.

    .. code-block:: typescript

        export enum UMLDiagramType {
          // ...
          MyNewDiagram = 'MyNewDiagram',
        }

*   **Element Types**: Add to ``packages/editor/src/main/uml-element-type.ts``.

    .. code-block:: typescript

        export enum UMLElementType {
          // ...
          MyNewElement = 'MyNewElement',
        }

2. Create the Diagram Package
-----------------------------

Create a new directory: ``packages/editor/src/main/packages/my-new-diagram``.

a. The Element Class (``my-new-diagram-element.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Define the model for your element, including default size and styling.

.. code-block:: typescript

    import { UMLElement } from '../../services/uml-element/uml-element';
    import { UMLElementType } from '../../uml-element-type';

    export class MyNewElement extends UMLElement {
      type = UMLElementType.MyNewElement;
      bounds = { x: 0, y: 0, width: 100, height: 50 };
      
      // Define specific properties if needed
    }

b. The React Component (``my-new-diagram-component.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Create the visual representation.

.. code-block:: tsx

    import React from 'react';
    import { UMLElementComponentProps } from '../../services/uml-element/uml-element-component-props';

    export const MyNewElementComponent: React.FC<UMLElementComponentProps> = ({ element }) => (
      <g>
        <rect width={element.bounds.width} height={element.bounds.height} stroke="black" fill="white" />
        <text x={10} y={20}>{element.name}</text>
      </g>
    );

c. The Palette Preview (``my-new-diagram-preview.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This defines how the element appears in the sidebar palette.

.. code-block:: typescript

    import { UMLElementType } from '../../uml-element-type';
    import { PreviewElement } from '../../services/uml-element/preview-element';

    export const composeMyNewDiagramPreview = (t: (key: string) => string): PreviewElement[] => [
      {
        type: UMLElementType.MyNewElement,
        name: t('packages.MyNewDiagram.MyNewElement'),
        // Optional: specific styles for the preview
      },
    ];

3. Register Everything
----------------------

Now wire it all together in the central registries.

*   **Components**: In ``packages/editor/src/main/packages/components.ts``:

    .. code-block:: typescript
    
        import { MyNewElementComponent } from './my-new-diagram/my-new-diagram-component';
        // ...
        [UMLElementType.MyNewElement]: MyNewElementComponent,

*   **Elements**: In ``packages/editor/src/main/packages/uml-elements.ts``:

    .. code-block:: typescript

        import { MyNewElement } from './my-new-diagram/my-new-diagram-element';
        // ...
        [UMLElementType.MyNewElement]: MyNewElement,

*   **Sidebar Integration**: This is critical for the element to appear in the editor.
    
    1.  Open ``packages/editor/src/main/packages/compose-preview.ts``.
    2.  Import your preview composer:
        ``import { composeMyNewDiagramPreview } from './my-new-diagram/my-new-diagram-preview';``
    3.  Add it to the ``composePreview`` function map (or switch statement).

    4.  **Important**: Also check ``packages/editor/src/main/components/create-pane/create-pane.tsx``.
        Ensure the ``UMLDiagramType.MyNewDiagram`` case is handled to load the correct preview set.

4. Translations
---------------

Add the display name for your element in ``packages/editor/src/main/i18n/en.json`` (and other languages).

.. code-block:: json

    "packages": {
        "MyNewDiagram": {
            "MyNewElement": "My New Element"
        }
    }
