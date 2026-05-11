Frontend Implementation
=======================

This section covers the changes required in the React/TypeScript frontend to
support a new diagram type. The frontend engine lives in ``packages/library``
and is built on React Flow + Zustand.

If the diagram type already exists in the library package and you only need to
expose it in the webapp project UI, skip to the **Webapp wiring** step below
and follow ``packages/webapp/src/main/features/project/ADDING_NEW_DIAGRAM_TYPE.md``.

1. Define the Diagram and Node Data Shapes
------------------------------------------

First, register the new diagram type and its node data shapes in the
library's type definitions.

*   **Diagram Type**: Add to ``packages/library/lib/types/DiagramType.ts``.

    .. code-block:: typescript

        export enum UMLDiagramType {
          // ...
          MyNewDiagram = 'MyNewDiagram',
        }

*   **Node Data Shapes**: Define one type per node in
    ``packages/library/lib/types/nodes/NodeProps.ts``. Extend
    ``DefaultNodeProps`` so every node automatically inherits ``name``,
    ``fillColor``, ``strokeColor``, and ``textColor``.

    .. code-block:: typescript

        export type MyNewElementNodeProps = DefaultNodeProps & {
          // Add any custom fields the inspector needs to expose:
          description?: string;
        };

*   **Edge Data Shapes** (if applicable): Add the new edge type in
    ``packages/library/lib/edges/EdgeProps.ts`` and pick a v4 ``edge.type``
    string (e.g. ``MyNewEdge``).

2. Create the Node Components
-----------------------------

Create a new directory: ``packages/library/lib/nodes/myNewDiagram/``.

a. The Node Component (``MyNewElement.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

React Flow nodes are plain React components wrapped in ``DefaultNodeWrapper``
(which provides the selection / drag handles). Render the visuals as SVG
inside the wrapper.

.. code-block:: tsx

    import { NodeProps, NodeResizer, type Node } from '@xyflow/react';
    import { useRef } from 'react';
    import { DefaultNodeWrapper } from '../wrappers';
    import { useHandleOnResize } from '@/hooks';
    import { useDiagramModifiable } from '@/hooks/useDiagramModifiable';
    import { PopoverManager } from '@/components/popovers/PopoverManager';
    import { NodeToolbar } from '@/components/toolbars/NodeToolbar';
    import { MyNewElementNodeProps } from '@/types';
    import { LAYOUT } from '@/constants';
    import { getCustomColorsFromData } from '@/utils/layoutUtils';

    export function MyNewElement({
      id, width, height, data, parentId,
    }: NodeProps<Node<MyNewElementNodeProps>>) {
      const wrapperRef = useRef<HTMLDivElement | null>(null);
      const { onResize } = useHandleOnResize(parentId);
      const isDiagramModifiable = useDiagramModifiable();
      if (!width || !height) return null;

      const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data);

      return (
        <DefaultNodeWrapper width={width} height={height} elementId={id}>
          <NodeToolbar elementId={id} />
          <NodeResizer
            isVisible={isDiagramModifiable}
            onResize={onResize}
            minWidth={100}
            minHeight={50}
            handleStyle={{ width: 8, height: 8 }}
          />
          <div ref={wrapperRef}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible">
              <rect
                x={0} y={0} width={width} height={height}
                fill={fillColor} stroke={strokeColor}
                strokeWidth={LAYOUT.LINE_WIDTH}
              />
              <text x={width / 2} y={height / 2 + 5} textAnchor="middle" fill={textColor}>
                {data.name}
              </text>
            </svg>
          </div>
          <PopoverManager
            anchorEl={wrapperRef.current}
            elementId={id}
            type={'MyNewElement' as never}
          />
        </DefaultNodeWrapper>
      );
    }

b. The Diagram ``index.ts``
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Each diagram folder has an ``index.ts`` that maps v4 ``node.type`` strings to
node components. Register your node there:

.. code-block:: typescript

    // packages/library/lib/nodes/myNewDiagram/index.ts
    import { MyNewElement } from './MyNewElement';

    export const myNewDiagramNodes = {
      MyNewElement,
    };

The library's root ``App.tsx`` merges every per-diagram map into the
``nodeTypes`` it passes to React Flow; add yours to that union.

3. Add the Inspector Panel
--------------------------

Inspector panels live under
``packages/library/lib/components/inspectors/<diagramType>/``. Mirror the
naming pattern of the existing panels (e.g. ``ClassEditPanel``,
``StateEditPanel``):

.. code-block:: tsx

    // packages/library/lib/components/inspectors/myNewDiagram/MyNewElementEditPanel.tsx
    import { Box } from '@mui/material';
    import React from 'react';
    import { useShallow } from 'zustand/shallow';
    import { useDiagramStore } from '@/store/context';
    import { MyNewElementNodeProps } from '@/types';
    import { NodeStyleEditor } from '@/components/ui';
    import { PopoverProps } from '@/components/popovers/types';

    export const MyNewElementEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
      const { nodes, setNodes } = useDiagramStore(
        useShallow((state) => ({ nodes: state.nodes, setNodes: state.setNodes }))
      );
      const node = nodes.find((n) => n.id === elementId);
      if (!node) return null;

      const data = node.data as MyNewElementNodeProps;
      const handleDataFieldUpdate = (key: string, value: string) => {
        setNodes((all) =>
          all.map((n) =>
            n.id === elementId ? { ...n, data: { ...n.data, [key]: value } } : n
          )
        );
      };

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <NodeStyleEditor nodeData={data as never} handleDataFieldUpdate={handleDataFieldUpdate} />
        </Box>
      );
    };

Register the panel in
``packages/library/lib/components/inspectors/myNewDiagram/index.ts`` so the
popover router can find it by ``node.type``.

4. Add the Palette Preview
--------------------------

Drag-source previews live in
``packages/library/lib/components/svgs/nodes/<diagramType>/<YourDiagram>SVGs.tsx``.
Each is a plain SVG component used both in the sidebar palette and on the
drag ghost. Match the canvas card's visual style so the dropped node looks
identical to the preview.

5. Route the Popover
--------------------

Add a ``case 'MyNewElement':`` to
``packages/library/lib/components/popovers/PopoverManager.tsx`` so the
popover host renders ``MyNewElementEditPanel`` when a node of that type is
selected.

6. Handle Legacy Fixtures (optional)
------------------------------------

If users have v3 fixtures with your new element kind, add a ``case
'MyNewElement':`` to
``packages/library/lib/utils/versionConverter.ts``'s ``convertV3NodeDataToV4``
so the migrator lifts the v3 element to the canonical v4 shape on load.

7. Translations
---------------

Inspector and palette labels are currently inline strings in the component
sources. Cross-diagram localisation lives at the webapp layer
(``packages/webapp/src/main/i18n/``); add new keys there if you need to
expose a localised label to webapp UI components.

8. Webapp wiring (project UI)
-----------------------------

Once the library knows how to render the new diagram, expose it in the
webapp:

* Update the project model, sidebar, import/export labels, and settings badges.
* Follow the checklist in
  ``packages/webapp/src/main/features/project/ADDING_NEW_DIAGRAM_TYPE.md``.
* Verify that creating a new project includes the new diagram slot.
