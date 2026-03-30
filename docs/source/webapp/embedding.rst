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

``packages/webapp2/src/main/features/editors/uml/ApollonEditorComponent.tsx``
wraps the editor with the Redux slices, autosave logic, and palette that the
standalone application uses. To integrate it into another React host:

1. Install the workspace as a dependency or symlink it via npm workspaces.
2. Mount the ``ApplicationStore`` provider (``app/store/application-store``)
   at the root of your host application to configure the Redux store and
   persistence.
3. Render ``ApollonEditorComponent`` inside the store provider.
4. Use the exported hooks in ``hooks/`` to interact with the
   slices (for example, ``useAppDispatch`` and ``useAppSelector``).

Example
-------

.. code-block:: tsx

   import { ApplicationStore } from 'packages/webapp2/src/main/app/store/application-store';
   import { ApollonEditorComponent } from 'packages/webapp2/src/main/features/editors/uml/ApollonEditorComponent';

   export function EmbeddedEditor() {
     return (
       <ApplicationStore>
         <ApollonEditorComponent />
       </ApplicationStore>
     );
   }

Collaboration
-------------

Real-time collaboration is handled at the application level through WebSocket
connections to the Express server. When embedding the editor, collaboration
features are available if the ``APPLICATION_SERVER_VERSION`` environment variable
is set and the server is running. The editor uses JSON Patch streams for
synchronizing diagram changes between participants.

Styling and layout
------------------

The webapp relies on CSS variables (``--apollon-background``) and global CSS
defined in ``src/main/styles.css``. When embedding components selectively, make
sure these variables are set in your host application or import the stylesheet.

When extending the layout, prefer using the existing components (application bar
and sidebar) to stay consistent with the standalone experience.
