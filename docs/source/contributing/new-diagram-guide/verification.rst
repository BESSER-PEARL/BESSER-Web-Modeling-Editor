Verification
============

Once you have implemented both the frontend and backend parts, follow these steps to verify your new diagram type.

1. Frontend Verification
------------------------

1.  Start the web application:
    
    .. code-block:: bash

        npm run start --workspace=webapp

2.  Open the editor in your browser.
3.  Create a new project and select "MyNewDiagram" as the type.
4.  Verify that the **Palette** shows your new element(s).
5.  Drag an element onto the **Canvas**.
6.  Ensure it renders correctly and you can move/resize it.

2. Backend Verification
-----------------------

1.  Ensure the backend server is running (usually started with ``npm run start:server`` or via Docker).
2.  In the editor, trigger a **Generate** action (or a custom button associated with your diagram).
3.  Verify that the backend receives the JSON payload.
4.  Check the backend logs to confirm that your ``process_my_new_diagram`` function is called.
5.  Verify that the output (code or model) is generated correctly.
