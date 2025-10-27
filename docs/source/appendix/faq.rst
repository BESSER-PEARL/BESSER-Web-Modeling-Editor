Frequently asked questions
==========================

**Do I need an account to use the editor?**
  No. All modelling features are available without authentication. Collaboration
  features require deploying the server but do not require user accounts.

**Where are my diagrams stored?**
  In static mode, diagrams are stored in browser local storage. With the server,
  diagrams persist in the filesystem (``diagrams/``) or Redis depending on
  configuration.

**Can I export diagrams to SVG/PDF?**
  Yes. Use ``File → Export``. The server provides endpoints for automated exports.

**How do I enable collaboration?**
  Set ``APPLICATION_SERVER_VERSION=1`` and deploy the server. Share links become
  available in the application bar.

**What browsers are supported?**
  Modern Chromium-based browsers and Firefox. The UI warns about known
  limitations (``FirefoxIncompatibilityHint``) when necessary.

**Is there an API?**
  Yes. The server exposes REST endpoints under ``/api`` for retrieving diagrams,
  publishing versions, and exporting PDFs.

**Can I customise templates?**
  Add or edit templates under :file:`packages/webapp/src/main/templates` and run
  ``npm run build:webapp``.

**How do I report a bug?**
  Use GitHub issues or the bug report link in the application bar (see
  ``bugReportURL`` in :file:`packages/webapp/src/main/constant.ts`). Include steps
  to reproduce and exported diagrams if possible.

**How do I upgrade?**
  Pull the latest changes, run ``npm install``, rebuild (``npm run build``), and
  review :doc:`../getting-started/upgrading` for migration notes.

**Can I integrate with the broader BESSER platform?**
  Yes. Export diagram JSON and feed it into BESSER low-code workflows or backend
  services.
