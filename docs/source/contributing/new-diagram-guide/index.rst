Adding a New Diagram Type
=========================

This guide provides a comprehensive walkthrough for adding a new diagram type to the BESSER web modeling editor. It covers the entire stack: from the frontend UI (React/TypeScript) to the backend processing (Python/FastAPI).

Adding a new diagram involves changes in three main areas:

1.  **Editor Package**: Defining the metamodel, rendering components, and palette configuration.
2.  **Web Application**: Ensuring the new diagram type is recognized by the project store (if needed).
3.  **Backend**: Creating a processor to convert the diagram JSON into BUML objects for code generation.

.. toctree::
   :maxdepth: 1
   :caption: Steps

   frontend
   backend
   verification
