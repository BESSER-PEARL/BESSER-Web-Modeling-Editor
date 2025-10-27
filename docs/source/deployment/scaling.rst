Scaling
=======

Plan for growth by architecting the deployment to handle increased traffic,
collaborators, and diagram volume.

Horizontal scaling
------------------

* Run multiple server instances behind a load balancer (nginx, HAProxy, cloud
  load balancers).
* Use Redis storage for shared persistence and configure sticky sessions if
  WebSocket affinity is required.
* Container orchestrators (Kubernetes, ECS) simplify rolling updates and health
  checks.

Vertical scaling
----------------

* Increase CPU and memory on single-node deployments to support large diagrams or
  high concurrent collaboration sessions.
* Ensure filesystem storage resides on fast disks (SSD) to reduce save latency.

Caching
-------

* Enable CDN caching for static assets to reduce load on the origin server.
* Cache frequently requested diagrams (SVG exports) using edge caches or reverse
  proxies with short TTLs.

Disaster recovery
-----------------

* Backup Redis snapshots or the ``diagrams`` directory regularly.
* Store backups in geographically separate locations.
* Test restoration procedures to guarantee recovery point objectives.

Observability at scale
----------------------

* Collect metrics (CPU, memory, WebSocket connections) via Prometheus or cloud
  monitoring suites.
* Alert on abnormal error rates or spikes in save failures.

Security considerations
-----------------------

* Restrict share token lifetimes using Redis TTLs.
* Rotate TLS certificates automatically (Let's Encrypt, cert-manager).
* Apply network policies to limit access to Redis and the Node.js service.

Next steps
----------

Review :doc:`monitoring` for detailed observability guidance.
