GUI Editor
==========

The GUI Editor enables the visual design of graphical user interfaces for BESSER applications. It leverages the power of **GrapesJS**, a popular open-source web builder framework, to provide a rich, drag-and-drop editing experience.

Features
--------

* **Visual Canvas**: A WYSIWYG (What You See Is What You Get) canvas where you can design your UI.
* **Component Library**: A set of standard HTML/CSS components (Blocks) that can be dragged onto the canvas.
* **Style Manager**: A panel to style selected components (typography, dimensions, decorations, etc.) without writing CSS manually.
* **Layer Manager**: View and manage the hierarchy of DOM elements on your page.
* **Code Export**: View and export the generated HTML and CSS code.

Usage
-----

1.  **Create a Project**: Start a new project and select "GUI" as the diagram type.
2.  **Drag Components**: Open the Block Manager (usually on the right) and drag elements like "Text", "Image", "Link", or "Grid" onto the canvas.
3.  **Style Elements**: Select an element on the canvas and use the Style Manager to adjust its appearance.
4.  **Preview**: Switch to preview mode to see how your interface behaves.

Integration
-----------

The GUI Editor is integrated into the BESSER Web Modeling Editor via the ``GraphicalUIEditor`` component. It wraps the GrapesJS editor instance and handles the persistence of the designed template.
