Static hosting
==============

Serve the web application as static assets when collaboration features are not
required. This approach is suitable for training sessions, documentation, or
self-hosted installations focused on offline work.

Build assets
------------

1. Install dependencies with ``npm install``.
2. Set ``APPLICATION_SERVER_VERSION=0`` to signal a front-end-only build.
3. Run ``npm run build:webapp``.
4. The compiled assets appear in :file:`build/webapp`.

Hosting options
---------------

* **Static file servers** – Use ``npx http-server``, nginx, Apache, or Caddy to
  serve the bundle. Point the server root to :file:`build/webapp`.
* **Object storage** – Upload the directory to Amazon S3, Google Cloud Storage,
  or Azure Blob Storage with static website hosting enabled.
* **Content delivery networks** – Pair object storage with CloudFront, Cloudflare,
  or Fastly for global caching.

Configuration tips
------------------

* Set ``DEPLOYMENT_URL`` during build to the final public URL. Example::

    DEPLOYMENT_URL=https://editor.example.com APPLICATION_SERVER_VERSION=0 npm run build:webapp

* Ensure the hosting provider rewrites requests to ``index.html`` (SPA fallback).
* Enable HTTPS to avoid mixed content warnings when embedding diagrams elsewhere.

Limitations
-----------

* Sharing, collaboration, and version history are unavailable without the
  backend.
* Diagram persistence relies on browser storage; clearing the cache removes
  drafts.

Next steps
----------

For collaboration features, follow the :doc:`full-stack` deployment guide.
