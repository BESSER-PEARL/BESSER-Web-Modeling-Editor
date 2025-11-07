Overview
========

The BESSER Web Modeling Editor repository is organised as a TypeScript/Node.js
monorepo. It packages the reusable modelling engine together with the React
application and a lightweight Express server that publishes the editor as a web
experience.

The structure enables three complementary use cases:

* **Reuse the editor engine** via the `@besser/wme` npm package in custom
  applications that need UML editing capabilities.
* **Run the bundled web application** (`packages/webapp`) that uses the editor
  together with local project storage, template management, code generation,
  and collaboration affordances.
* **Serve diagrams and shared assets** by using the `packages/server`
  application on top of either the filesystem or Redis storage.

Downstream consumers can opt-in to the parts they need: embed the editor inside
another product, run the web application as a standalone site, or deploy both
behind the same server for a complete experience.

Use the remainder of the overview section to get your local environment ready
and to familiarise yourself with each package in the workspace.
