CI/CD
=====

Automate builds, tests, and deployments to deliver updates reliably.

Pipeline stages
---------------

1. **Install dependencies** – cache ``node_modules`` to speed up subsequent runs.
2. **Lint and test** – execute ``npm run lint`` and package-specific tests.
3. **Build** – run ``npm run build`` to produce production assets.
4. **Publish** – push Docker images or deploy static assets.
5. **Notify** – send release summaries to stakeholders.

Recommended tooling
-------------------

* GitHub Actions (``.github/workflows``) or GitLab CI pipelines.
* Use matrix builds to test across Node.js versions and operating systems.
* Cache ``~/.npm`` and ``node_modules`` directories using pipeline caching.

Secrets management
------------------

* Store ``SENTRY_DSN``, ``POSTHOG_KEY``, and registry credentials in CI secrets.
* Avoid committing sensitive information to the repository.

Deployment automation
---------------------

* Trigger Docker builds and push to your registry after tests pass.
* Use infrastructure-as-code (Terraform, Pulumi) to manage hosting environments.
* Integrate with Read the Docs or similar services to publish updated
  documentation automatically.

Rollback strategy
-----------------

* Tag Docker images and static assets with version numbers for quick rollback.
* Maintain database backups or Redis snapshots to restore state if required.

Next steps
----------

Read :doc:`incident-response` to prepare for operational issues.
