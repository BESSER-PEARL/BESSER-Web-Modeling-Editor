Editor Package
==============

The ``packages/editor`` workspace exports the reusable UML modelling engine as
``@besser/wme``. It is a React + Redux application that renders diagrams inside
an arbitrary DOM container while exposing a programmatic API for consumers to
load models, listen for changes, and react to collaboration events.

Quick start
-----------

.. code-block:: typescript

   import { ApollonEditor, UMLDiagramType, ApollonMode } from '@besser/wme';

   const container = document.getElementById('diagram-root')!;

   const editor = new ApollonEditor(container, {
     type: UMLDiagramType.ClassDiagram,
     mode: ApollonMode.Modelling,
     readonly: false,
     enablePopups: true,
   });

   await editor.nextRender;  # Wait until the internal store is ready

   editor.subscribeToModelChange((model) => {
     console.log('Model updated', model);
   });

   // Later, clean up:
   editor.destroy();

Architecture overview
---------------------

* **Scenes** (`src/main/scenes`) house the top-level React trees. ``Application``
  renders the canvas, sidebar, popups, and theming providers. ``Svg`` is used
  for background exports.
* **Components** (`src/main/components`) encapsulate UI elements such as the
  sidebar palette, draggable layers, keyboard/mouse listeners, and update pane.
* **Packages** (`src/main/packages`) group diagram-specific logic: models,
  React renderers, popups, previews, and relationship definitions per diagram
  type.
* **Services** (`src/main/services`) keep domain logic out of UI components:
  reducers/repositories for UML elements, the ``diagramBridge`` data service,
  the patcher that powers collaboration, settings, and layouters.
* **Redux store** is composed in ``components/store``. ``ModelState`` provides
  transformation helpers between TypeScript models and Redux state.

Consumers interact only with the public API exported from
``src/main/index.ts``. Internal modules may change without notice, so prefer
the documented API surface unless you are contributing to the engine itself.

What to read next
-----------------

* :doc:`api` details the ``ApollonEditor`` options and callbacks.
* :doc:`extending-diagrams` explains how to register new diagram types, elements,
  and palette entries.
* :doc:`diagram-bridge` covers the bridge service used to connect class and
  object diagrams.
