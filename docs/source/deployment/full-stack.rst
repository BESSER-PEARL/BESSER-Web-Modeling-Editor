Full-stack deployment
=====================

Deploy the webapp and collaboration server together to unlock sharing, version
history, and export pipelines.

Manual setup on Linux
---------------------

#. Clone the repository and install dependencies::

     git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
     cd BESSER-WEB-MODELING-EDITOR
     npm install

#. Configure environment variables::

     export APPLICATION_SERVER_VERSION=1
     export DEPLOYMENT_URL=https://editor.example.com

#. Build the workspace::

     npm run build

#. Create a system user and diagram directory::

     sudo useradd -r -s /bin/false besser_wme_standalone
     mkdir -p /var/lib/besser-wme/diagrams
     chown -R besser_wme_standalone /var/lib/besser-wme

#. Copy build artefacts to a deployment directory and adjust permissions.
#. Install the systemd unit (:file:`BESSER_WME_Standalone.service`) and update
   paths to match your installation.
#. Start the service::

     sudo systemctl daemon-reload
     sudo systemctl enable besser_wme_standalone
     sudo systemctl start besser_wme_standalone

Cron jobs
---------

* Install ``delete-stale-diagrams.cronjob.txt`` to remove outdated diagrams.
* Tail ``/var/log/cron.log`` to verify execution.

Reverse proxy configuration
---------------------------

* Place nginx or Traefik in front of the Node.js server to terminate TLS and
  route traffic.
* Proxy WebSocket upgrades by forwarding ``Upgrade`` and ``Connection`` headers.
* Enable gzip compression for static assets.

Redis-backed deployments
------------------------

* Install Redis with RedisJSON enabled.
* Set ``APOLLON_REDIS_URL`` (and optionally ``APOLLON_REDIS_DIAGRAM_TTL``) before
  starting the server.
* Use ``APOLLON_REDIS_MIGRATE_FROM_FILE`` during the first start to migrate
  existing filesystem diagrams.

Testing the deployment
----------------------

* Visit ``https://editor.example.com`` and verify login-free access to the
  editor.
* Publish a diagram and confirm that share links load successfully in a private
  browser window.
* Run ``npm run lint`` and ``npm run build`` locally before promoting changes to
  production.

Next steps
----------

Use the :doc:`docker` guide for container-based deployments or
:doc:`scaling` for larger installations.
