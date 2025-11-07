Incident response
=================

Prepare for outages or degraded performance by following this response plan.

Preparation
-----------

* Maintain runbooks for common failure modes (Redis outage, disk full, build
  failures).
* Configure alerting thresholds (see :doc:`../deployment/monitoring`).
* Ensure access to production systems is limited and auditable.

Triage
------

1. Assess impact – which features or users are affected?
2. Collect logs, metrics, and recent deployment history.
3. Communicate status via incident channels (Slack, status page).

Mitigation
----------

* Scale resources or restart services using container orchestrator commands.
* Roll back to a known good release if the incident correlates with a recent
  deployment.
* Disable non-essential features (e.g., collaboration) by setting
  ``APPLICATION_SERVER_VERSION=0`` temporarily if it reduces load.

Post-incident
-------------

* Document root cause, mitigation steps, and follow-up actions.
* Create GitHub issues for remediation tasks.
* Update runbooks and monitoring thresholds based on lessons learned.

Next steps
----------

See :doc:`support` for day-to-day user support practices.
