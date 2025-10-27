Troubleshooting
===============

Common issues and how to resolve them.

Editor fails to load
--------------------

* Verify static assets are served correctly and that the SPA fallback rewrites
  unknown routes to ``index.html``.
* Check browser console for missing environment variables or blocked requests.

Share links return 404
----------------------

* Ensure the collaboration server is running and has access to the ``diagrams``
  directory or Redis instance.
* Confirm ``DEPLOYMENT_URL`` matches the origin used to generate links.

WebSocket connection errors
---------------------------

* Verify reverse proxies forward ``Upgrade`` and ``Connection`` headers.
* Check firewall rules and load balancer settings for port 8080 (or custom port).
* Review server logs for heartbeat timeouts triggered by ``CollaborationService``.

PDF export fails
----------------

* Confirm the server has ``node-canvas`` dependencies installed (libcairo,
  pango, etc.).
* Ensure the export payload includes ``width`` and ``height``.

Redis errors
------------

* Verify RedisJSON module is enabled.
* Check credentials and network access in ``APOLLON_REDIS_URL``.
* Inspect TTL values when diagrams expire earlier than expected.

UI glitches after upgrade
-------------------------

* Clear browser cache or use hard reload (``Ctrl+Shift+R``).
* Rebuild the webapp to ensure template and style changes are bundled.

Need more help?
---------------

Reach out via the support channels listed in :doc:`../operations/support`.
