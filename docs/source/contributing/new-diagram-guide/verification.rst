Verification
============

Once you have implemented both the frontend and backend parts, follow these steps to verify your new diagram type.

1. Frontend Verification
------------------------

1.  Start the web application:
    
    .. code-block:: bash

        npm run dev

2.  Open the editor in your browser.
3.  Create a new project and select "MyNewDiagram" as the type.
4.  Verify that the **Palette** shows your new element(s).
5.  Drag an element onto the **Canvas**.
6.  Ensure it renders correctly and you can move/resize it.

2. Backend Verification
-----------------------

1.  Ensure the BESSER backend server is running:

    .. code-block:: bash

        python besser/utilities/web_modeling_editor/backend/backend.py

    The default port is ``9000`` (``http://localhost:9000/besser_api``).
2.  In the editor, trigger a **Generate** action (or a custom button associated with your diagram).
3.  Verify that the backend receives the JSON payload.
4.  Check the backend logs to confirm that your ``process_my_new_diagram`` function is called.
5.  Verify that the output (code or model) is generated correctly.

3. Run Automated Checks
------------------------

Before opening a pull request, run the full automated check suite:

.. code-block:: bash

    npm run lint
    npm run test
    npm run build

This verifies linting, unit tests, and production build all pass with your changes.

.. note::
   The standalone Node/Express server (``npm run start:server``) serves built webapp2 assets and a small set of ``/api``
   routes, but code generation and validation still rely on the BESSER backend.
