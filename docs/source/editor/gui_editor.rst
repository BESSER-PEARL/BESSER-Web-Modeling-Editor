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
* **Navigation Map**: A read-only graph of the GUI's pages and the links between them.

Usage
-----

1.  **Create a Project**: Start a new project and select "GUI" as the diagram type.
2.  **Drag Components**: Open the Block Manager (usually on the right) and drag elements like "Text", "Image", "Link", or "Grid" onto the canvas.
3.  **Style Elements**: Select an element on the canvas and use the Style Manager to adjust its appearance.
4.  **Preview**: Switch to preview mode to see how your interface behaves.

Navigation Map
--------------

The **Map** button next to **Add Page** in the Pages panel opens a map of the GUI's pages and the links between them. The map is read-only: links are changed on the pages themselves.

* **Links are resolved like the generated app**: a navigate button points at its target page by id, and an ``<a href>`` link points at the page whose route matches. A page's route is ``/`` followed by its lowercased name, with spaces as hyphens, and ``/`` is the first page (the start page).
* **Navigation bar hub**: links inside a nav bar or footer appear on every page, so they are grouped into one *Navigation bar* node instead of being drawn from each page.
* **Layout**: pages are arranged in columns by the number of clicks from the start page.
* **Needs attention**: lists pages that no link reaches and links that point to a page that does not exist.
* **Navigation**: clicking a page opens it in the editor; clicking a broken link opens its page with the link selected.

Integration
-----------

The GUI Editor is integrated into the BESSER Web Modeling Editor via the ``GraphicalUIEditor`` component. It wraps the GrapesJS editor instance and handles the persistence of the designed template.
