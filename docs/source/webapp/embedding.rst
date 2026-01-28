Embedding the Editor
====================

You can reuse the editor in two different ways:

* embed the bare ``ApollonEditor`` class directly inside another application;
* embed the ready-made React components shipped with the webapp when you need
  the same UX (modals, project sidebar, collaboration widgets).

Using the bare editor
---------------------

Refer to :doc:`../editor/api` for the core ``ApollonEditor`` workflow. This is
the lightest option and gives full control over state management, styling, and
integration points.

Reusing the webapp component
----------------------------

``packages/webapp/src/main/components/apollon-editor-component/ApollonEditorComponent.tsx``
wraps the editor with the Redux slices, autosave logic, and palette that the
standalone application uses. To integrate it into another React host:

1. Install the workspace as a dependency or symlink it via npm workspaces.
2. Mount the ``ApplicationStore`` provider (``components/store/ApplicationStore``)
   at the root of your host application to configure the Redux store and
   persistence.
3. Render ``ApollonEditorComponent`` when you want local editing or
   ``ApollonEditorComponentWithConnection`` when collaboration via WebSockets is
   required.
4. Use the exported hooks in ``components/store/hooks.ts`` to interact with the
   slices (for example, ``useAppDispatch`` and ``useAppSelector``).

Example
-------

.. code-block:: typescript

   import { ApplicationStore } from 'packages/webapp/src/main/components/store/ApplicationStore';
   import { ApollonEditorComponent } from 'packages/webapp/src/main/components/apollon-editor-component/ApollonEditorComponent';

   export function EmbeddedEditor() {
     return (
       <ApplicationStore>
         <ApollonEditorComponent />
       </ApplicationStore>
     );
   }

Collaboration variant
---------------------

``ApollonEditorComponentWithConnection`` (and its flicker-optimised variant)
connect to the Express server via WebSockets. They expect the following inputs:

* ``DEPLOYMENT_URL`` – base URL used to derive the WebSocket endpoint.
* ``APPLICATION_SERVER_VERSION`` – toggles collaboration availability.
* A ``token`` URL parameter (React Router passes it via ``useParams``) that
  identifies the shared diagram to load.

The component subscribes to model and selection patch streams using the editor's
patcher service and debounces incoming changes to prevent flicker.

Styling and layout
------------------

The webapp relies on CSS variables (``--apollon-background``) and global CSS
defined in ``src/main/styles.css``. When embedding components selectively, make
sure these variables are set in your host application or import the stylesheet.

When extending the layout, prefer using the existing components (application bar
and sidebar) to stay consistent with the standalone experience.
