Templates and assets
====================

Kick-start diagrams using the curated template gallery and custom asset support.
This section explains how templates are organised in the repository and how to
augment them.

Template gallery
----------------

* Access the gallery via ``File → Start from Template``.
* Templates are defined under :file:`packages/webapp/src/main/templates` as JSON
  descriptors pointing to preview images and initial diagram payloads.
* Choosing a template creates a new diagram populated with canonical elements,
  layout, and metadata.

Managing templates
------------------

Adding a new template
    1. Place preview images in :file:`packages/webapp/src/main/templates/assets`.
    2. Create a JSON descriptor containing ``title``, ``description``, ``preview``
       path, and ``model`` reference.
    3. Export the descriptor from ``templates/index.ts`` so it appears in the
       gallery.
    4. Run ``npm run build:webapp`` to bundle updated assets.
Updating templates
    Modify the JSON descriptor or source diagram and rebuild. The build pipeline
    copies template assets into the final bundle.

Custom palette assets
---------------------

The editor leverages ``@besser/wme`` palettes. To customise icons or element
metadata:

* Extend the palette definitions in :file:`packages/editor`.
* Update the React components under ``packages/webapp/src/main/components`` to
  surface new controls.
* Rebuild the shared package (``npm run build:shared``) so the changes propagate
  to both the webapp and server.

Asset storage considerations
----------------------------

* Static assets (images, fonts) are bundled via Webpack. Importing them in
  components ensures they are hashed and cached efficiently.
* Template previews should remain lightweight (PNG or JPEG) to minimise bundle
  size.
* When using external asset CDNs, reference absolute URLs in the template
  descriptors.

Syncing with the backend
------------------------

Templates do not require server-side configuration. The collaboration server
stores and serves diagrams agnostic of their origin. However, when introducing
new notation types, ensure backend validation logic (if any) recognises the new
shapes to avoid rejection during persistence.

Next steps
----------

Continue with :doc:`collaboration` to learn how diagrams can be shared, reviewed,
and versioned via the server.
