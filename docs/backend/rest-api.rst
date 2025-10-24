REST API
========

The collaboration server exposes a small REST surface under the ``/api``
namespace. All endpoints accept and respond with JSON unless otherwise noted.

Authentication
--------------

* The default deployment does not enforce authentication.
* Apply additional middleware (JWT, OAuth) by extending
  :file:`packages/server/src/main/routes.ts`.

Endpoints
---------

``GET /api/diagrams/:token``
    Retrieves a diagram by share token. When ``?type=svg`` is provided, the server
    converts the diagram to SVG using ``ConversionService`` and returns it with a
    white background.
``POST /api/diagrams/publish``
    Creates or updates a diagram version. Payload structure::

        {
          "diagram": { ... },
          "token": "optional-existing-token"
        }

    Delegates to ``DiagramService.saveDiagramVersion`` which stores the diagram
    and returns the canonical payload with updated metadata.
``DELETE /api/diagrams/:token``
    Removes a specific version from a diagram. Provide ``versionIndex`` in the
    request body. Errors are returned when the index does not exist.
``POST /api/diagrams/:token``
    Updates the metadata (title, description) of a diagram version.
``POST /api/diagrams/pdf``
    Converts an SVG payload to PDF using ``pdfmake``. Expect ``svg``, ``width``,
    and ``height`` in the JSON body. Returns a streamed PDF document.

Headers and CORS
----------------

* CORS is enabled with a permissive configuration allowing standard headers and
  HTTP verbs.
* Clients may send ``Content-Type: application/json`` when posting diagrams.

Error responses
---------------

* ``404`` – diagram token not found.
* ``400`` – validation failure (for example, missing PDF dimensions).
* ``503`` – storage errors or downstream conversion failures.

Rate limiting
-------------

* Storage adapters apply debouncing to reduce write frequency. Add Express-level
  throttling if your deployment requires stricter limits.

Versioning strategy
-------------------

* The API surface is stable. Introduce breaking changes by versioning the path
  (e.g., ``/api/v2``) and updating the webapp accordingly.

Next steps
----------

Read :doc:`storage` to learn how diagrams are persisted behind these endpoints.
