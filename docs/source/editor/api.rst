ApollonEditor API
=================

The ``ApollonEditor`` class is the primary entry point exported by
``@besser/wme``. Instantiate it with a DOM container and a set of options, then
use the provided methods and subscriptions to tailor the editor to your
application.

Initialisation
--------------

.. code-block:: typescript

   import { ApollonEditor, UMLDiagramType, ApollonMode, Locale } from '@besser/wme';

   const editor = new ApollonEditor(containerElement, {
     type: UMLDiagramType.ClassDiagram,
     mode: ApollonMode.Modelling,
     readonly: false,
     enablePopups: true,
     locale: Locale.en,
   });

   await editor.nextRender;

Call ``await editor.nextRender`` before accessing the internal Redux store or
subscribing to events; it resolves after the first React render cycle finishes.

Constructor options
-------------------

``type`` (:ref:`UMLDiagramType <editor-extending-diagrams>`)
   Initial diagram palette to display. Required when the model does not define a
   ``type``.

``mode`` (``ApollonMode``)
   Determines toolbar behaviour. ``Modelling`` unlocks editing, ``Exporting``
   exposes export views, ``Assessment`` limits interactions to assessment tools.

``readonly`` (boolean)
   Disables palette actions, movement, and editing when set to ``true``. The
   sidebar remains visible but locked.

``enablePopups`` (boolean, default ``true``)
   Controls whether double-click popups (attribute editors, relationship menus)
   appear.

``copyPasteToClipboard`` (boolean)
   Enables the legacy browser clipboard integration.

``colorEnabled`` (boolean)
   Activates colour-aware palette entries and the optional colour legend.

``locale`` (``Locale`` enum)
   Localises UI strings using ``src/main/i18n`` resources. Defaults to English.

``theme`` (partial ``Styles``)
   Overrides the default theming tokens. Accepts the ``Styles`` structure from
   ``components/theme/styles``.

``scale`` (number)
   Sets the initial zoom value. Equivalent to the Zoom slider in the UI.

``model`` (``UMLModel``)
   Pre-loads an existing diagram. When not provided, the editor initialises an
   empty diagram of the requested type.

Model management
----------------

``editor.model`` (getter)
   Returns the current ``UMLModel`` representation.

``editor.model = umlModel`` (setter)
   Replaces the diagram with the provided model and resets interaction state.

``editor.type = UMLDiagramType`` (setter)
   Switches the active palette to another diagram type and clears the canvas.

``editor.locale = Locale`` (setter)
   Re-renders the UI with the requested translations.

``editor.select(selection)`` (method)
   Programmatically select/deselect elements by ID using the ``Selection`` type.

Subscriptions
-------------

All subscription methods return a numeric ID; pass the same ID to the matching
``unsubscribe`` call.

``subscribeToModelChange`` / ``unsubscribeFromModelChange``
   Fires after debouncing when the model changes. Use it to autosave diagrams.

``subscribeToModelDiscreteChange``
   Notified only at the end of an interaction (mouse up, delete). Helpful when
   you care about completed user actions rather than intermediate drag events.

``subscribeToModelChangePatches`` /
``subscribeToAllModelChangePatches`` /
``subscribeToModelContinuousChangePatches``
   Emit JSON Patch objects describing changes. ``All`` delivers both continuous
   and discrete patches; ``Continuous`` surfaces high frequency updates during a
   drag; ``ModelChange`` limits to discrete updates. Use
   ``unsubscribeFromModelChangePatches`` to remove any of them.

``subscribeToSelectionChange`` / ``unsubscribeFromSelectionChange``
   Track element and relationship selection.

``subscribeToAssessmentChange`` / ``unsubscribeFromAssessmentChange``
   Observe the set of assessment annotations in the model.

``subscribeToApollonErrors`` / ``unsubscribeToApollonErrors``
   Listen for unexpected runtime errors. The editor attempts to recover to the
   latest known state, but the callback lets you escalate the failure.

Collaboration helpers
---------------------

``importPatch(patch)``
   Applies a JSON Patch (as emitted by ``subscribeTo…Patches``) to the current
   model.

``remoteSelect(name, color, selectIds, deselectIds?)``
   Mirrors remote selections inside the canvas using coloured cursors.

``pruneRemoteSelectors(allowedSelectors)``
   Remove remote cursors that are no longer active.

Exports
-------

``exportAsSVG(options?)``
   Renders the in-memory model to an SVG string and associated bounding box.

``ApollonEditor.exportModelAsSvg(model, options?, theme?)``
   Static helper to export a ``UMLModel`` without instantiating the editor UI.

``getScaleFactor()``
   Returns the current zoom factor applied to the canvas.

Lifecycle
---------

``destroy()``
   Unmounts React components and releases resources tied to the container.
   Always call ``destroy`` when discarding the editor instance.

``nextRender`` (promise)
   Resolves after the editor finishes its current render pass. Await it before
   calling any subscription APIs from freshly created instances.
