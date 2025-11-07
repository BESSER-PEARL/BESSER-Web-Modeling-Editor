Docker deployment
=================

Container images simplify packaging and scaling the standalone editor. The
repository includes Dockerfiles and Compose manifests for common scenarios.

Dockerfiles
-----------

``Dockerfile``
    Builds the webapp and server into a single image with filesystem storage.
``Dockerfile.redis``
    Extends the base image with Redis configuration and environment defaults.

Building an image
-----------------

::

  docker build -t besser-wme-standalone .

Run with filesystem storage
---------------------------

::

  docker run -d --name besser-wme \
    -e APPLICATION_SERVER_VERSION=1 \
    -e DEPLOYMENT_URL=http://localhost:8080 \
    -p 8080:8080 \
    besser-wme-standalone

Mount a host directory at ``/app/diagrams`` to persist diagram data::

  docker run -d --name besser-wme \
    -v /srv/diagrams:/app/diagrams \
    -p 8080:8080 besser-wme-standalone

Docker Compose with Redis
-------------------------

Use :file:`docker-compose.yml` to run the server and Redis stack::

  docker compose up -d

Environment variables can be set in a ``.env`` file::

  DEPLOYMENT_URL=https://editor.example.com
  APOLLON_REDIS_DIAGRAM_TTL=30d

Production Compose (:file:`docker-compose.prod.yml`) configures named volumes and
network segmentation for hardened deployments.

Kubernetes
----------

* Build and push the image to your container registry.
* Create deployments for the server and Redis, expose them via services, and
  configure ingress with TLS termination.
* Mount persistent volumes for diagrams or rely on Redis persistence mechanisms.

Operational tips
----------------

* Monitor container logs with ``docker logs`` or ``kubectl logs``.
* Configure health checks to restart unhealthy containers.
* Set resource limits to prevent noisy neighbour issues.

Next steps
----------

For autoscaling and high availability, review :doc:`scaling`.
