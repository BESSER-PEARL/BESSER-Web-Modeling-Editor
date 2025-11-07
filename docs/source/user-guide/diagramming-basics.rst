Diagramming basics
==================

The modelling canvas is powered by ``@besser/wme`` and exposes a familiar set of
interaction patterns. This guide covers navigation, creation, editing, and
validation workflows.

Navigating the canvas
---------------------

* **Pan** by dragging the background with the left mouse button or holding the
  space bar.
* **Zoom** using the mouse wheel, trackpad pinch, or ``Ctrl +`` / ``Ctrl -``.
* **Reset view** through the view controls in the application bar.

Creating elements
-----------------

Palettes
    Each diagram type exposes a tailored palette containing nodes, edges, and
    annotations. Select ``File → New`` to switch diagram types; the palette will
    refresh automatically.
Drag and drop
    Drag items from the palette onto the canvas to instantiate them. ``@besser/wme``
    auto-places connectors and manages default sizing.
Keyboard shortcuts
    Use ``Ctrl+C`` / ``Ctrl+V`` to duplicate elements, ``Delete`` to remove, and
    ``Shift`` plus arrow keys to nudge positions precisely.

Connecting shapes
-----------------

* Hover over an element to reveal connection handles.
* Drag from a handle to another element to create a relationship.
* Auto-layout rules position the edge using orthogonal routing. Adjust via
  waypoints if manual control is required.

Formatting and styling
----------------------

Inline editors
    Double-click on labels to edit text in place. The formatting toolbar allows
    emphasis, alignment, and colour adjustments.
Theme switching
    Toggle between light and dark theme from the application bar. The preference
    is persisted in local storage (see constants in
    :file:`packages/webapp/src/main/constant.ts`).
Custom colours
    Select elements and use the inspector to change fill, stroke, and text
    colours. Styles update in real time on the canvas.

Managing layers and selections
------------------------------

Multi-select
    Hold ``Shift`` while clicking to select multiple items. Dragging with the
    marquee tool selects all elements within the bounding box.
Grouping
    Group related elements to move them together. The context menu exposes group
    and ungroup options.
Alignment guides
    Smart guides appear during drag operations to help align shapes. Use the
    alignment tools to snap to grid or evenly distribute nodes.

Validation and feedback
-----------------------

* Inline validation markers appear when relationships violate notation rules.
* The notification tray lists unresolved issues with quick navigation links.
* Use ``Ctrl+Z`` / ``Ctrl+Y`` for undo and redo support when experimenting.

Saving work
-----------

Local storage
    The editor periodically saves diagrams to browser storage, keyed by
    ``localStorageDiagramPrefix``. Recent diagrams are listed in ``HomeModal``.
Server persistence
    When collaboration is enabled, diagrams are saved through the REST API
    (:doc:`../backend/rest-api`). Version history is managed automatically.

Next steps
----------

Continue with :doc:`templates-and-assets` to explore reusable starting points
and asset libraries.
