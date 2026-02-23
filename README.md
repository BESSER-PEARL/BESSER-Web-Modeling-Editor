# BESSER Web Modeling Editor

BESSER Web Modeling Editor (WME) is the web-based diagram editor for the BESSER low-code platform. It lets you create
and edit B-UML diagrams and integrates with BESSER generators and services.

You can use this editor:
- As an online web application: now freely available at [BESSER WME Online](https://editor.besser-pearl.org).
- Locally or self-hosted: clone this repository (or use it as a submodule in the main BESSER repo) and follow the build
  instructions below.

## Repository layout

This repository is a monorepo:

- `packages/editor`: core diagramming engine, published as the [@besser/wme](https://www.npmjs.com/package/@besser/wme)
  npm package.
- `packages/webapp`: React web application.
- `packages/server`: Node/Express server for standalone hosting and APIs.

## Main Features

### No account required

Users can access all features without creating an account.
All you have to do is open the application and start drawing.

### Easy to use editor

The user interface of BESSER WME is simple to use.
It works just like any other office and drawing tool that most users are familiar with.

- Select the diagram type you want to draw by clicking on the `File > New` menu. This selection determines the
  availability of elements that the user can use while drawing their diagram, making it easier for users who are newly
  introduced to modeling.
- Adding the element is as easy as dragging it from the elements menu and dropping it to the canvas. So is drawing the
  connection between them; simply drag and connect two or multiple elements.
- The layout of the connection is drawn automatically by the editor. If you want to manually lay it out, use the
  existing waypoint features.
- Edit or style the text or change the colors of any elements by double-clicking on them. An easy-to-use menu will allow
  you to do so.
- Use keyboard shortcuts to copy, paste, delete and move the elements throughout the canvas.
- Change the theme of the editor by clicking on the dark/light mode switch.

### Import and export your diagrams

Users can easily import existing BESSER WME diagrams to any editor that uses the BESSER WME library and continue
editing.

Exporting the diagrams is as easy as importing them.
Click on `File > Export` and select the format of the diagram to be exported.
Currently, BESSER WME supports five different formats: `SVG`, `PNG (White Background)`,
`PNG (Transparent Background)`, `JSON`, and `PDF`.

### Create diagram from template

Users can also create a diagram from a template if they do not want to draw a diagram from scratch.
To do that, all they have to do is click on `File > Start from Template` and select one of the templates from the list
of available templates.

## Under the Hood: Diagram Engine as an npm Package

The core diagramming engine lives in `packages/editor` and is published as [@besser/wme](https://www.npmjs.com/package/@besser/wme).
The web application (`packages/webapp`) and standalone server (`packages/server`) consume this package.

This separation allows the application to focus on delivering additional capabilities such as:

- Diagram sharing modes
- Template management
- Export/import/generation to multiple formats
- Hosting via application server or Docker

Meanwhile, all diagram rendering and editing logic is delegated to the core engine, ensuring consistency and reusability
across multiple front-ends or integrations.

## Contributing

We encourage contributions from the community and any comment is welcome!

If you are interested in contributing to this project, please read the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Code of Conduct

At BESSER, our commitment is centered on establishing and maintaining development environments that are welcoming,
inclusive, safe and free from all forms of harassment. All participants are expected to voluntarily respect and support
our [Code of Conduct](CODE_OF_CONDUCT.md).

## Governance

The development of this project follows the governance rules described in the [GOVERNANCE.md](GOVERNANCE.md) document.

## Contact

You can reach us at: [info@besser-pearl.org](mailto:info@besser-pearl.org)

## Local development

Prerequisites: Node.js 20+ and npm.

### Clone the repository

```
git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
cd BESSER-WEB-MODELING-EDITOR
```

### Install dependencies

```
npm install
```

### Start the web application

```
npm run start:webapp
```

The dev server runs on http://localhost:8080 and, in development mode, expects the BESSER backend at
http://localhost:9000/besser_api (see `packages/webapp/src/main/constant.ts`).

### Run the standalone server

The standalone server serves the built webapp bundle.

```
npm run build:webapp
npm run start:server
```

### Working from the main BESSER repo

If you are working from the main BESSER repository, initialize the submodule and run the same commands from
`besser/utilities/web_modeling_editor/frontend`:

```
git submodule update --init --recursive
cd besser/utilities/web_modeling_editor/frontend
npm install
npm run start:webapp
```

## License

This project is licensed under the [MIT](https://mit-license.org/) license.
